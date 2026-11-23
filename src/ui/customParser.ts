import {
	auditSpecTicketDrift,
	createCustomScenario,
} from "../engine/driftEngine";
import type {
	AuditResult,
	CustomScenarioInput,
	JiraTicket,
	SpecDocument,
} from "../engine/types";

export interface CustomPrdDraft {
	id: string;
	title: string;
	version: string;
	author: string;
	lastUpdated: string;
	body: string;
}

export interface CustomTicketDraft {
	key: string;
	summary: string;
	status: JiraTicket["status"];
	assignee: string;
	updated: string;
	acceptanceCriteriaText: string;
	subtasksText: string;
}

export interface CustomTesterPreset {
	id: string;
	label: string;
	description: string;
	prd: CustomPrdDraft;
	ticket: CustomTicketDraft;
}

const BULLET_PREFIX_RE =
	/^(?:[-*•–—]\s+\[[ xX]\]\s+|\[[ xX]\]\s+|[-*•–—]\s+|\d+[.)]\s+)/;

function normalizeIsoTimestamp(dateInput: string, fallbackIso: string): string {
	const trimmed = dateInput.trim();
	if (!trimmed) return fallbackIso;
	if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
		return `${trimmed}T12:00:00Z`;
	}
	const parsed = Date.parse(trimmed);
	if (Number.isNaN(parsed)) {
		return fallbackIso;
	}
	return new Date(parsed).toISOString();
}

export function parseMultilineBullets(raw: string): string[] {
	return raw
		.split(/\r?\n/)
		.map((line) => line.trim().replace(BULLET_PREFIX_RE, "").trim())
		.filter(Boolean);
}

/**
 * Extracts structured requirements from arbitrary Confluence PRD text
 * (Markdown headings, bullet lists, numbered rules, or plain paragraphs).
 */
export function extractRequirementsFromPrd(body: string): string[] {
	const lines = body
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	const bulletReqs = lines
		.filter((line) => BULLET_PREFIX_RE.test(line))
		.map((line) => line.replace(BULLET_PREFIX_RE, "").trim())
		.filter(Boolean);

	if (bulletReqs.length > 0) {
		return bulletReqs;
	}

	const proseLines = lines.filter((line) => !/^#{1,4}\s+/.test(line));
	if (proseLines.length > 0) {
		return proseLines;
	}

	return body.trim() ? [body.trim()] : [];
}

/**
 * Converts UI form drafts into the canonical CustomScenarioInput expected by src/engine/driftEngine.
 */
export function buildCustomScenarioInput(
	prd: CustomPrdDraft,
	ticket: CustomTicketDraft,
): CustomScenarioInput {
	return {
		specId: prd.id.trim() || "CONF-CUSTOM-001",
		specTitle: prd.title.trim() || "Custom Confluence PRD",
		specContent: prd.body.trim(),
		specRequirements: extractRequirementsFromPrd(prd.body),
		ticketKey: ticket.key.trim().toUpperCase() || "CUSTOM-101",
		ticketSummary: ticket.summary.trim() || "Custom Jira Ticket",
		ticketStatus: ticket.status,
		ticketAssignee: ticket.assignee.trim() || "Engineer (Custom)",
		acceptanceCriteria: parseMultilineBullets(ticket.acceptanceCriteriaText),
		subtasks: parseMultilineBullets(ticket.subtasksText),
	};
}

/**
 * Runs real-time drift analysis on arbitrary pasted Confluence PRD and Jira Ticket drafts,
 * leveraging the core engine's createCustomScenario + auditSpecTicketDrift.
 */
export function evaluateCustomDrafts(
	prd: CustomPrdDraft,
	ticketDraft: CustomTicketDraft,
): {
	spec: SpecDocument;
	ticket: JiraTicket;
	auditResult: AuditResult;
} {
	const input = buildCustomScenarioInput(prd, ticketDraft);
	const { spec, ticket } = createCustomScenario(input);

	const enrichedSpec: SpecDocument = {
		...spec,
		version: prd.version.trim() || spec.version,
		author: prd.author.trim() || spec.author,
		lastUpdated: normalizeIsoTimestamp(prd.lastUpdated, spec.lastUpdated),
	};

	const enrichedTicket: JiraTicket = {
		...ticket,
		updated: normalizeIsoTimestamp(ticketDraft.updated, ticket.updated),
	};

	const auditResult = auditSpecTicketDrift(enrichedSpec, enrichedTicket);

	return {
		spec: enrichedSpec,
		ticket: enrichedTicket,
		auditResult,
	};
}

/**
 * Converts a reconciled JiraTicket back into editable form fields so 1-click Rovo
 * reconciliation visibly patches the judge's live ticket editor.
 */
export function ticketToCustomDraft(ticket: JiraTicket): CustomTicketDraft {
	return {
		key: ticket.key,
		summary: ticket.summary,
		status: ticket.status,
		assignee: ticket.assignee,
		updated: ticket.updated.split("T")[0] || ticket.updated,
		acceptanceCriteriaText: ticket.acceptanceCriteria
			.map((ac) => `- ${ac}`)
			.join("\n"),
		subtasksText: ticket.subtasks.map((st) => `- ${st}`).join("\n"),
	};
}

export const CUSTOM_TESTER_PRESETS: CustomTesterPreset[] = [
	{
		id: "preset-webhook-drift",
		label: "Webhook Security Drift (HMAC vs MD5)",
		description:
			"PRD mandates HMAC-SHA256, Redis 72h idempotency & 100 req/sec rate limit; Ticket uses MD5 and was closed early.",
		prd: {
			id: "CONF-PRD-901",
			title: "Partner Billing Webhook Specification",
			version: "v2.5",
			author: "Principal Security Architect",
			lastUpdated: "2026-11-23",
			body: [
				"## 1. Cryptographic Signature Verification",
				"All partner billing webhooks must verify the X-Signature-SHA256 header using HMAC-SHA256.",
				"- Reject MD5 and SHA-1 legacy signatures with HTTP 401 Unauthorized",
				"- Rotate signing secret via AWS Secrets Manager",
				"",
				"## 2. Idempotency & Replay Protection",
				"Prevent duplicate invoice charges on network retries.",
				"- Require Idempotency-Key header on every POST /webhooks/billing call",
				"- Persist keys in Redis cluster with 72-hour TTL and return HTTP 409 on replay",
				"",
				"## 3. Burst Throttling",
				"- Enforce per-merchant rate limit of 100 req/sec and return HTTP 429 with Retry-After header",
			].join("\n"),
		},
		ticket: {
			key: "BILL-404",
			summary: "Implement Partner Billing Webhook Receiver",
			status: "Done",
			assignee: "Jordan Lee",
			updated: "2026-11-20",
			acceptanceCriteriaText: [
				"- Accept POST payload at /api/v1/webhooks/billing",
				"- Validate payload using MD5 hash comparison with shared secret",
				"- Insert billing event into PostgreSQL ledger",
				"- Return HTTP 200 OK when persisted",
			].join("\n"),
			subtasksText: [
				"- BILL-405: Create Express route handler",
				"- BILL-406: Add PostgreSQL migration",
			].join("\n"),
		},
	},
	{
		id: "preset-pci-compliance",
		label: "PCI-DSS Telemetry & CVV Gap",
		description:
			"PRD enforces PCI-DSS 4.0 CVV memory wipe & CloudWatch PII log scrubbing; Ticket omits both safeguards.",
		prd: {
			id: "CONF-PRD-512",
			title: "Card Vault & Checkout Telemetry Standard",
			version: "v4.0",
			author: "Compliance Engineering",
			lastUpdated: "2026-11-23",
			body: [
				"## Cardholder Data Handling (PCI-DSS 4.0)",
				"- Enforce zero-PAN storage and immediately wipe and discard CVV from memory after authorization",
				"",
				"## Observability & Log Sanitization",
				"- Scrub 16-digit PAN and auth tokens before shipping logs to Datadog or CloudWatch",
				"- Mask all PII fields in error stack traces",
			].join("\n"),
		},
		ticket: {
			key: "PAY-718",
			summary: "Upgrade Checkout Payment Intent Service",
			status: "In Review",
			assignee: "Priya Nair",
			updated: "2026-11-23",
			acceptanceCriteriaText: [
				"- Submit tokenized Stripe payment intent payload",
				"- Return localized error banners on declined cards",
				"- Emit structured JSON request payloads for debugging",
			].join("\n"),
			subtasksText: "- PAY-719: Wire new Stripe SDK client",
		},
	},
	{
		id: "preset-aligned-clean",
		label: "Aligned Spec (100/100 Ready)",
		description:
			"Both Confluence PRD and Jira Ticket satisfy every security, rate-limit, and telemetry requirement.",
		prd: {
			id: "CONF-PRD-777",
			title: "Zero-Drift Payment Gateway Service",
			version: "v1.0",
			author: "Platform Lead",
			lastUpdated: "2026-11-21",
			body: [
				"## Security & Reliability",
				"- Verify X-Signature-SHA256 using HMAC-SHA256",
				"- Store Idempotency-Key in Redis with 72h TTL to stop replay attacks",
				"- Enforce rate limit of 100 req/sec with HTTP 429 Retry-After",
				"- Scrub PII and mask sensitive fields in CloudWatch logs",
			].join("\n"),
		},
		ticket: {
			key: "CORE-900",
			summary: "Deploy Zero-Drift Payment Gateway Service",
			status: "In Review",
			assignee: "Elena Rostova",
			updated: "2026-11-22",
			acceptanceCriteriaText: [
				"- Enforce HMAC-SHA256 verification on X-Signature-SHA256 header",
				"- Store Idempotency-Key in Redis cluster with 72h TTL against replay attacks",
				"- Apply 100 req/sec rate limit returning HTTP 429 with Retry-After header",
				"- Run PII log sanitization and masking before CloudWatch ingestion",
			].join("\n"),
			subtasksText: "- CORE-901: Integration test suite for webhook gateway",
		},
	},
];
