import { get, set } from 'idb-keyval';
import type { AppData } from './types';

const STORAGE_KEY = 'pokedoro-web-data-v1';
const BACKUP_KEY = 'pokedoro-auto-backups';

export const defaultData = (): AppData => ({
  version: 1, todos: [], categories: [], friends: [], dex: {}, tickets: 0, focusBankSeconds: 0, totalFocusSeconds: 0,
  timer: { type: 'pomodoro', mode: 'focus', running: false, elapsedSeconds: 0, durationSeconds: 25 * 60, selectedTodoId: null, autoStart: false, lastTickAt: null },
  settings: { language: 'ko', cryVolume: 55, muted: false, staticMode: false, spriteStyle: 'pixel', colorTheme: 'meadow', customBackground: '', energyCollapsed: false, focusMinutes: 25, breakMinutes: 5 },
  encounter: null, panelPositions: {}
});

export async function loadData(): Promise<AppData> {
  const saved = await get<AppData>(STORAGE_KEY);
  return saved ? { ...defaultData(), ...saved, settings: { ...defaultData().settings, ...saved.settings }, timer: { ...defaultData().timer, ...saved.timer } } : defaultData();
}

export async function saveData(data: AppData): Promise<void> { await set(STORAGE_KEY, data); }

export async function createDailyBackup(data: AppData): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const backups = (await get<Array<{ date: string; data: AppData }>>(BACKUP_KEY)) ?? [];
  const next = [{ date: today, data }, ...backups.filter((item) => item.date !== today)].slice(0, 14);
  await set(BACKUP_KEY, next);
}

export function exportBackup(data: AppData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `POKEDORO-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export async function importBackup(file: File): Promise<AppData> {
  const parsed = JSON.parse(await file.text()) as AppData;
  if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.todos) || !Array.isArray(parsed.friends)) throw new Error('Invalid POKEDORO backup');
  await saveData(parsed);
  return parsed;
}
