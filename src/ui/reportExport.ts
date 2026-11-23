import {
	generateJsonReport,
	generateMarkdownReport,
} from "../engine/driftEngine";
import type {
	AuditResult,
	ForgeEnvironmentStatus,
	JiraTicket,
	SpecDocument,
} from "../engine/types";

export function buildReportFilename(
	ticketKey: string,
	extension: "md" | "json",
	timestampIso?: string,
): string {
	const safeKey =
		ticketKey
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9_-]+/g, "-")
			.replace(/^-+|-+$/g, "") || "custom-ticket";
	const datePart = (timestampIso || new Date().toISOString()).slice(0, 10);
	return `driftguard-audit-${safeKey}-${datePart}.${extension}`;
}

export function createMarkdownAuditExport(
	auditResult: AuditResult,
	spec: SpecDocument,
	ticket: JiraTicket,
	envStatus: ForgeEnvironmentStatus,
): string {
	const runtimeLabel = envStatus.isForge
		? "Live Forge Cloud (@forge/bridge)"
		: "Interactive Sandbox (Standalone Client)";
	const coreMarkdown = generateMarkdownReport(auditResult, spec, ticket);
	return `${coreMarkdown}\n\n---\n* **Runtime Environment:** ${runtimeLabel}\n`;
}

export function createJsonAuditExport(
	auditResult: AuditResult,
	spec: SpecDocument,
	ticket: JiraTicket,
	envStatus: ForgeEnvironmentStatus,
): string {
	const baseJson = JSON.parse(generateJsonReport(auditResult, spec, ticket));
	return JSON.stringify(
		{
			...baseJson,
			runtimeEnvironment: {
				source: envStatus.source,
				isForge: envStatus.isForge,
				label: envStatus.isForge ? "Live Forge Cloud" : "Interactive Sandbox",
			},
		},
		null,
		2,
	);
}

export function downloadTextFile(
	content: string,
	filename: string,
	mimeType: string,
): boolean {
	if (typeof document === "undefined" || typeof URL === "undefined") {
		return false;
	}
	const blob = new Blob([content], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = filename;
	anchor.style.display = "none";
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	setTimeout(() => URL.revokeObjectURL(url), 1000);
	return true;
}
