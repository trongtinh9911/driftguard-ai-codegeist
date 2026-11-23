import type {
	AuditResult,
	CustomScenarioInput,
	DriftCategory,
	DriftItem,
	DriftSeverity,
	JiraTicket,
	RiskLevel,
	SpecDocument,
} from "./types";

interface KeywordRule {
	id: string;
	category: DriftCategory;
	severity: DriftSeverity;
	specKeywords: string[];
	antiKeywords?: string[]; // If found in ticket, it's an explicit conflict!
	requiredTicketKeywords: string[];
	title: string;
	rootCause: string;
	remediationTemplate: (req: string) => string;
}

const DRIFT_RULES: KeywordRule[] = [
	{
		id: "rule-hmac-sha256",
		category: "SECURITY_COMPLIANCE",
		severity: "CRITICAL",
		specKeywords: ["hmac-sha256", "x-signature-sha256", "sha256"],
		antiKeywords: ["md5", "sha-1", "sha1"],
		requiredTicketKeywords: ["hmac-sha256", "sha256", "x-signature"],
		title: "Deprecated / Vulnerable Signature Algorithm in Acceptance Criteria",
		rootCause:
			"Spec mandates cryptographic HMAC-SHA256 verification, but Jira ticket explicitly implements deprecated MD5 hash comparison.",
		remediationTemplate: () =>
			"Enforce HMAC-SHA256 signature verification validating X-Signature-SHA256 header against AWS Secrets Manager key.",
	},
	{
		id: "rule-idempotency",
		category: "SECURITY_COMPLIANCE",
		severity: "CRITICAL",
		specKeywords: ["idempotency", "replay attack", "idempotency-key"],
		requiredTicketKeywords: ["idempotency", "redis", "ttl", "replay"],
		title: "Missing Idempotency & Duplicate Transaction Protection",
		rootCause:
			"Spec v2.4 requires strict Redis 72-hour idempotency key validation to prevent double-charging on webhook replays; Jira ticket completely omits this check.",
		remediationTemplate: () =>
			"Store Idempotency-Key in Redis cluster with 72h TTL; return HTTP 409 Conflict on duplicate concurrent payloads.",
	},
	{
		id: "rule-rate-limit",
		category: "SCOPE_CREEP_OMISSION",
		severity: "HIGH",
		specKeywords: ["rate limit", "throttl", "100 req/sec", "retry-after"],
		requiredTicketKeywords: ["rate limit", "throttle", "429", "retry-after"],
		title: "Omission of Throughput Throttling & Burst Defense",
		rootCause:
			"Confluence spec enforces per-merchant rate limiting (100 req/sec) to defend gateway availability; ticket lacks rate-limiting acceptance criteria.",
		remediationTemplate: () =>
			"Enforce rate limiter of 100 req/s per merchant ID and emit Retry-After header with HTTP 429.",
	},
	{
		id: "rule-cvv-scrubbing",
		category: "SECURITY_COMPLIANCE",
		severity: "CRITICAL",
		specKeywords: ["cvv", "cvc", "zero-pan", "pci-dss", "cardholder"],
		requiredTicketKeywords: ["cvv", "discard", "memory wipe", "pci"],
		title: "Non-compliant Cardholder Data (CVV) Handling",
		rootCause:
			"PCI-DSS 4.0 spec strictly mandates immediate CVV memory wipe and discard after payment authorization; ticket does not specify CVV retention rules.",
		remediationTemplate: () =>
			"Discard and purge CVV/CVC from memory buffers immediately following Stripe payment authorization.",
	},
	{
		id: "rule-log-sanitization",
		category: "ACCEPTANCE_CRITERIA_MISMATCH",
		severity: "HIGH",
		specKeywords: ["log", "datadog", "cloudwatch", "scrub", "mask"],
		requiredTicketKeywords: ["log", "scrub", "mask", "pii", "sanitiz"],
		title: "Telemetry Log Sanitization & PII Masking Gap",
		rootCause:
			"Spec section requires deterministic regex masking to prevent raw card numbers in CloudWatch/Datadog; ticket lacks log interception criteria.",
		remediationTemplate: () =>
			"Unit test log interceptor to ensure all 16-digit card patterns and auth tokens are scrubbed from telemetry outputs.",
	},
];

export function auditSpecTicketDrift(
	spec: SpecDocument,
	ticket: JiraTicket,
): AuditResult {
	const driftItems: DriftItem[] = [];
	const ticketACCombined = ticket.acceptanceCriteria.join(" ").toLowerCase();
	const ticketSubtasksCombined = ticket.subtasks.join(" ").toLowerCase();
	const fullTicketContext =
		`${ticket.summary} ${ticketACCombined} ${ticketSubtasksCombined}`.toLowerCase();

	// 1. Check Rule-based mismatches
	for (const rule of DRIFT_RULES) {
		let triggeredBySpec = false;
		let matchingSpecSnippet = "";
		let matchingSectionTitle = "";

		for (const section of spec.sections) {
			const secText =
				`${section.title} ${section.content} ${section.requirements.join(" ")}`.toLowerCase();
			const hasKeywords = rule.specKeywords.some((kw) => secText.includes(kw));
			if (hasKeywords) {
				triggeredBySpec = true;
				matchingSectionTitle = `${spec.id} - ${section.title}`;
				matchingSpecSnippet =
					section.requirements.find((r) =>
						rule.specKeywords.some((kw) => r.toLowerCase().includes(kw)),
					) || section.content;
				break;
			}
		}

		if (!triggeredBySpec) continue;

		// Check if ticket satisfies required keywords
		const hasRequired = rule.requiredTicketKeywords.some((kw) =>
			fullTicketContext.includes(kw),
		);
		const hasAnti = rule.antiKeywords
			? rule.antiKeywords.some((kw) => fullTicketContext.includes(kw))
			: false;

		if (!hasRequired || hasAnti) {
			const snippetInTicket =
				ticket.acceptanceCriteria.find(
					(ac) =>
						(rule.antiKeywords &&
							rule.antiKeywords.some((ak) => ac.toLowerCase().includes(ak))) ||
						rule.specKeywords.some((sk) => ac.toLowerCase().includes(sk)),
				) ||
				(hasAnti
					? "Explicitly uses legacy/insecure anti-pattern"
					: "Criterion completely missing from ticket");

			driftItems.push({
				id: `drift-${rule.id}`,
				title: rule.title,
				category: rule.category,
				severity: rule.severity,
				specReference: matchingSectionTitle,
				ticketReference: `${ticket.key} - Acceptance Criteria`,
				specSnippet: matchingSpecSnippet,
				ticketSnippet: snippetInTicket,
				rootCause: rule.rootCause,
				suggestedRemediation: rule.remediationTemplate(matchingSpecSnippet),
			});
		}
	}

	// 2. Check Stale Completion Drift: Ticket is Marked 'Done' while Spec updated later with unfulfilled requirements
	const specDate = new Date(spec.lastUpdated).getTime();
	const ticketDate = new Date(ticket.updated).getTime();

	if (
		ticket.status === "Done" &&
		specDate > ticketDate &&
		driftItems.length > 0
	) {
		driftItems.unshift({
			id: "drift-stale-done",
			title: "Premature Ticket Closure (Stale Done Status)",
			category: "STALE_COMPLETION",
			severity: "CRITICAL",
			specReference: `${spec.id} (${spec.version} updated ${spec.lastUpdated.split("T")[0]})`,
			ticketReference: `${ticket.key} (Marked Done on ${ticket.updated.split("T")[0]})`,
			specSnippet: `Authoritative spec was revised on ${spec.lastUpdated.split("T")[0]} after ticket was completed.`,
			ticketSnippet: `Ticket status is '${ticket.status}' with stale implementation from ${ticket.updated.split("T")[0]}.`,
			rootCause:
				"Engineering ticket was marked Done prior to final architectural revisions in Confluence.",
			suggestedRemediation:
				'Reopen ticket to "In Progress" or spawn remediation task before releasing to production.',
		});
	}

	// 3. Compute Release Readiness Score (0 - 100)
	let score = 100;
	for (const item of driftItems) {
		switch (item.severity) {
			case "CRITICAL":
				score -= 25;
				break;
			case "HIGH":
				score -= 14;
				break;
			case "MEDIUM":
				score -= 7;
				break;
			case "LOW":
				score -= 3;
				break;
		}
	}
	score = Math.max(0, Math.min(100, score));

	// 4. Determine Risk Level
	let riskLevel: RiskLevel = "READY_TO_RELEASE";
	const hasCritical = driftItems.some((d) => d.severity === "CRITICAL");
	const hasHigh = driftItems.some((d) => d.severity === "HIGH");

	if (score < 60 || hasCritical) {
		riskLevel = "RELEASE_BLOCKED";
	} else if (score < 85 || hasHigh) {
		riskLevel = "CONDITIONAL_APPROVAL";
	} else {
		riskLevel = "READY_TO_RELEASE";
	}

	// 5. Build Summary
	const summary =
		driftItems.length === 0
			? `All requirements from ${spec.id} (${spec.version}) are 100% synchronized with ${ticket.key}. Zero drift detected.`
			: `Detected ${driftItems.length} spec-to-ticket drift discrepancies (${driftItems.filter((d) => d.severity === "CRITICAL").length} Critical, ${driftItems.filter((d) => d.severity === "HIGH").length} High). Release readiness score is ${score}/100 [${riskLevel}].`;

	return {
		timestamp: new Date().toISOString(),
		specId: spec.id,
		specTitle: spec.title,
		ticketKey: ticket.key,
		ticketSummary: ticket.summary,
		releaseReadinessScore: score,
		riskLevel,
		driftItems,
		summary,
	};
}

export function reconcileTicketDrift(
	ticket: JiraTicket,
	driftItems: DriftItem[],
): { updatedTicket: JiraTicket; appliedRemediations: string[] } {
	// Purge legacy anti-patterns before applying new criteria
	const newCriteria = ticket.acceptanceCriteria.filter(
		(c) => !c.toLowerCase().includes("md5"),
	);
	const newSubtasks = [...ticket.subtasks];
	const applied: string[] = [];

	for (const item of driftItems) {
		if (
			item.category === "SECURITY_COMPLIANCE" ||
			item.category === "ACCEPTANCE_CRITERIA_MISMATCH" ||
			item.category === "SCOPE_CREEP_OMISSION"
		) {
			if (!newCriteria.includes(item.suggestedRemediation)) {
				newCriteria.push(item.suggestedRemediation);
				applied.push(`Added AC: "${item.suggestedRemediation}"`);
			}
		} else if (item.category === "STALE_COMPLETION") {
			const remediationSubtask = `${ticket.key}-FIX: Reconcile implementation with Confluence spec updates`;
			if (!newSubtasks.includes(remediationSubtask)) {
				newSubtasks.push(remediationSubtask);
				applied.push(`Spawned sub-task: "${remediationSubtask}"`);
			}
		}
	}

	const updatedTicket: JiraTicket = {
		...ticket,
		status:
			ticket.status === "Done" &&
			driftItems.some((d) => d.severity === "CRITICAL")
				? "In Progress"
				: ticket.status,
		updated: new Date().toISOString(),
		acceptanceCriteria: newCriteria,
		subtasks: newSubtasks,
	};

	return { updatedTicket, appliedRemediations: applied };
}

export function calculateAdjustedScore(
	originalScore: number,
	resolvedDriftItems: DriftItem[],
): { newScore: number; newRiskLevel: RiskLevel } {
	let scoreGained = 0;
	for (const item of resolvedDriftItems) {
		switch (item.severity) {
			case "CRITICAL":
				scoreGained += 25;
				break;
			case "HIGH":
				scoreGained += 14;
				break;
			case "MEDIUM":
				scoreGained += 7;
				break;
			case "LOW":
				scoreGained += 3;
				break;
		}
	}

	const newScore = Math.min(100, originalScore + scoreGained);
	let newRiskLevel: RiskLevel = "READY_TO_RELEASE";
	if (newScore < 60) {
		newRiskLevel = "RELEASE_BLOCKED";
	} else if (newScore < 85) {
		newRiskLevel = "CONDITIONAL_APPROVAL";
	} else {
		newRiskLevel = "READY_TO_RELEASE";
	}

	return { newScore, newRiskLevel };
}

export function createCustomScenario(input: CustomScenarioInput): {
	spec: SpecDocument;
	ticket: JiraTicket;
} {
	const specRequirements =
		input.specRequirements && input.specRequirements.length > 0
			? input.specRequirements
			: input.specContent
					.split("\n")
					.map((line) => line.trim())
					.filter(
						(line) =>
							line.startsWith("-") ||
							line.startsWith("*") ||
							/^\d+\./.test(line),
					)
					.map((line) => line.replace(/^[-*\d.]+\s*/, ""));

	const spec: SpecDocument = {
		id: input.specId || "CONF-CUSTOM-001",
		title: input.specTitle || "Custom PRD Specification",
		version: "v1.0",
		lastUpdated: new Date().toISOString(),
		author: "Architect (Custom)",
		sections: [
			{
				id: "sec-custom-1",
				title: "Requirements & Specifications",
				content: input.specContent,
				requirements:
					specRequirements.length > 0 ? specRequirements : [input.specContent],
			},
		],
	};

	const ticket: JiraTicket = {
		key: input.ticketKey || "CUSTOM-101",
		summary: input.ticketSummary || "Custom Feature Implementation",
		status: input.ticketStatus || "In Progress",
		assignee: input.ticketAssignee || "Engineer (Custom)",
		updated: new Date().toISOString(),
		acceptanceCriteria: input.acceptanceCriteria,
		subtasks: input.subtasks || ["Initial scoping and verification"],
	};

	return { spec, ticket };
}

export function auditCustomScenario(input: CustomScenarioInput): {
	spec: SpecDocument;
	ticket: JiraTicket;
	auditResult: AuditResult;
} {
	const { spec, ticket } = createCustomScenario(input);
	const auditResult = auditSpecTicketDrift(spec, ticket);
	return { spec, ticket, auditResult };
}

export function generateMarkdownReport(
	auditResult: AuditResult,
	spec: SpecDocument,
	ticket: JiraTicket,
): string {
	return [
		`# DriftGuard AI — Release Drift Audit Report`,
		`* **Generated:** ${auditResult.timestamp}`,
		`* **Confluence Spec:** ${spec.id} (${spec.title} - ${spec.version})`,
		`* **Jira Ticket:** ${ticket.key} (${ticket.summary})`,
		`* **Readiness Score:** ${auditResult.releaseReadinessScore} / 100`,
		`* **Risk Classification:** ${auditResult.riskLevel}`,
		``,
		`## Executive Summary`,
		`${auditResult.summary}`,
		``,
		`## Detected Drift Discrepancies (${auditResult.driftItems.length})`,
		auditResult.driftItems.length === 0
			? `* No spec drift detected. Ticket criteria are fully aligned with Confluence.`
			: auditResult.driftItems
					.map(
						(d, i) =>
							`### ${i + 1}. [${d.severity}] ${d.title}\n* **Category:** ${d.category}\n* **Spec Requirement:** ${d.specSnippet}\n* **Ticket Status:** ${d.ticketSnippet}\n* **Root Cause:** ${d.rootCause}\n* **Suggested Remediation:** \`${d.suggestedRemediation}\``,
					)
					.join("\n\n"),
	].join("\n");
}

export function generateJsonReport(
	auditResult: AuditResult,
	spec: SpecDocument,
	ticket: JiraTicket,
): string {
	return JSON.stringify(
		{
			reportType: "DRIFTGUARD_RELEASE_AUDIT_REPORT",
			version: "1.0.0",
			generatedAt: auditResult.timestamp,
			spec: {
				id: spec.id,
				title: spec.title,
				version: spec.version,
				lastUpdated: spec.lastUpdated,
				author: spec.author,
			},
			ticket: {
				key: ticket.key,
				summary: ticket.summary,
				status: ticket.status,
				assignee: ticket.assignee,
				updated: ticket.updated,
			},
			audit: {
				releaseReadinessScore: auditResult.releaseReadinessScore,
				riskLevel: auditResult.riskLevel,
				summary: auditResult.summary,
				discrepanciesCount: auditResult.driftItems.length,
				driftItems: auditResult.driftItems,
			},
		},
		null,
		2,
	);
}
