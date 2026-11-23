import { describe, expect, it } from "vitest";
import {
	auditSpecTicketDrift,
	calculateAdjustedScore,
	reconcileTicketDrift,
} from "../engine/driftEngine";
import { SCENARIOS } from "../engine/mockData";

describe("DriftGuard AI Engine - Unit Tests", () => {
	const fintech = SCENARIOS.find((s) => s.id === "scenario-fintech")!;
	const ecommerce = SCENARIOS.find((s) => s.id === "scenario-ecommerce")!;
	const sso = SCENARIOS.find((s) => s.id === "scenario-sso")!;

	it("detects critical cryptographic drift (HMAC-SHA256 vs MD5) and blocks release", () => {
		const audit = auditSpecTicketDrift(fintech.spec, fintech.ticket);

		expect(audit.specId).toBe("CONF-PRD-882");
		expect(audit.ticketKey).toBe("FIN-104");
		expect(audit.riskLevel).toBe("RELEASE_BLOCKED");
		expect(audit.releaseReadinessScore).toBeLessThan(60);

		const hmacDrift = audit.driftItems.find((d) =>
			d.title.includes("Signature Algorithm"),
		);
		expect(hmacDrift).toBeDefined();
		expect(hmacDrift?.severity).toBe("CRITICAL");
		expect(hmacDrift?.category).toBe("SECURITY_COMPLIANCE");

		const staleDoneDrift = audit.driftItems.find(
			(d) => d.category === "STALE_COMPLETION",
		);
		expect(staleDoneDrift).toBeDefined();
		expect(staleDoneDrift?.severity).toBe("CRITICAL");
	});

	it("identifies PCI-DSS cardholder data handling gaps in checkout flow", () => {
		const audit = auditSpecTicketDrift(ecommerce.spec, ecommerce.ticket);

		expect(audit.specId).toBe("CONF-PRD-401");
		expect(audit.ticketKey).toBe("CHECK-209");
		expect(audit.riskLevel).toBe("RELEASE_BLOCKED"); // Due to critical CVV gap

		const cvvDrift = audit.driftItems.find((d) =>
			d.title.includes("Cardholder Data (CVV)"),
		);
		expect(cvvDrift).toBeDefined();
		expect(cvvDrift?.severity).toBe("CRITICAL");

		const logDrift = audit.driftItems.find((d) =>
			d.title.includes("Telemetry Log"),
		);
		expect(logDrift).toBeDefined();
		expect(logDrift?.severity).toBe("HIGH");
	});

	it("verifies 100% aligned spec and ticket achieves READY_TO_RELEASE status", () => {
		const audit = auditSpecTicketDrift(sso.spec, sso.ticket);

		expect(audit.specId).toBe("CONF-PRD-119");
		expect(audit.ticketKey).toBe("AUTH-55");
		expect(audit.driftItems.length).toBe(0);
		expect(audit.releaseReadinessScore).toBe(100);
		expect(audit.riskLevel).toBe("READY_TO_RELEASE");
	});

	it("reconciles ticket criteria by purging anti-patterns and appending spec remediations", () => {
		const audit = auditSpecTicketDrift(fintech.spec, fintech.ticket);
		const { updatedTicket, appliedRemediations } = reconcileTicketDrift(
			fintech.ticket,
			audit.driftItems,
		);

		expect(appliedRemediations.length).toBeGreaterThan(0);

		// MD5 must be eradicated
		const hasMd5 = updatedTicket.acceptanceCriteria.some((ac) =>
			ac.toLowerCase().includes("md5"),
		);
		expect(hasMd5).toBe(false);

		// Stale Done status should be reverted to In Progress
		expect(updatedTicket.status).toBe("In Progress");

		// New HMAC and Idempotency criteria must exist
		const hasHmac = updatedTicket.acceptanceCriteria.some((ac) =>
			ac.includes("HMAC-SHA256"),
		);
		expect(hasHmac).toBe(true);

		// Score adjustment after reconciliation
		const { newScore, newRiskLevel } = calculateAdjustedScore(
			audit.releaseReadinessScore,
			audit.driftItems,
		);
		expect(newScore).toBe(100);
		expect(newRiskLevel).toBe("READY_TO_RELEASE");
	});
});
