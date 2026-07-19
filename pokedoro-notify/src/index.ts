import { DurableObject } from "cloudflare:workers";
import webpush, { type PushSubscription } from "web-push";

type Language = "ko" | "en" | "ja";
type TimerMode = "focus" | "break";

interface ReminderDetails {
	finishAt: number;
	language: Language;
	mode: TimerMode;
	autoStart: boolean;
	focusMinutes: number;
	breakMinutes: number;
	muted: boolean;
}

interface WorkerEnv {
	REMINDERS: DurableObjectNamespace<Reminder>;
	VAPID_PUBLIC_KEY: string;
	VAPID_PRIVATE_KEY: string;
	VAPID_SUBJECT: string;
}

const APP_ORIGIN = "https://jyeonjyeoni.github.io";
const LOCAL_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);
const MAX_BODY_BYTES = 16_384;
const MAX_REMINDER_DELAY = 24 * 60 * 60 * 1000;
const DEVICE_ID = /^[A-Za-z0-9_-]{20,80}$/;
const ALERT_REPEAT_COUNT = 3;
const ALERT_REPEAT_INTERVAL_MS = 3_000;

const messages: Record<Language, Record<TimerMode, { title: string; body: string }>> = {
	ko: {
		focus: { title: "POKEDORO", body: "집중 시간이 끝났어요. 잠시 쉬어가세요!" },
		break: { title: "POKEDORO", body: "휴식 시간이 끝났어요. 다시 집중할 시간이에요!" },
	},
	en: {
		focus: { title: "POKEDORO", body: "Focus time is over. Take a short break!" },
		break: { title: "POKEDORO", body: "Break time is over. Ready to focus again?" },
	},
	ja: {
		focus: { title: "POKEDORO", body: "集中時間が終わりました。少し休みましょう！" },
		break: { title: "POKEDORO", body: "休憩時間が終わりました。もう一度集中しましょう！" },
	},
};

function isAllowedOrigin(origin: string | null): boolean {
	return origin === APP_ORIGIN || (origin !== null && LOCAL_ORIGINS.has(origin));
}

function corsHeaders(origin: string | null): HeadersInit {
	return {
		"Access-Control-Allow-Origin": isAllowedOrigin(origin) ? origin! : APP_ORIGIN,
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "GET, POST, OPTIONS",
		"Access-Control-Max-Age": "86400",
		Vary: "Origin",
	};
}

function json(data: unknown, status = 200, origin: string | null = APP_ORIGIN): Response {
	return Response.json(data, { status, headers: corsHeaders(origin) });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
	const length = Number(request.headers.get("content-length") ?? "0");
	if (length > MAX_BODY_BYTES) throw new Error("Request body is too large");
	const text = await request.text();
	if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new Error("Request body is too large");
	const parsed: unknown = JSON.parse(text);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid JSON body");
	return parsed as Record<string, unknown>;
}

function validSubscription(value: unknown): value is PushSubscription {
	if (!value || typeof value !== "object") return false;
	const item = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
	return typeof item.endpoint === "string" && item.endpoint.startsWith("https://") &&
		typeof item.keys?.p256dh === "string" && item.keys.p256dh.length > 20 &&
		typeof item.keys?.auth === "string" && item.keys.auth.length > 5;
}

function getDeviceId(body: Record<string, unknown>): string {
	const value = body.deviceId;
	if (typeof value !== "string" || !DEVICE_ID.test(value)) throw new Error("Invalid device ID");
	return value;
}

function getReminder(body: Record<string, unknown>): ReminderDetails {
	const now = Date.now();
	const finishAt = Number(body.finishAt);
	const language = body.language;
	const mode = body.mode;
	const focusMinutes = Number(body.focusMinutes);
	const breakMinutes = Number(body.breakMinutes);
	if (!Number.isFinite(finishAt) || finishAt < now - 5_000 || finishAt > now + MAX_REMINDER_DELAY) throw new Error("Invalid finish time");
	if (language !== "ko" && language !== "en" && language !== "ja") throw new Error("Invalid language");
	if (mode !== "focus" && mode !== "break") throw new Error("Invalid timer mode");
	if (!Number.isInteger(focusMinutes) || focusMinutes < 1 || focusMinutes > 999) throw new Error("Invalid focus duration");
	if (!Number.isInteger(breakMinutes) || breakMinutes < 1 || breakMinutes > 999) throw new Error("Invalid break duration");
	return {
		finishAt: Math.max(now + 1_000, finishAt),
		language,
		mode,
		autoStart: body.autoStart === true,
		focusMinutes,
		breakMinutes,
		muted: body.muted === true,
	};
}

function nextReminder(current: ReminderDetails, now: number): ReminderDetails {
	let mode: TimerMode = current.mode === "focus" ? "break" : "focus";
	let finishAt = current.finishAt + (mode === "focus" ? current.focusMinutes : current.breakMinutes) * 60_000;
	while (finishAt <= now) {
		mode = mode === "focus" ? "break" : "focus";
		finishAt += (mode === "focus" ? current.focusMinutes : current.breakMinutes) * 60_000;
	}
	return { ...current, mode, finishAt };
}

export class Reminder extends DurableObject<WorkerEnv> {
	async subscribe(subscription: PushSubscription): Promise<void> {
		if (!validSubscription(subscription)) throw new Error("Invalid push subscription");
		await this.ctx.storage.put("subscription", subscription);
	}

	async schedule(reminder: ReminderDetails): Promise<void> {
		const subscription = await this.ctx.storage.get<PushSubscription>("subscription");
		if (!subscription) throw new Error("Push subscription not found");
		await this.ctx.storage.put({
			reminder,
			repeatRemaining: ALERT_REPEAT_COUNT - 1,
		});
		await this.ctx.storage.setAlarm(reminder.finishAt);
	}

	async cancel(): Promise<void> {
		await this.ctx.storage.delete(["reminder", "repeatRemaining"]);
		await this.ctx.storage.deleteAlarm();
	}

	async alarm(): Promise<void> {
		const [subscription, reminder, repeatRemaining = 0] = await Promise.all([
			this.ctx.storage.get<PushSubscription>("subscription"),
			this.ctx.storage.get<ReminderDetails>("reminder"),
			this.ctx.storage.get<number>("repeatRemaining"),
		]);
		if (!subscription || !reminder) {
			await this.cancel();
			return;
		}

		webpush.setVapidDetails(this.env.VAPID_SUBJECT, this.env.VAPID_PUBLIC_KEY, this.env.VAPID_PRIVATE_KEY);
		const message = messages[reminder.language][reminder.mode];
		const payload = JSON.stringify({
			...message,
			tag: "pokedoro-timer",
			icon: `${APP_ORIGIN}/POKEDORO/assets/app-icon.png`,
			badge: `${APP_ORIGIN}/POKEDORO/assets/app-icon.png`,
			silent: reminder.muted,
			data: { url: `${APP_ORIGIN}/POKEDORO/`, finishAt: reminder.finishAt },
		});

		try {
			await webpush.sendNotification(subscription, payload, { TTL: 3_600, urgency: "high" });
		} catch (error) {
			const status = typeof error === "object" && error && "statusCode" in error ? Number(error.statusCode) : 0;
			if (status === 404 || status === 410) {
				await this.ctx.storage.deleteAll();
				return;
			}
			throw error;
		}

		if (repeatRemaining > 0) {
			await this.ctx.storage.put("repeatRemaining", repeatRemaining - 1);
			await this.ctx.storage.setAlarm(Date.now() + ALERT_REPEAT_INTERVAL_MS);
			return;
		}

		if (reminder.autoStart) {
			const next = nextReminder(reminder, Date.now());
			await this.ctx.storage.put({
				reminder: next,
				repeatRemaining: ALERT_REPEAT_COUNT - 1,
			});
			await this.ctx.storage.setAlarm(next.finishAt);
		} else {
			await this.cancel();
		}
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);
		const origin = request.headers.get("Origin");
		if (request.method === "OPTIONS") {
			if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
			return new Response(null, { status: 204, headers: corsHeaders(origin) });
		}
		if (url.pathname === "/" && request.method === "GET") return json({ ok: true, service: "pokedoro-notify" }, 200, origin);
		if (!isAllowedOrigin(origin)) return json({ error: "Origin not allowed" }, 403, origin);
		if (url.pathname === "/vapid-key" && request.method === "GET") return json({ publicKey: env.VAPID_PUBLIC_KEY }, 200, origin);
		if (request.method !== "POST") return json({ error: "Not found" }, 404, origin);

		try {
			const body = await readJson(request);
			const deviceId = getDeviceId(body);
			const reminder = env.REMINDERS.getByName(deviceId);
			if (url.pathname === "/subscribe") {
				if (!validSubscription(body.subscription)) throw new Error("Invalid push subscription");
				await reminder.subscribe(body.subscription);
				return json({ ok: true }, 200, origin);
			}
			if (url.pathname === "/schedule") {
				await reminder.schedule(getReminder(body));
				return json({ ok: true }, 200, origin);
			}
			if (url.pathname === "/cancel") {
				await reminder.cancel();
				return json({ ok: true }, 200, origin);
			}
			return json({ error: "Not found" }, 404, origin);
		} catch (error) {
			const message = error instanceof Error ? error.message : "Invalid request";
			return json({ error: message }, 400, origin);
		}
	},
} satisfies ExportedHandler<WorkerEnv>;
