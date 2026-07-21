export type Language = 'ko' | 'en' | 'ja';
export type TimerType = 'pomodoro' | 'stopwatch';
export type TimerMode = 'focus' | 'break';
export type SpriteStyle = 'pixel' | 'home' | 'official';
export type Theme = 'meadow' | 'blossom' | 'lavender' | 'ocean' | 'sunset';
export type PanelName = 'focus' | 'todos' | 'explore' | 'friends' | 'dex' | 'settings';

export interface Todo { id: string; title: string; categoryId: string | null; estimateMinutes: number; focusSeconds: number; pomodoroCount: number; completed: boolean; completedAt?: string; sortOrder: number; }
export interface Category { id: string; name: string; }
export interface Friend { id: string; speciesId: number; personality: string; intimacy: number; mood: string; shiny: boolean; metAt: string; befriendedAt: string; togetherSeconds: number; inRoom: boolean; lastPetAt?: string; heldEverstone?: boolean; formKey?: string; }
export interface DexFormEntry { formKey: string; firstSeenAt: string; befriendedCount: number; shinySeen: boolean; shinyFriend: boolean; }
export interface DexEntry { speciesId: number; firstSeenAt: string; befriendedCount: number; shinySeen: boolean; shinyFriend: boolean; forms?: DexFormEntry[]; }
export interface EncounterState { seed: string; speciesId: number; personality: string; shiny: boolean; distance: number; turns: number; turnsLeft?: number; finished: boolean; befriended: boolean; formKey?: string; reaction?: 'jump' | 'shake'; }
export interface TimerState { type: TimerType; mode: TimerMode; running: boolean; elapsedSeconds: number; durationSeconds: number; selectedTodoId: string | null; autoStart: boolean; lastTickAt: number | null; }
export interface Settings { language: Language; cryVolume: number; muted: boolean; backgroundNotifications: boolean; staticMode: boolean; spriteStyle: SpriteStyle; colorTheme: Theme; customBackground: string; energyCollapsed: boolean; focusMinutes: number; breakMinutes: number; }
export interface WindowPosition { x: number; y: number; }
export interface Items { everstone: number; }
export interface AutoPetMachine { ticketsPaid: number; unlocked: boolean; enabled: boolean; lastRunAt: number; }
export interface AppData {
  version: number;
  todos: Todo[];
  categories: Category[];
  friends: Friend[];
  dex: Record<number, DexEntry>;
  tickets: number;
  focusBankSeconds: number;
  totalFocusSeconds: number;
  timer: TimerState;
  settings: Settings;
  encounter: EncounterState | null;
  panelPositions: Partial<Record<PanelName, WindowPosition>>;
  items: Items;
  autoPetMachine: AutoPetMachine;
}

export interface SpeciesInfo { id: number; name: string; names: Partial<Record<Language, string>>; genus: string; types: string[]; height: number; weight: number; captureRate: number; legendary: boolean; mythical: boolean; evolutionChainUrl?: string; }
