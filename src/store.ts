import { get, set } from 'idb-keyval';
import type { AppData } from './types';

const STORAGE_KEY = 'pokedoro-web-data-v1';
const BACKUP_KEY = 'pokedoro-auto-backups';
const DESKTOP_PERSONALITIES: Record<string,string> = {
  timid:'겁쟁이', glutton:'먹보', curious:'호기심쟁이', calm:'느긋함',
  playful:'장난꾸러기', affectionate:'애교쟁이', aloof:'새침함', sleepy:'잠꾸러기'
};
const WEB_PERSONALITIES = Object.fromEntries(Object.entries(DESKTOP_PERSONALITIES).map(([web,desktop])=>[desktop,web]));

export function normalizePersonality(personality:string):string {
  return WEB_PERSONALITIES[personality] ?? personality;
}

export function portableBackupData(data:AppData):AppData {
  const desktopPersonality = (personality:string) => DESKTOP_PERSONALITIES[normalizePersonality(personality)] ?? personality;
  return {
    ...data,
    friends:data.friends.map(friend=>({...friend,personality:desktopPersonality(friend.personality)})),
    encounter:data.encounter?{...data.encounter,personality:desktopPersonality(data.encounter.personality)}:null
  };
}

function normalizeBackupData(data:AppData):AppData {
  return {
    ...data,
    friends:data.friends.map(friend=>({...friend,personality:normalizePersonality(friend.personality)})),
    encounter:data.encounter?{...data.encounter,personality:normalizePersonality(data.encounter.personality)}:null
  };
}

export const defaultData = (): AppData => ({
  version: 1, todos: [], categories: [], friends: [], dex: {}, tickets: 0, focusBankSeconds: 0, totalFocusSeconds: 0,
  timer: { type: 'pomodoro', mode: 'focus', running: false, elapsedSeconds: 0, durationSeconds: 30 * 60, selectedTodoId: null, autoStart: false, lastTickAt: null },
  settings: { language: 'ko', cryVolume: 55, muted: false, backgroundNotifications: false, staticMode: false, spriteStyle: 'pixel', colorTheme: 'meadow', customBackground: '', energyCollapsed: false, focusMinutes: 30, breakMinutes: 5 },
  encounter: null, panelPositions: {}
});

export async function loadData(): Promise<AppData> {
  const saved = await get<AppData>(STORAGE_KEY);
  return saved ? normalizeBackupData({ ...defaultData(), ...saved, settings: { ...defaultData().settings, ...saved.settings }, timer: { ...defaultData().timer, ...saved.timer } }) : defaultData();
}

export async function saveData(data: AppData): Promise<void> { await set(STORAGE_KEY, data); }

export async function createDailyBackup(data: AppData): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const backups = (await get<Array<{ date: string; data: AppData }>>(BACKUP_KEY)) ?? [];
  const next = [{ date: today, data }, ...backups.filter((item) => item.date !== today)].slice(0, 14);
  await set(BACKUP_KEY, next);
}

export function exportBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(portableBackupData(data), null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `POKEDORO-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importBackup(file: File): Promise<AppData> {
  const parsed = JSON.parse(await file.text()) as AppData;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.todos) || !Array.isArray(parsed.friends)) throw new Error('Invalid POKEDORO backup');
  const normalized = normalizeBackupData(parsed);
  await saveData(normalized);
  return normalized;
}
