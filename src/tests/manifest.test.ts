import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import YAML from "yaml";

describe("Atlassian Forge Manifest Schema Validation", () => {
	const manifestPath = path.resolve(__dirname, "../../manifest.yml");
	const manifestRaw = fs.readFileSync(manifestPath, "utf-8");
	const manifest = YAML.parse(manifestRaw);

	it("declares app ID and nodejs22.x runtime", () => {
		expect(manifest.app).toBeDefined();
		expect(manifest.app.id).toMatch(/^ari:cloud:ecosystem::app\//);
		expect(manifest.app.runtime.name).toBe("nodejs22.x");
	});

	it("defines rovo:agent with required fields and prompt", () => {
		const agents = manifest.modules["rovo:agent"];
		expect(Array.isArray(agents)).toBe(true);
		expect(agents.length).toBeGreaterThan(0);

		const driftAgent = agents.find((a: any) => a.key === "drift-guard-agent");
		expect(driftAgent).toBeDefined();
		expect(driftAgent.name).toBeDefined();
		expect(driftAgent.description).toBeDefined();
		expect(driftAgent.prompt).toBeDefined();
		expect(driftAgent.actions).toContain("audit-drift-action");
		expect(driftAgent.actions).toContain("reconcile-ticket-action");
		expect(driftAgent.actions).toContain("generate-release-score-action");
	});

	it("defines matching action modules for all rovo agent capabilities", () => {
		const actions = manifest.modules["action"];
		expect(Array.isArray(actions)).toBe(true);

		const actionKeys = actions.map((a: any) => a.key);
		expect(actionKeys).toContain("audit-drift-action");
		expect(actionKeys).toContain("reconcile-ticket-action");
		expect(actionKeys).toContain("generate-release-score-action");

		for (const act of actions) {
			expect(act.function).toBeDefined();
			expect(["READ_ONLY", "MUTATING"]).toContain(act.actionType);
		}
	});

	it("includes jira:issuePanel and confluence:contentAction for contextual surface", () => {
		expect(manifest.modules["jira:issuePanel"]).toBeDefined();
		expect(manifest.modules["confluence:contentAction"]).toBeDefined();
		expect(manifest.resources).toBeDefined();
	});
});
