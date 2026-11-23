import { beforeEach, describe, expect, it } from "vitest";
import {
	auditDriftHandler,
	generateReleaseScoreHandler,
	reconcileTicketHandler,
	resetScenarios,
	resolverHandler,
} from "../engine/rovoActions";

describe("Atlassian Rovo Actions & Resolver Handlers", () => {
	beforeEach(() => {
		resetScenarios();
	});

	it("handles audit-drift-action invocation seamlessly", async () => {
		const result = await auditDriftHandler({ scenarioId: "scenario-fintech" });
		expect(result.specId).toBe("CONF-PRD-882");
		expect(result.ticketKey).toBe("FIN-104");
		expect(result.driftItems.length).toBeGreaterThan(0);
		expect(result.riskLevel).toBe("RELEASE_BLOCKED");
	});

	it("executes reconcile-ticket-action mutating ticket state and recalculating score", async () => {
		const auditInitial = await auditDriftHandler({
			scenarioId: "scenario-fintech",
		});
		const response = await reconcileTicketHandler({
			scenarioId: "scenario-fintech",
			ticketKey: "FIN-104",
			driftItemIds: auditInitial.driftItems.map((d) => d.id),
		});

		expect(response.success).toBe(true);
		expect(response.updatedTicketKey).toBe("FIN-104");
		expect(response.newReadinessScore).toBe(100);
		expect(response.newRiskLevel).toBe("READY_TO_RELEASE");
		expect(response.appliedRemediations.length).toBeGreaterThan(0);
	});

	it("evaluates release readiness score and outputs human-actionable recommendation", async () => {
		const scoreReport = await generateReleaseScoreHandler({
			scenarioId: "scenario-fintech",
		});
		expect(scoreReport.score).toBeLessThan(60);
		expect(scoreReport.riskLevel).toBe("RELEASE_BLOCKED");
		expect(scoreReport.criticalGaps).toBeGreaterThan(0);
		expect(scoreReport.recommendation).toContain("RELEASE BLOCKED");
	});

	it("routes Forge custom UI resolver calls correctly", async () => {
		const auditRes = await resolverHandler({
			call: {
				functionKey: "auditDrift",
				payload: { scenarioId: "scenario-sso" },
			},
		});
		expect(auditRes.specId).toBe("CONF-PRD-119");
		expect(auditRes.riskLevel).toBe("READY_TO_RELEASE");

		const errRes = await resolverHandler({
			call: { functionKey: "nonExistentAction", payload: {} },
		});
		expect(errRes.error).toBeDefined();
	});
});
