import type { AppData } from './types';

const API_URL = 'https://pokedoro-notify.jyeonjyeoni.workers.dev';
const DEVICE_KEY = 'pokedoro-push-device-id';

function deviceId(): string {
  let value = localStorage.getItem(DEVICE_KEY);
  if (!value) {
    value = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, value);
  }
  return value;
}

function decodeVapidKey(value: string): Uint8Array<ArrayBuffer> {
  const padded = value + '='.repeat((4 - value.length % 4) % 4);
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index++) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

async function api(path: string, body?: Record<string, unknown>): Promise<Response> {
  const response = await fetch(`${API_URL}${path}`, body ? {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body)
  } : undefined);
  if (!response.ok) throw new Error(`Notification server returned ${response.status}`);
  return response;
}

export function supportsBackgroundNotifications(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

async function subscription(): Promise<PushSubscription | null> {
  if (!supportsBackgroundNotifications() || Notification.permission !== 'granted') return null;
  const registration = await navigator.serviceWorker.ready;
  const current = await registration.pushManager.getSubscription();
  if (current) return current;
  const response = await api('/vapid-key');
  const {publicKey} = await response.json() as {publicKey:string};
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeVapidKey(publicKey)
  });
}

async function registerSubscription(): Promise<PushSubscription | null> {
  const current = await subscription();
  if (!current) return null;
  await api('/subscribe', {deviceId:deviceId(), subscription:current.toJSON()});
  return current;
}

export async function enableBackgroundNotifications(): Promise<boolean> {
  if (!supportsBackgroundNotifications()) return false;
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
  if (permission !== 'granted') return false;
  return !!(await registerSubscription());
}

export async function disableBackgroundNotifications(): Promise<void> {
  if (!supportsBackgroundNotifications()) return;
  await api('/cancel', {deviceId:deviceId()}).catch(()=>{});
  const registration = await navigator.serviceWorker.ready;
  const current = await registration.pushManager.getSubscription();
  if (current) await current.unsubscribe().catch(()=>false);
}

export async function syncTimerNotification(data: AppData): Promise<void> {
  if (!data.settings.backgroundNotifications || !supportsBackgroundNotifications()) return;
  if (!data.timer.running || data.timer.type !== 'pomodoro') {
    await api('/cancel', {deviceId:deviceId()}).catch(()=>{});
    return;
  }
  const current = await registerSubscription();
  if (!current) return;
  const pendingSeconds = data.timer.lastTickAt ? Math.max(0, Math.floor((Date.now() - data.timer.lastTickAt) / 1000)) : 0;
  const remaining = Math.max(1, data.timer.durationSeconds - data.timer.elapsedSeconds - pendingSeconds);
  await api('/schedule', {
    deviceId: deviceId(),
    finishAt: Date.now() + remaining * 1000,
    language: data.settings.language,
    mode: data.timer.mode,
    autoStart: data.timer.autoStart,
    focusMinutes: data.settings.focusMinutes,
    breakMinutes: data.settings.breakMinutes,
    muted: data.settings.muted
  });
}
