import { useMemo, useState } from "react";
import {
	auditSpecTicketDrift,
	reconcileTicketDrift,
} from "../engine/driftEngine";
import { SCENARIOS } from "../engine/mockData";
import type { DriftItem, ScenarioDataset } from "../engine/types";

interface ChatMessage {
	id: string;
	sender: "user" | "rovo";
	text: string;
	actionCall?: {
		name: string;
		type: "READ_ONLY" | "MUTATING";
		status: "EXECUTED";
		output: string;
	};
	timestamp: string;
}

export default function App() {
	const [selectedScenarioId, setSelectedScenarioId] =
		useState<string>("scenario-fintech");
	const [scenariosState, setScenariosState] = useState<
		Record<string, ScenarioDataset>
	>(() => {
		const initial: Record<string, ScenarioDataset> = {};
		for (const sc of SCENARIOS) {
			initial[sc.id] = JSON.parse(JSON.stringify(sc));
		}
		return initial;
	});

	const [activeTab, setActiveTab] = useState<"matrix" | "context" | "rovo">(
		"matrix",
	);
	const [copiedReport, setCopiedReport] = useState(false);

	// Current Scenario & Audit
	const currentScenario = scenariosState[selectedScenarioId];
	const auditResult = useMemo(() => {
		return auditSpecTicketDrift(currentScenario.spec, currentScenario.ticket);
	}, [currentScenario]);

	// Rovo Chat Simulator State
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
		{
			id: "msg-1",
			sender: "rovo",
			text: "Hello, I am DriftGuard AI (Rovo Agent). I continuously audit your Confluence PRDs against Jira tickets to prevent release drift. How can I assist you with this feature?",
			timestamp: new Date().toLocaleTimeString(),
		},
	]);
	const [inputPrompt, setInputPrompt] = useState("");

	// Handlers
	const handleReconcileItem = (item: DriftItem) => {
		const { updatedTicket } = reconcileTicketDrift(currentScenario.ticket, [
			item,
		]);
		setScenariosState((prev) => ({
			...prev,
			[selectedScenarioId]: {
				...prev[selectedScenarioId],
				ticket: updatedTicket,
			},
		}));
	};

	const handleReconcileAll = () => {
		const { updatedTicket } = reconcileTicketDrift(
			currentScenario.ticket,
			auditResult.driftItems,
		);
		setScenariosState((prev) => ({
			...prev,
			[selectedScenarioId]: {
				...prev[selectedScenarioId],
				ticket: updatedTicket,
			},
		}));

		// Add Rovo response to chat
		setChatMessages((prev) => [
			...prev,
			{
				id: `msg-${Date.now()}-user`,
				sender: "user",
				text: "Rovo, reconcile all detected drift items for this ticket.",
				timestamp: new Date().toLocaleTimeString(),
			},
			{
				id: `msg-${Date.now()}-rovo`,
				sender: "rovo",
				text: `Reconciliation completed successfully. Updated ${currentScenario.ticket.key} acceptance criteria and resolved ${auditResult.driftItems.length} gap(s).`,
				actionCall: {
					name: "reconcile-ticket-action",
					type: "MUTATING",
					status: "EXECUTED",
					output: `Patched ${currentScenario.ticket.key} with ${auditResult.driftItems.length} authoritative criteria.`,
				},
				timestamp: new Date().toLocaleTimeString(),
			},
		]);
	};

	const handleReset = () => {
		const original = SCENARIOS.find((s) => s.id === selectedScenarioId);
		if (original) {
			setScenariosState((prev) => ({
				...prev,
				[selectedScenarioId]: JSON.parse(JSON.stringify(original)),
			}));
		}
	};

	const handleSendPrompt = (promptText?: string) => {
		const text = promptText || inputPrompt;
		if (!text.trim()) return;

		const userMsg: ChatMessage = {
			id: `msg-${Date.now()}-user`,
			sender: "user",
			text,
			timestamp: new Date().toLocaleTimeString(),
		};

		let rovoMsg: ChatMessage;
		const lower = text.toLowerCase();

		if (
			lower.includes("audit") ||
			lower.includes("drift") ||
			lower.includes("check")
		) {
			rovoMsg = {
				id: `msg-${Date.now()}-rovo`,
				sender: "rovo",
				text: `I ran 'audit-drift-action' against ${currentScenario.spec.id} and ${currentScenario.ticket.key}. Readiness score: ${auditResult.releaseReadinessScore}/100. Discrepancies found: ${auditResult.driftItems.length}.`,
				actionCall: {
					name: "audit-drift-action",
					type: "READ_ONLY",
					status: "EXECUTED",
					output: `Scanned 3 sections. Found ${auditResult.driftItems.length} drift items. Current Risk: ${auditResult.riskLevel}.`,
				},
				timestamp: new Date().toLocaleTimeString(),
			};
		} else if (
			lower.includes("reconcile") ||
			lower.includes("fix") ||
			lower.includes("sync")
		) {
			handleReconcileAll();
			setInputPrompt("");
			return;
		} else if (
			lower.includes("score") ||
			lower.includes("readiness") ||
			lower.includes("status")
		) {
			rovoMsg = {
				id: `msg-${Date.now()}-rovo`,
				sender: "rovo",
				text: `Release Readiness Score is ${auditResult.releaseReadinessScore}/100 [${auditResult.riskLevel}]. ${auditResult.riskLevel === "RELEASE_BLOCKED" ? "Production release is BLOCKED due to critical security/compliance gaps." : "Feature is in sync with requirements."}`,
				actionCall: {
					name: "generate-release-score-action",
					type: "READ_ONLY",
					status: "EXECUTED",
					output: `Score: ${auditResult.releaseReadinessScore}/100. Status: ${auditResult.riskLevel}.`,
				},
				timestamp: new Date().toLocaleTimeString(),
			};
		} else {
			rovoMsg = {
				id: `msg-${Date.now()}-rovo`,
				sender: "rovo",
				text: `I understand you are asking about ${currentScenario.ticket.key}. Confluence spec ${currentScenario.spec.id} (${currentScenario.spec.version}) is the single source of truth. Try asking me to 'Audit spec drift' or 'Reconcile ticket criteria'.`,
				timestamp: new Date().toLocaleTimeString(),
			};
		}

		setChatMessages((prev) => [...prev, userMsg, rovoMsg]);
		setInputPrompt("");
	};

	const copyMarkdownReport = () => {
		const md = [
			`# DriftGuard AI — Release Drift Audit Report`,
			`* **Generated:** ${new Date().toISOString()}`,
			`* **Confluence Spec:** ${currentScenario.spec.id} (${currentScenario.spec.title} - ${currentScenario.spec.version})`,
			`* **Jira Ticket:** ${currentScenario.ticket.key} (${currentScenario.ticket.summary})`,
			`* **Readiness Score:** ${auditResult.releaseReadinessScore} / 100`,
			`* **Risk Classification:** ${auditResult.riskLevel}`,
			``,
			`## Detected Drift Discrepancies (${auditResult.driftItems.length})`,
			auditResult.driftItems
				.map(
					(d, i) =>
						`### ${i + 1}. [${d.severity}] ${d.title}\n* **Category:** ${d.category}\n* **Spec Requirement:** ${d.specSnippet}\n* **Ticket Status:** ${d.ticketSnippet}\n* **Suggested Remediation:** \`${d.suggestedRemediation}\``,
				)
				.join("\n\n"),
		].join("\n");

		navigator.clipboard.writeText(md);
		setCopiedReport(true);
		setTimeout(() => setCopiedReport(false), 2500);
	};

	return (
		<div
			style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
		>
			{/* Top Navigation Bar */}
			<header
				style={{
					background: "var(--atlassian-navy)",
					color: "#ffffff",
					padding: "12px 24px",
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					borderBottom: "1px solid rgba(255,255,255,0.1)",
				}}
			>
				<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
					<div
						style={{
							background: "var(--atlassian-blue)",
							width: "32px",
							height: "32px",
							borderRadius: "4px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							fontWeight: 800,
							fontSize: "16px",
						}}
					>
						DG
					</div>
					<div>
						<h1
							style={{
								fontSize: "16px",
								fontWeight: 700,
								margin: 0,
								letterSpacing: "-0.2px",
							}}
						>
							DriftGuard AI
						</h1>
						<span style={{ fontSize: "11px", color: "#b3bac5" }}>
							Atlassian Forge • Rovo Autonomous Spec & Release Drift Auditor
						</span>
					</div>
				</div>

				<div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
					<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
						<span style={{ fontSize: "12px", color: "#b3bac5" }}>
							Interactive Scenario:
						</span>
						<select
							value={selectedScenarioId}
							onChange={(e) => setSelectedScenarioId(e.target.value)}
							style={{
								background: "#091e42",
								color: "#ffffff",
								border: "1px solid #4c5b76",
								borderRadius: "4px",
								padding: "6px 12px",
								fontSize: "13px",
								fontWeight: 600,
								cursor: "pointer",
							}}
						>
							{SCENARIOS.map((sc) => (
								<option key={sc.id} value={sc.id}>
									{sc.name}
								</option>
							))}
						</select>
					</div>

					<span
						className="badge badge-info"
						style={{ background: "rgba(0,101,255,0.2)", color: "#4c9aff" }}
					>
						Local Interactive Sandbox
					</span>
				</div>
			</header>

			{/* Main Container */}
			<div
				style={{
					flex: 1,
					padding: "24px",
					maxWidth: "1400px",
					margin: "0 auto",
					width: "100%",
				}}
			>
				{/* Release Readiness Score Banner */}
				<div
					className="card"
					style={{
						padding: "20px 24px",
						marginBottom: "20px",
						borderLeft: `6px solid ${
							auditResult.riskLevel === "RELEASE_BLOCKED"
								? "var(--critical-red)"
								: auditResult.riskLevel === "CONDITIONAL_APPROVAL"
									? "var(--high-orange)"
									: "var(--success-green)"
						}`,
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							flexWrap: "wrap",
							gap: "16px",
						}}
					>
						<div>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: "10px",
									marginBottom: "4px",
								}}
							>
								<span
									className={`badge ${
										auditResult.riskLevel === "RELEASE_BLOCKED"
											? "badge-critical"
											: auditResult.riskLevel === "CONDITIONAL_APPROVAL"
												? "badge-high"
												: "badge-success"
									}`}
								>
									{auditResult.riskLevel.replace(/_/g, " ")}
								</span>
								<span
									style={{ fontSize: "13px", color: "var(--atlassian-subtle)" }}
								>
									Evaluated:{" "}
									{new Date(auditResult.timestamp).toLocaleTimeString()}
								</span>
							</div>
							<h2
								style={{
									fontSize: "18px",
									fontWeight: 700,
									margin: 0,
									color: "var(--atlassian-slate)",
								}}
							>
								{currentScenario.ticket.key}: {currentScenario.ticket.summary}
							</h2>
							<p
								style={{
									fontSize: "13px",
									color: "var(--atlassian-subtle)",
									marginTop: "4px",
								}}
							>
								{auditResult.summary}
							</p>
						</div>

						<div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
							{/* Score Display */}
							<div style={{ textAlign: "center" }}>
								<div
									style={{
										fontSize: "32px",
										fontWeight: 800,
										color:
											auditResult.releaseReadinessScore >= 85
												? "var(--success-green)"
												: auditResult.releaseReadinessScore >= 60
													? "var(--high-orange)"
													: "var(--critical-red)",
										lineHeight: 1,
									}}
								>
									{auditResult.releaseReadinessScore}
									<span
										style={{
											fontSize: "16px",
											fontWeight: 500,
											color: "var(--atlassian-subtle)",
										}}
									>
										/100
									</span>
								</div>
								<span
									style={{
										fontSize: "11px",
										fontWeight: 600,
										color: "var(--atlassian-subtle)",
										textTransform: "uppercase",
									}}
								>
									Readiness Score
								</span>
							</div>

							{/* Action Buttons */}
							<div
								style={{ display: "flex", flexDirection: "column", gap: "8px" }}
							>
								{auditResult.driftItems.length > 0 && (
									<button
										onClick={handleReconcileAll}
										className="btn btn-primary"
									>
										⚡ Rovo Action: Reconcile All (
										{auditResult.driftItems.length})
									</button>
								)}
								<div style={{ display: "flex", gap: "8px" }}>
									<button
										onClick={copyMarkdownReport}
										className="btn btn-secondary"
										style={{ fontSize: "12px" }}
									>
										{copiedReport ? "✓ Copied Markdown!" : "Export Report"}
									</button>
									<button
										onClick={handleReset}
										className="btn btn-secondary"
										style={{ fontSize: "12px" }}
									>
										Reset Scenario
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Tab Navigation */}
				<div
					style={{
						display: "flex",
						gap: "4px",
						borderBottom: "1px solid var(--atlassian-border)",
						marginBottom: "20px",
					}}
				>
					<button
						onClick={() => setActiveTab("matrix")}
						style={{
							padding: "10px 18px",
							fontSize: "13px",
							fontWeight: 600,
							border: "none",
							background: "none",
							borderBottom:
								activeTab === "matrix"
									? "2px solid var(--atlassian-blue)"
									: "2px solid transparent",
							color:
								activeTab === "matrix"
									? "var(--atlassian-blue)"
									: "var(--atlassian-subtle)",
							cursor: "pointer",
						}}
					>
						Drift Analysis Matrix ({auditResult.driftItems.length})
					</button>
					<button
						onClick={() => setActiveTab("context")}
						style={{
							padding: "10px 18px",
							fontSize: "13px",
							fontWeight: 600,
							border: "none",
							background: "none",
							borderBottom:
								activeTab === "context"
									? "2px solid var(--atlassian-blue)"
									: "2px solid transparent",
							color:
								activeTab === "context"
									? "var(--atlassian-blue)"
									: "var(--atlassian-subtle)",
							cursor: "pointer",
						}}
					>
						Teamwork Graph: Spec vs Ticket Diff
					</button>
					<button
						onClick={() => setActiveTab("rovo")}
						style={{
							padding: "10px 18px",
							fontSize: "13px",
							fontWeight: 600,
							border: "none",
							background: "none",
							borderBottom:
								activeTab === "rovo"
									? "2px solid var(--atlassian-blue)"
									: "2px solid transparent",
							color:
								activeTab === "rovo"
									? "var(--atlassian-blue)"
									: "var(--atlassian-subtle)",
							cursor: "pointer",
						}}
					>
						Rovo Autonomous Agent Simulator
					</button>
				</div>

				{/* Tab Content 1: Drift Analysis Matrix */}
				{activeTab === "matrix" && (
					<div>
						{auditResult.driftItems.length === 0 ? (
							<div
								className="card"
								style={{ padding: "48px 24px", textAlign: "center" }}
							>
								<div style={{ fontSize: "40px", marginBottom: "12px" }}>🎉</div>
								<h3
									style={{
										fontSize: "18px",
										fontWeight: 700,
										color: "var(--success-green)",
										marginBottom: "8px",
									}}
								>
									Zero Spec Drift Detected!
								</h3>
								<p
									style={{
										fontSize: "14px",
										color: "var(--atlassian-subtle)",
										maxWidth: "560px",
										margin: "0 auto",
									}}
								>
									The Jira ticket acceptance criteria perfectly mirror the
									authoritative Confluence specification. All compliance and
									security rules are verified.
								</p>
							</div>
						) : (
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "16px",
								}}
							>
								{auditResult.driftItems.map((item) => (
									<div
										key={item.id}
										className="card"
										style={{ padding: "18px 20px" }}
									>
										<div
											style={{
												display: "flex",
												alignItems: "flex-start",
												justifyContent: "space-between",
												gap: "16px",
												marginBottom: "12px",
											}}
										>
											<div>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														gap: "8px",
														marginBottom: "4px",
													}}
												>
													<span
														className={`badge ${
															item.severity === "CRITICAL"
																? "badge-critical"
																: item.severity === "HIGH"
																	? "badge-high"
																	: "badge-medium"
														}`}
													>
														{item.severity}
													</span>
													<span
														className="badge badge-info"
														style={{ fontSize: "10px" }}
													>
														{item.category.replace(/_/g, " ")}
													</span>
												</div>
												<h4
													style={{
														fontSize: "15px",
														fontWeight: 700,
														color: "var(--atlassian-slate)",
													}}
												>
													{item.title}
												</h4>
											</div>

											<button
												onClick={() => handleReconcileItem(item)}
												className="btn btn-secondary"
												style={{ fontSize: "12px", whiteSpace: "nowrap" }}
											>
												⚡ Reconcile Item
											</button>
										</div>

										<p
											style={{
												fontSize: "13px",
												color: "var(--atlassian-slate)",
												marginBottom: "14px",
											}}
										>
											<strong>Root Cause:</strong> {item.rootCause}
										</p>

										{/* Diff View Box */}
										<div
											style={{
												display: "grid",
												gridTemplateColumns: "1fr 1fr",
												gap: "12px",
												background: "var(--atlassian-bg-subtle)",
												padding: "12px",
												borderRadius: "4px",
												fontSize: "12px",
												marginBottom: "12px",
											}}
										>
											<div>
												<div
													style={{
														fontWeight: 700,
														color: "var(--atlassian-subtle)",
														marginBottom: "4px",
													}}
												>
													📄 Confluence Authority ({item.specReference}):
												</div>
												<code
													style={{
														color: "var(--atlassian-navy)",
														display: "block",
														background: "#ffffff",
														padding: "8px",
														borderRadius: "3px",
														border: "1px solid var(--atlassian-border)",
													}}
												>
													{item.specSnippet}
												</code>
											</div>
											<div>
												<div
													style={{
														fontWeight: 700,
														color: "var(--atlassian-subtle)",
														marginBottom: "4px",
													}}
												>
													🎫 Jira Reality ({item.ticketReference}):
												</div>
												<code
													style={{
														color: "var(--critical-red)",
														display: "block",
														background: "#ffffff",
														padding: "8px",
														borderRadius: "3px",
														border: "1px solid var(--atlassian-border)",
													}}
												>
													{item.ticketSnippet}
												</code>
											</div>
										</div>

										<div
											style={{
												fontSize: "12px",
												color: "var(--success-green)",
												background: "var(--success-bg)",
												padding: "8px 12px",
												borderRadius: "4px",
											}}
										>
											<strong>Suggested Rovo Remediation:</strong>{" "}
											{item.suggestedRemediation}
										</div>
									</div>
								))}
							</div>
						)}
					</div>
				)}

				{/* Tab Content 2: Teamwork Graph Spec vs Ticket Diff */}
				{activeTab === "context" && (
					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr",
							gap: "20px",
						}}
					>
						{/* Left: Confluence Spec */}
						<div className="card" style={{ padding: "20px" }}>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: "14px",
									borderBottom: "1px solid var(--atlassian-border)",
									paddingBottom: "10px",
								}}
							>
								<div>
									<span
										className="badge badge-info"
										style={{ marginBottom: "4px" }}
									>
										CONFLUENCE SPECIFICATION
									</span>
									<h3 style={{ fontSize: "16px", fontWeight: 700 }}>
										{currentScenario.spec.title}
									</h3>
									<span
										style={{
											fontSize: "12px",
											color: "var(--atlassian-subtle)",
										}}
									>
										{currentScenario.spec.id} • {currentScenario.spec.version} •
										by {currentScenario.spec.author}
									</span>
								</div>
							</div>

							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: "16px",
								}}
							>
								{currentScenario.spec.sections.map((sec) => (
									<div
										key={sec.id}
										style={{
											background: "var(--atlassian-bg-subtle)",
											padding: "12px",
											borderRadius: "4px",
										}}
									>
										<h5
											style={{
												fontSize: "13px",
												fontWeight: 700,
												marginBottom: "6px",
												color: "var(--atlassian-blue)",
											}}
										>
											§ {sec.title}
										</h5>
										<p
											style={{
												fontSize: "12px",
												marginBottom: "8px",
												color: "var(--atlassian-slate)",
											}}
										>
											{sec.content}
										</p>
										<div
											style={{
												fontSize: "11px",
												fontWeight: 700,
												color: "var(--atlassian-subtle)",
												marginBottom: "4px",
											}}
										>
											Requirements:
										</div>
										<ul
											style={{
												paddingLeft: "18px",
												fontSize: "12px",
												display: "flex",
												flexDirection: "column",
												gap: "3px",
											}}
										>
											{sec.requirements.map((r, ri) => (
												<li
													key={ri}
													style={{ color: "var(--atlassian-slate)" }}
												>
													{r}
												</li>
											))}
										</ul>
									</div>
								))}
							</div>
						</div>

						{/* Right: Jira Ticket */}
						<div className="card" style={{ padding: "20px" }}>
							<div
								style={{
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
									marginBottom: "14px",
									borderBottom: "1px solid var(--atlassian-border)",
									paddingBottom: "10px",
								}}
							>
								<div>
									<span
										className="badge badge-info"
										style={{ marginBottom: "4px" }}
									>
										JIRA SOFTWARE TICKET
									</span>
									<h3 style={{ fontSize: "16px", fontWeight: 700 }}>
										{currentScenario.ticket.key}:{" "}
										{currentScenario.ticket.summary}
									</h3>
									<span
										style={{
											fontSize: "12px",
											color: "var(--atlassian-subtle)",
										}}
									>
										Assignee: {currentScenario.ticket.assignee} • Status:{" "}
										<strong>{currentScenario.ticket.status}</strong>
									</span>
								</div>
							</div>

							<div>
								<h5
									style={{
										fontSize: "13px",
										fontWeight: 700,
										marginBottom: "10px",
									}}
								>
									Current Acceptance Criteria (
									{currentScenario.ticket.acceptanceCriteria.length}):
								</h5>
								<div
									style={{
										display: "flex",
										flexDirection: "column",
										gap: "6px",
										marginBottom: "16px",
									}}
								>
									{currentScenario.ticket.acceptanceCriteria.map((ac, aci) => (
										<div
											key={aci}
											style={{
												padding: "8px 12px",
												borderRadius: "4px",
												fontSize: "12px",
												border: "1px solid var(--atlassian-border)",
												background: ac.toLowerCase().includes("md5")
													? "var(--critical-bg)"
													: "#ffffff",
												color: ac.toLowerCase().includes("md5")
													? "var(--critical-red)"
													: "var(--atlassian-slate)",
											}}
										>
											✓ {ac}
										</div>
									))}
								</div>

								<h5
									style={{
										fontSize: "13px",
										fontWeight: 700,
										marginBottom: "8px",
									}}
								>
									Linked Subtasks ({currentScenario.ticket.subtasks.length}):
								</h5>
								<ul
									style={{
										paddingLeft: "18px",
										fontSize: "12px",
										display: "flex",
										flexDirection: "column",
										gap: "4px",
									}}
								>
									{currentScenario.ticket.subtasks.map((st, sti) => (
										<li key={sti} style={{ color: "var(--atlassian-subtle)" }}>
											{st}
										</li>
									))}
								</ul>
							</div>
						</div>
					</div>
				)}

				{/* Tab Content 3: Rovo Autonomous Agent Simulator */}
				{activeTab === "rovo" && (
					<div
						className="card"
						style={{
							display: "flex",
							flexDirection: "column",
							height: "620px",
						}}
					>
						{/* Chat Header */}
						<div
							style={{
								padding: "14px 20px",
								borderBottom: "1px solid var(--atlassian-border)",
								display: "flex",
								alignItems: "center",
								justifyContent: "space-between",
								background: "var(--atlassian-bg-subtle)",
							}}
						>
							<div
								style={{ display: "flex", alignItems: "center", gap: "10px" }}
							>
								<div
									style={{
										width: "28px",
										height: "28px",
										borderRadius: "50%",
										background: "var(--atlassian-blue)",
										color: "#ffffff",
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
										fontWeight: 700,
										fontSize: "12px",
									}}
								>
									R
								</div>
								<div>
									<h4 style={{ fontSize: "14px", fontWeight: 700, margin: 0 }}>
										DriftGuard AI (Rovo Agent)
									</h4>
									<span
										style={{
											fontSize: "11px",
											color: "var(--atlassian-subtle)",
										}}
									>
										Manifest Module:{" "}
										<code style={{ fontSize: "10px" }}>
											rovo:agent/drift-guard-agent
										</code>
									</span>
								</div>
							</div>

							<div style={{ display: "flex", gap: "8px" }}>
								<button
									onClick={() =>
										handleSendPrompt(
											"Audit current issue against Confluence spec",
										)
									}
									className="btn btn-secondary"
									style={{ fontSize: "11px", padding: "4px 8px" }}
								>
									Run Audit
								</button>
								<button
									onClick={() =>
										handleSendPrompt("Reconcile ticket criteria now")
									}
									className="btn btn-secondary"
									style={{ fontSize: "11px", padding: "4px 8px" }}
								>
									Reconcile Ticket
								</button>
								<button
									onClick={() =>
										handleSendPrompt("What is the release readiness score?")
									}
									className="btn btn-secondary"
									style={{ fontSize: "11px", padding: "4px 8px" }}
								>
									Check Score
								</button>
							</div>
						</div>

						{/* Chat Messages */}
						<div
							style={{
								flex: 1,
								padding: "20px",
								overflowY: "auto",
								display: "flex",
								flexDirection: "column",
								gap: "14px",
							}}
						>
							{chatMessages.map((msg) => (
								<div
									key={msg.id}
									style={{
										alignSelf:
											msg.sender === "user" ? "flex-end" : "flex-start",
										maxWidth: "80%",
									}}
								>
									<div
										style={{
											padding: "10px 14px",
											borderRadius: "6px",
											fontSize: "13px",
											background:
												msg.sender === "user"
													? "var(--atlassian-blue)"
													: "var(--atlassian-bg-subtle)",
											color:
												msg.sender === "user"
													? "#ffffff"
													: "var(--atlassian-slate)",
											border:
												msg.sender === "user"
													? "none"
													: "1px solid var(--atlassian-border)",
										}}
									>
										{msg.text}

										{msg.actionCall && (
											<div
												style={{
													marginTop: "8px",
													padding: "8px 10px",
													background: "#ffffff",
													border: "1px solid var(--atlassian-border)",
													borderRadius: "4px",
													fontSize: "11px",
													color: "var(--atlassian-navy)",
												}}
											>
												<div
													style={{
														display: "flex",
														alignItems: "center",
														justifyContent: "space-between",
														marginBottom: "3px",
													}}
												>
													<span
														style={{
															fontWeight: 700,
															color: "var(--atlassian-blue)",
														}}
													>
														⚡ Action: {msg.actionCall.name}
													</span>
													<span
														className={`badge ${msg.actionCall.type === "MUTATING" ? "badge-high" : "badge-info"}`}
														style={{ fontSize: "9px" }}
													>
														{msg.actionCall.type}
													</span>
												</div>
												<div style={{ color: "var(--atlassian-subtle)" }}>
													{msg.actionCall.output}
												</div>
											</div>
										)}
									</div>
									<div
										style={{
											fontSize: "10px",
											color: "var(--atlassian-subtle)",
											marginTop: "2px",
											textAlign: msg.sender === "user" ? "right" : "left",
										}}
									>
										{msg.timestamp}
									</div>
								</div>
							))}
						</div>

						{/* Chat Input */}
						<form
							onSubmit={(e) => {
								e.preventDefault();
								handleSendPrompt();
							}}
							style={{
								padding: "12px 16px",
								borderTop: "1px solid var(--atlassian-border)",
								display: "flex",
								gap: "10px",
								background: "#ffffff",
							}}
						>
							<input
								type="text"
								placeholder="Ask Rovo Agent to audit, reconcile, or check release readiness..."
								value={inputPrompt}
								onChange={(e) => setInputPrompt(e.target.value)}
								style={{
									flex: 1,
									padding: "8px 12px",
									borderRadius: "4px",
									border: "1px solid var(--atlassian-border)",
									fontSize: "13px",
									outline: "none",
								}}
							/>
							<button
								type="submit"
								className="btn btn-primary"
								style={{ padding: "8px 16px" }}
							>
								Send
							</button>
						</form>
					</div>
				)}
			</div>
		</div>
	);
}
