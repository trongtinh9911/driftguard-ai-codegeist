export type DriftSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type DriftCategory =
	| "SECURITY_COMPLIANCE"
	| "ACCEPTANCE_CRITERIA_MISMATCH"
	| "SCOPE_CREEP_OMISSION"
	| "STALE_COMPLETION";

export type RiskLevel =
	| "READY_TO_RELEASE"
	| "CONDITIONAL_APPROVAL"
	| "RELEASE_BLOCKED";

export interface SpecSection {
	id: string;
	title: string;
	content: string;
	requirements: string[];
}

export interface SpecDocument {
	id: string;
	title: string;
	version: string;
	lastUpdated: string;
	author: string;
	sections: SpecSection[];
}

export interface JiraTicket {
	key: string;
	summary: string;
	status: "To Do" | "In Progress" | "In Review" | "Done";
	assignee: string;
	updated: string;
	acceptanceCriteria: string[];
	subtasks: string[];
}

export interface DriftItem {
	id: string;
	title: string;
	category: DriftCategory;
	severity: DriftSeverity;
	specReference: string;
	ticketReference: string;
	specSnippet: string;
	ticketSnippet: string;
	rootCause: string;
	suggestedRemediation: string;
	reconciled?: boolean;
}

export interface AuditResult {
	timestamp: string;
	specId: string;
	specTitle: string;
	ticketKey: string;
	ticketSummary: string;
	releaseReadinessScore: number; // 0 - 100
	riskLevel: RiskLevel;
	driftItems: DriftItem[];
	summary: string;
}

export interface ReconcileRequest {
	ticketKey: string;
	driftItemIds: string[];
	customNote?: string;
}

export interface ReconcileResponse {
	success: boolean;
	updatedTicketKey: string;
	appliedRemediations: string[];
	auditTimestamp: string;
	previousScore: number;
	newReadinessScore: number;
	newRiskLevel: RiskLevel;
}

export interface ScenarioDataset {
	id: string;
	name: string;
	description: string;
	spec: SpecDocument;
	ticket: JiraTicket;
}
