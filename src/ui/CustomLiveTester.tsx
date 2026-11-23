import type { AuditResult, DriftItem, JiraTicket } from "../engine/types";
import {
	CUSTOM_TESTER_PRESETS,
	type CustomPrdDraft,
	type CustomTicketDraft,
} from "./customParser";

interface CustomLiveTesterProps {
	prdDraft: CustomPrdDraft;
	ticketDraft: CustomTicketDraft;
	activePresetId: string | null;
	auditResult: AuditResult;
	onChangePrd: (next: CustomPrdDraft) => void;
	onChangeTicket: (next: CustomTicketDraft) => void;
	onSelectPreset: (presetId: string) => void;
	onClearBlank: () => void;
	onReconcileItem: (item: DriftItem) => void;
	onReconcileAll: () => void;
	onExportMarkdown: () => void;
	onExportJson: () => void;
}

export default function CustomLiveTester({
	prdDraft,
	ticketDraft,
	activePresetId,
	auditResult,
	onChangePrd,
	onChangeTicket,
	onSelectPreset,
	onClearBlank,
	onReconcileItem,
	onReconcileAll,
	onExportMarkdown,
	onExportJson,
}: CustomLiveTesterProps) {
	return (
		<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
			{/* Live Tester Control Strip */}
			<div
				className="card"
				style={{
					padding: "16px 20px",
					display: "flex",
					flexDirection: "column",
					gap: "12px",
				}}
			>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						flexWrap: "wrap",
						gap: "10px",
					}}
				>
					<div>
						<div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
							<span className="badge badge-info">REAL-TIME ENGINE TESTER</span>
							<span
								style={{
									fontSize: "12px",
									color: "var(--atlassian-subtle)",
								}}
							>
								Paste any Confluence PRD &amp; Jira Ticket below — scores update
								instantly on every edit.
							</span>
						</div>
					</div>
					<div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
						<button
							type="button"
							onClick={onExportMarkdown}
							className="btn btn-secondary btn-sm"
						>
							Export .md
						</button>
						<button
							type="button"
							onClick={onExportJson}
							className="btn btn-secondary btn-sm"
						>
							Export .json
						</button>
						<button
							type="button"
							onClick={onClearBlank}
							className="btn btn-secondary btn-sm"
						>
							Clear Blank
						</button>
					</div>
				</div>

				{/* Preset Templates Row */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "8px",
						flexWrap: "wrap",
					}}
				>
					<span
						style={{
							fontSize: "11px",
							fontWeight: 700,
							color: "var(--atlassian-subtle)",
							textTransform: "uppercase",
						}}
					>
						Quick Presets:
					</span>
					{CUSTOM_TESTER_PRESETS.map((preset) => (
						<button
							key={preset.id}
							type="button"
							title={preset.description}
							onClick={() => onSelectPreset(preset.id)}
							className={`preset-pill ${
								activePresetId === preset.id ? "preset-pill-active" : ""
							}`}
						>
							{preset.label}
						</button>
					))}
				</div>

				{/* Supported Live Rules Hint */}
				<div
					style={{
						fontSize: "11px",
						color: "var(--atlassian-subtle)",
						background: "var(--atlassian-bg-subtle)",
						padding: "8px 12px",
						borderRadius: "4px",
					}}
				>
					<strong>Active Engine Checks:</strong> Cryptographic Signatures (
					<code>HMAC-SHA256</code> vs legacy <code>MD5</code>/<code>SHA-1</code>
					) • Idempotency &amp; Replay Defense (<code>Redis</code> /{" "}
					<code>Idempotency-Key</code>) • Burst Rate Limiting (
					<code>100 req/sec</code> / <code>429</code>) • PCI-DSS Cardholder Data
					(<code>CVV</code> / <code>zero-PAN</code>) • Telemetry Log
					Sanitization (<code>PII scrub</code> / <code>CloudWatch</code>) •
					Stale <code>Done</code> Status Detection.
				</div>
			</div>

			{/* Side-by-Side Confluence PRD & Jira Ticket Editors */}
			<div className="tester-grid">
				{/* Left: Confluence PRD Editor */}
				<div
					className="card"
					style={{
						padding: "18px 20px",
						display: "flex",
						flexDirection: "column",
						gap: "12px",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							borderBottom: "1px solid var(--atlassian-border)",
							paddingBottom: "10px",
						}}
					>
						<div>
							<span
								className="badge badge-info"
								style={{ marginBottom: "4px" }}
							>
								CONFLUENCE PRD INPUT
							</span>
							<h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
								Authoritative Specification
							</h3>
						</div>
						<span
							style={{ fontSize: "11px", color: "var(--atlassian-subtle)" }}
						>
							Markdown or plain text
						</span>
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: "10px",
						}}
					>
						<label className="field-group">
							<span className="field-label">Spec ID</span>
							<input
								type="text"
								className="field-input"
								value={prdDraft.id}
								onChange={(e) =>
									onChangePrd({ ...prdDraft, id: e.target.value })
								}
								placeholder="CONF-PRD-901"
							/>
						</label>
						<label className="field-group">
							<span className="field-label">Version</span>
							<input
								type="text"
								className="field-input"
								value={prdDraft.version}
								onChange={(e) =>
									onChangePrd({ ...prdDraft, version: e.target.value })
								}
								placeholder="v2.5"
							/>
						</label>
						<label className="field-group">
							<span className="field-label">Spec Updated</span>
							<input
								type="date"
								className="field-input"
								value={prdDraft.lastUpdated}
								onChange={(e) =>
									onChangePrd({ ...prdDraft, lastUpdated: e.target.value })
								}
							/>
						</label>
					</div>

					<label className="field-group">
						<span className="field-label">PRD Title</span>
						<input
							type="text"
							className="field-input"
							value={prdDraft.title}
							onChange={(e) =>
								onChangePrd({ ...prdDraft, title: e.target.value })
							}
							placeholder="Payment Webhook Architecture Specification"
						/>
					</label>

					<label className="field-group" style={{ flex: 1 }}>
						<span className="field-label">
							Confluence PRD Content &amp; Requirements
						</span>
						<textarea
							className="field-textarea"
							rows={13}
							value={prdDraft.body}
							onChange={(e) =>
								onChangePrd({ ...prdDraft, body: e.target.value })
							}
							placeholder="Paste any Confluence PRD sections, security rules, or bullet requirements here..."
						/>
					</label>
				</div>

				{/* Right: Jira Ticket Editor */}
				<div
					className="card"
					style={{
						padding: "18px 20px",
						display: "flex",
						flexDirection: "column",
						gap: "12px",
					}}
				>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							borderBottom: "1px solid var(--atlassian-border)",
							paddingBottom: "10px",
						}}
					>
						<div>
							<span
								className="badge badge-info"
								style={{ marginBottom: "4px" }}
							>
								JIRA TICKET INPUT
							</span>
							<h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
								Engineering Implementation Criteria
							</h3>
						</div>
						<span
							style={{ fontSize: "11px", color: "var(--atlassian-subtle)" }}
						>
							One criterion per line
						</span>
					</div>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "1fr 1fr 1fr",
							gap: "10px",
						}}
					>
						<label className="field-group">
							<span className="field-label">Ticket Key</span>
							<input
								type="text"
								className="field-input"
								value={ticketDraft.key}
								onChange={(e) =>
									onChangeTicket({ ...ticketDraft, key: e.target.value })
								}
								placeholder="BILL-404"
							/>
						</label>
						<label className="field-group">
							<span className="field-label">Status</span>
							<select
								className="field-select"
								value={ticketDraft.status}
								onChange={(e) =>
									onChangeTicket({
										...ticketDraft,
										status: e.target.value as JiraTicket["status"],
									})
								}
							>
								<option value="To Do">To Do</option>
								<option value="In Progress">In Progress</option>
								<option value="In Review">In Review</option>
								<option value="Done">Done</option>
							</select>
						</label>
						<label className="field-group">
							<span className="field-label">Ticket Updated</span>
							<input
								type="date"
								className="field-input"
								value={ticketDraft.updated}
								onChange={(e) =>
									onChangeTicket({ ...ticketDraft, updated: e.target.value })
								}
							/>
						</label>
					</div>

					<label className="field-group">
						<span className="field-label">Ticket Summary</span>
						<input
							type="text"
							className="field-input"
							value={ticketDraft.summary}
							onChange={(e) =>
								onChangeTicket({ ...ticketDraft, summary: e.target.value })
							}
							placeholder="Implement Partner Billing Webhook Receiver"
						/>
					</label>

					<label className="field-group">
						<span className="field-label">Acceptance Criteria</span>
						<textarea
							className="field-textarea"
							rows={8}
							value={ticketDraft.acceptanceCriteriaText}
							onChange={(e) =>
								onChangeTicket({
									...ticketDraft,
									acceptanceCriteriaText: e.target.value,
								})
							}
							placeholder="- Paste Jira acceptance criteria lines here..."
						/>
					</label>

					<label className="field-group">
						<span className="field-label">Linked Subtasks (Optional)</span>
						<textarea
							className="field-textarea"
							rows={3}
							value={ticketDraft.subtasksText}
							onChange={(e) =>
								onChangeTicket({
									...ticketDraft,
									subtasksText: e.target.value,
								})
							}
							placeholder="- BILL-405: Express route handler"
						/>
					</label>
				</div>
			</div>

			{/* Real-Time Drift Analysis Output for Custom Input */}
			<div className="card" style={{ padding: "18px 20px" }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						flexWrap: "wrap",
						gap: "12px",
						marginBottom: "14px",
						paddingBottom: "12px",
						borderBottom: "1px solid var(--atlassian-border)",
					}}
				>
					<div>
						<h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
							Live Drift Engine Output ({auditResult.driftItems.length}{" "}
							{auditResult.driftItems.length === 1 ? "Finding" : "Findings"})
						</h3>
						<p
							style={{
								fontSize: "12px",
								color: "var(--atlassian-subtle)",
								marginTop: "2px",
							}}
						>
							{auditResult.summary}
						</p>
					</div>

					<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
						<span
							className={`badge ${
								auditResult.riskLevel === "RELEASE_BLOCKED"
									? "badge-critical"
									: auditResult.riskLevel === "CONDITIONAL_APPROVAL"
										? "badge-high"
										: "badge-success"
							}`}
						>
							Score {auditResult.releaseReadinessScore}/100 •{" "}
							{auditResult.riskLevel.replace(/_/g, " ")}
						</span>
						{auditResult.driftItems.length > 0 && (
							<button
								type="button"
								onClick={onReconcileAll}
								className="btn btn-primary btn-sm"
							>
								⚡ Reconcile All Into Ticket
							</button>
						)}
					</div>
				</div>

				{auditResult.driftItems.length === 0 ? (
					<div
						style={{
							padding: "24px",
							textAlign: "center",
							background: "var(--success-bg)",
							borderRadius: "4px",
							color: "var(--success-green)",
						}}
					>
						<strong style={{ fontSize: "14px", display: "block" }}>
							✓ Zero Spec Drift Detected on Custom Input
						</strong>
						<span style={{ fontSize: "12px" }}>
							Try removing a security clause from the Jira Acceptance Criteria
							or switching HMAC-SHA256 to MD5 to watch DriftGuard catch it in
							real time.
						</span>
					</div>
				) : (
					<div
						style={{ display: "flex", flexDirection: "column", gap: "12px" }}
					>
						{auditResult.driftItems.map((item) => (
							<div
								key={item.id}
								style={{
									border: "1px solid var(--atlassian-border)",
									borderRadius: "5px",
									padding: "14px 16px",
									background: "#ffffff",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "flex-start",
										justifyContent: "space-between",
										gap: "12px",
										marginBottom: "8px",
									}}
								>
									<div>
										<div
											style={{
												display: "flex",
												alignItems: "center",
												gap: "6px",
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
											<span className="badge badge-info">
												{item.category.replace(/_/g, " ")}
											</span>
										</div>
										<h4 style={{ fontSize: "14px", fontWeight: 700 }}>
											{item.title}
										</h4>
									</div>

									<button
										type="button"
										onClick={() => onReconcileItem(item)}
										className="btn btn-secondary btn-sm"
										style={{ whiteSpace: "nowrap" }}
									>
										⚡ Patch Into Ticket
									</button>
								</div>

								<p
									style={{
										fontSize: "12px",
										color: "var(--atlassian-slate)",
										marginBottom: "8px",
									}}
								>
									<strong>Root Cause:</strong> {item.rootCause}
								</p>

								<div
									style={{
										fontSize: "12px",
										color: "var(--success-green)",
										background: "var(--success-bg)",
										padding: "7px 10px",
										borderRadius: "4px",
									}}
								>
									<strong>Suggested Remediation:</strong>{" "}
									{item.suggestedRemediation}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
