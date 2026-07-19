import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const APP_ORIGIN = "https://jyeonjyeoni.github.io";

describe("POKEDORO notification worker", () => {
	it("reports its health", async () => {
		const response = await SELF.fetch("https://example.com/");
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, service: "pokedoro-notify" });
	});

	it("allows the POKEDORO GitHub Pages origin", async () => {
		const response = await SELF.fetch("https://example.com/vapid-key", {
			headers: { Origin: APP_ORIGIN },
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe(APP_ORIGIN);
	});

	it("rejects unknown browser origins", async () => {
		const response = await SELF.fetch("https://example.com/vapid-key", {
			headers: { Origin: "https://attacker.example" },
		});
		expect(response.status).toBe(403);
	});

	it("handles CORS preflight", async () => {
		const response = await SELF.fetch("https://example.com/schedule", {
			method: "OPTIONS",
			headers: { Origin: APP_ORIGIN },
		});
		expect(response.status).toBe(204);
		expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
	});

	it("validates reminder requests before scheduling", async () => {
		const response = await SELF.fetch("https://example.com/schedule", {
			method: "POST",
			headers: { Origin: APP_ORIGIN, "Content-Type": "application/json" },
			body: JSON.stringify({ deviceId: "invalid" }),
		});
		expect(response.status).toBe(400);
	});
});
