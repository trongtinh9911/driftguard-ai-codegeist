import { describe, expect, it } from "vitest";
import {
	auditCustomScenario,
	generateJsonReport,
	generateMarkdownReport,
	reconcileTicketDrift,
} from "../engine/driftEngine";
import { detectForgeEnvironment } from "../engine/forgeBridge";
import type { ForgeEnvironmentStatus } from "../engine/types";
import {
	buildCustomScenarioInput,
	CUSTOM_TESTER_PRESETS,
	evaluateCustomDrafts,
	extractRequirementsFromPrd,
	parseMultilineBullets,
	ticketToCustomDraft,
} from "../ui/customParser";
import {
	buildReportFilename,
	createJsonAuditExport,
	createMarkdownAuditExport,
} from "../ui/reportExport";

describe("Custom PRD & Jira Ticket Live Tester + Audit Report Export", () => {
	it("audits arbitrary custom PRD and Jira ticket via auditCustomScenario", () => {
		const { spec, ticket, auditResult } = auditCustomScenario({
			specId: "CONF-CUSTOM-77",
			specTitle: "Partner Payout Webhook PRD",
			specContent: [
				"- Enforce HMAC-SHA256 verification on X-Signature-SHA256 header",
				"- Persist Idempotency-Key in Redis with 72h TTL to prevent replay attacks",
				"- Enforce per-merchant rate limit of 100 req/sec with HTTP 429 Retry-After",
			].join("\n"),
			ticketKey: "PAY-301",
			ticketSummary: "Build Payout Webhook Handler",
			ticketStatus: "In Progress",
			acceptanceCriteria: [
				"Accept POST /api/webhooks/payout",
				"Validate webhook payload with MD5 checksum",
			],
		});

		expect(spec.id).toBe("CONF-CUSTOM-77");
		expect(ticket.key).toBe("PAY-301");
		expect(auditResult.riskLevel).toBe("RELEASE_BLOCKED");
		expect(auditResult.releaseReadinessScore).toBeLessThan(60);
		expect(auditResult.driftItems.length).toBeGreaterThanOrEqual(3);
		expect(
			auditResult.driftItems.some((d) => d.id === "drift-rule-hmac-sha256"),
		).toBe(true);
		expect(
			auditResult.driftItems.some((d) => d.id === "drift-rule-idempotency"),
		).toBe(true);
		expect(
			auditResult.driftItems.some((d) => d.id === "drift-rule-rate-limit"),
		).toBe(true);
	});

	it("re-evaluates custom live drafts to 100/100 after 1-click reconciliation patches the draft", () => {
		const preset = CUSTOM_TESTER_PRESETS[0];
		const initial = evaluateCustomDrafts(preset.prd, preset.ticket);

		expect(initial.auditResult.riskLevel).toBe("RELEASE_BLOCKED");
		expect(
			initial.auditResult.driftItems.some(
				(d) => d.category === "STALE_COMPLETION",
			),
		).toBe(true);

		const { updatedTicket } = reconcileTicketDrift(
			initial.ticket,
			initial.auditResult.driftItems,
		);
		const patchedDraft = ticketToCustomDraft(updatedTicket);
		const afterReconcile = evaluateCustomDrafts(preset.prd, patchedDraft);

		expect(afterReconcile.auditResult.driftItems.length).toBe(0);
		expect(afterReconcile.auditResult.releaseReadinessScore).toBe(100);
		expect(afterReconcile.auditResult.riskLevel).toBe("READY_TO_RELEASE");
	});

	it("evaluates all built-in Custom Live Tester presets accurately", () => {
		const webhookEval = evaluateCustomDrafts(
			CUSTOM_TESTER_PRESETS[0].prd,
			CUSTOM_TESTER_PRESETS[0].ticket,
		);
		const pciEval = evaluateCustomDrafts(
			CUSTOM_TESTER_PRESETS[1].prd,
			CUSTOM_TESTER_PRESETS[1].ticket,
		);
		const cleanEval = evaluateCustomDrafts(
			CUSTOM_TESTER_PRESETS[2].prd,
			CUSTOM_TESTER_PRESETS[2].ticket,
		);

		expect(webhookEval.auditResult.riskLevel).toBe("RELEASE_BLOCKED");
		expect(pciEval.auditResult.riskLevel).toBe("RELEASE_BLOCKED");
		expect(
			pciEval.auditResult.driftItems.some(
				(d) => d.id === "drift-rule-cvv-scrubbing",
			),
		).toBe(true);
		expect(
			pciEval.auditResult.driftItems.some(
				(d) => d.id === "drift-rule-log-sanitization",
			),
		).toBe(true);

		expect(cleanEval.auditResult.releaseReadinessScore).toBe(100);
		expect(cleanEval.auditResult.riskLevel).toBe("READY_TO_RELEASE");
		expect(cleanEval.auditResult.driftItems.length).toBe(0);
	});

	it("extracts requirements from markdown bullets, numbered lists, and plain prose", () => {
		const bullets = extractRequirementsFromPrd(
			"## Auth\n- Use HMAC-SHA256\n* Enforce Redis TTL\n1. Rate limit 100 req/sec",
		);
		expect(bullets).toEqual([
			"Use HMAC-SHA256",
			"Enforce Redis TTL",
			"Rate limit 100 req/sec",
		]);

		const prose = extractRequirementsFromPrd(
			"All endpoints must verify HMAC-SHA256 signatures and scrub PII logs.",
		);
		expect(prose.length).toBe(1);

		const parsedAc = parseMultilineBullets(
			"- [ ] Check X-Signature-SHA256\n- Store Idempotency-Key in Redis\n",
		);
		expect(parsedAc).toEqual([
			"Check X-Signature-SHA256",
			"Store Idempotency-Key in Redis",
		]);

		const input = buildCustomScenarioInput(
			CUSTOM_TESTER_PRESETS[2].prd,
			CUSTOM_TESTER_PRESETS[2].ticket,
		);
		expect(input.ticketKey).toBe("CORE-900");
		expect(input.acceptanceCriteria.length).toBe(4);
	});

	it("exports complete Markdown (.md) and JSON (.json) audit reports with runtime metadata", () => {
		const preset = CUSTOM_TESTER_PRESETS[0];
		const { spec, ticket, auditResult } = evaluateCustomDrafts(
			preset.prd,
			preset.ticket,
		);

		const sandboxEnv: ForgeEnvironmentStatus = {
			isForge: false,
			context: null,
			source: "STANDALONE_SANDBOX",
		};
		const forgeEnv: ForgeEnvironmentStatus = {
			isForge: true,
			context: { siteUrl: "https://team.atlassian.net" },
			source: "FORGE_CLOUD",
		};

		const coreMd = generateMarkdownReport(auditResult, spec, ticket);
		expect(coreMd).toContain("DriftGuard AI — Release Drift Audit Report");
		expect(coreMd).toContain(spec.id);
		expect(coreMd).toContain(ticket.key);

		const sandboxMd = createMarkdownAuditExport(
			auditResult,
			spec,
			ticket,
			sandboxEnv,
		);
		expect(sandboxMd).toContain("Interactive Sandbox");

		const forgeMd = createMarkdownAuditExport(
			auditResult,
			spec,
			ticket,
			forgeEnv,
		);
		expect(forgeMd).toContain("Live Forge Cloud");

		const coreJson = JSON.parse(generateJsonReport(auditResult, spec, ticket));
		expect(coreJson.reportType).toBe("DRIFTGUARD_RELEASE_AUDIT_REPORT");
		expect(coreJson.audit.releaseReadinessScore).toBe(
			auditResult.releaseReadinessScore,
		);

		const exportJson = JSON.parse(
			createJsonAuditExport(auditResult, spec, ticket, forgeEnv),
		);
		expect(exportJson.runtimeEnvironment.source).toBe("FORGE_CLOUD");
		expect(exportJson.runtimeEnvironment.isForge).toBe(true);
		expect(exportJson.audit.discrepanciesCount).toBe(
			auditResult.driftItems.length,
		);

		expect(buildReportFilename("BILL-404", "md", "2026-11-23T15:00:00Z")).toBe(
			"driftguard-audit-bill-404-2026-11-23.md",
		);
		expect(buildReportFilename("PAY/718", "json", "2026-11-23T15:00:00Z")).toBe(
			"driftguard-audit-pay-718-2026-11-23.json",
		);
	});

	it("falls back safely to STANDALONE_SANDBOX outside Atlassian Forge Cloud", async () => {
		const env = await detectForgeEnvironment();
		expect(env.isForge).toBe(false);
		expect(env.source).toBe("STANDALONE_SANDBOX");
		expect(env.context).toBeNull();
	});
});
