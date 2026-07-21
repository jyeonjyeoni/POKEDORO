import { get, set, update } from 'idb-keyval';
import type { AppData } from './types';
import { runAutoPetIfDue } from './game';

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
  const normalized = normalizeBackupData(data);
  return {
    ...normalized,
    friends:normalized.friends.map(friend=>({...friend,personality:desktopPersonality(friend.personality)})),
    encounter:normalized.encounter?{...normalized.encounter,personality:desktopPersonality(normalized.encounter.personality)}:null
  };
}

const boundedInteger = (value:unknown, minimum:number, maximum:number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(minimum,Math.min(maximum,Math.floor(parsed))) : minimum;
};

export function normalizeBackupData(data:AppData):AppData {
  const ticketsPaid=boundedInteger(data.autoPetMachine?.ticketsPaid,0,30);
  const unlocked=Boolean(data.autoPetMachine?.unlocked)||ticketsPaid>=30;
  return {
    ...data,
    friends:(data.friends??[]).map(friend=>({...friend,personality:normalizePersonality(friend.personality),heldEverstone:Boolean(friend.heldEverstone)})),
    encounter:data.encounter?{...data.encounter,personality:normalizePersonality(data.encounter.personality)}:null,
    items:{everstone:boundedInteger(data.items?.everstone,0,Number.MAX_SAFE_INTEGER)},
    autoPetMachine:{
      ticketsPaid:unlocked?30:ticketsPaid,
      unlocked,
      enabled:unlocked&&Boolean(data.autoPetMachine?.enabled),
      lastRunAt:boundedInteger(data.autoPetMachine?.lastRunAt,0,Number.MAX_SAFE_INTEGER)
    }
  };
}

export const defaultData = (): AppData => ({
  version: 1, todos: [], categories: [], friends: [], dex: {}, tickets: 0, focusBankSeconds: 0, totalFocusSeconds: 0,
  timer: { type: 'pomodoro', mode: 'focus', running: false, elapsedSeconds: 0, durationSeconds: 30 * 60, selectedTodoId: null, autoStart: false, lastTickAt: null },
  settings: { language: 'ko', cryVolume: 55, muted: false, backgroundNotifications: false, staticMode: false, spriteStyle: 'pixel', colorTheme: 'meadow', customBackground: '', energyCollapsed: false, focusMinutes: 30, breakMinutes: 5 },
  encounter: null, panelPositions: {}, items:{everstone:0}, autoPetMachine:{ticketsPaid:0,unlocked:false,enabled:false,lastRunAt:0}
});

export async function loadData(): Promise<AppData> {
  const saved = await get<AppData>(STORAGE_KEY);
  return saved ? normalizeBackupData({ ...defaultData(), ...saved, settings: { ...defaultData().settings, ...saved.settings }, timer: { ...defaultData().timer, ...saved.timer } }) : defaultData();
}

export async function saveData(data: AppData): Promise<void> { await set(STORAGE_KEY, data); }

export async function runStoredAutoPetIfDue(now=Date.now()):Promise<{data:AppData;ran:boolean}> {
  let result:{data:AppData;ran:boolean}|undefined;
  await update<AppData>(STORAGE_KEY,stored=>{
    const current=normalizeBackupData(stored??defaultData());
    result=runAutoPetIfDue(current,now);
    return result.data;
  });
  return result??{data:defaultData(),ran:false};
}

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
