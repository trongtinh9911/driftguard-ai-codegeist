import {
	auditSpecTicketDrift,
	calculateAdjustedScore,
	reconcileTicketDrift,
} from "./driftEngine";
import { SCENARIOS } from "./mockData";
import type {
	AuditResult,
	ReconcileRequest,
	ReconcileResponse,
	ScenarioDataset,
} from "./types";

// In-memory session state for Forge / Local Sandbox execution
const activeScenarios = new Map<string, ScenarioDataset>();

// Initialize default scenarios
for (const sc of SCENARIOS) {
	activeScenarios.set(sc.id, JSON.parse(JSON.stringify(sc)));
}

export function getScenario(
	scenarioId: string = "scenario-fintech",
): ScenarioDataset {
	const sc = activeScenarios.get(scenarioId);
	if (!sc) {
		return SCENARIOS[0];
	}
	return sc;
}

export function resetScenarios(): void {
	activeScenarios.clear();
	for (const sc of SCENARIOS) {
		activeScenarios.set(sc.id, JSON.parse(JSON.stringify(sc)));
	}
}

/**
 * Rovo Action Handler: audit-drift-action
 * Callable by Rovo LLM during conversation or via Forge invocation
 */
export async function auditDriftHandler(payload: {
	scenarioId?: string;
	specId?: string;
	ticketKey?: string;
}): Promise<AuditResult> {
	const scenario = getScenario(payload.scenarioId);
	const result = auditSpecTicketDrift(scenario.spec, scenario.ticket);
	return result;
}

/**
 * Rovo Action Handler: reconcile-ticket-action
 * Automatically patches acceptance criteria or adds subtasks in Jira ticket
 */
export async function reconcileTicketHandler(
	payload: ReconcileRequest & { scenarioId?: string },
): Promise<ReconcileResponse> {
	const scenario = getScenario(payload.scenarioId);
	const auditBefore = auditSpecTicketDrift(scenario.spec, scenario.ticket);

	// Filter selected drift items to reconcile
	const itemsToReconcile =
		payload.driftItemIds && payload.driftItemIds.length > 0
			? auditBefore.driftItems.filter((item) =>
					payload.driftItemIds.includes(item.id),
				)
			: auditBefore.driftItems;

	const { updatedTicket, appliedRemediations } = reconcileTicketDrift(
		scenario.ticket,
		itemsToReconcile,
	);
	scenario.ticket = updatedTicket;

	const { newScore, newRiskLevel } = calculateAdjustedScore(
		auditBefore.releaseReadinessScore,
		itemsToReconcile,
	);

	return {
		success: true,
		updatedTicketKey: scenario.ticket.key,
		appliedRemediations,
		auditTimestamp: new Date().toISOString(),
		previousScore: auditBefore.releaseReadinessScore,
		newReadinessScore: newScore,
		newRiskLevel,
	};
}

/**
 * Rovo Action Handler: generate-release-score-action
 * Computes release readiness score and classification
 */
export async function generateReleaseScoreHandler(payload: {
	scenarioId?: string;
}): Promise<{
	score: number;
	riskLevel: string;
	criticalGaps: number;
	highGaps: number;
	recommendation: string;
}> {
	const scenario = getScenario(payload.scenarioId);
	const audit = auditSpecTicketDrift(scenario.spec, scenario.ticket);

	const criticalGaps = audit.driftItems.filter(
		(d) => d.severity === "CRITICAL",
	).length;
	const highGaps = audit.driftItems.filter((d) => d.severity === "HIGH").length;

	let recommendation = "Safe to release to production.";
	if (audit.riskLevel === "RELEASE_BLOCKED") {
		recommendation = `RELEASE BLOCKED: Found ${criticalGaps} critical security/architectural gap(s). Mandatory remediation required before deployment.`;
	} else if (audit.riskLevel === "CONDITIONAL_APPROVAL") {
		recommendation = `CONDITIONAL APPROVAL: ${highGaps} high severity discrepancy detected. Requires explicit Release Manager sign-off.`;
	}

	return {
		score: audit.releaseReadinessScore,
		riskLevel: audit.riskLevel,
		criticalGaps,
		highGaps,
		recommendation,
	};
}

/**
 * Forge Custom UI Resolver Handler
 */
export async function resolverHandler(req: {
	call?: { functionKey: string; payload: any };
}): Promise<any> {
	const fnKey = req.call?.functionKey;
	const payload = req.call?.payload || {};

	switch (fnKey) {
		case "auditDrift":
			return await auditDriftHandler(payload);
		case "reconcileTicket":
			return await reconcileTicketHandler(payload);
		case "generateReleaseScore":
			return await generateReleaseScoreHandler(payload);
		default:
			return { error: `Unknown resolver functionKey: ${fnKey}` };
	}
}
