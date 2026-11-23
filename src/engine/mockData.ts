import type { ScenarioDataset } from "./types";

export const SCENARIOS: ScenarioDataset[] = [
	{
		id: "scenario-fintech",
		name: "Fintech API Gateway (Critical Security Drift)",
		description:
			"Confluence PRD-882 updated to require HMAC-SHA256 & Idempotency, but Jira ticket FIN-104 was marked Done with legacy MD5 checks.",
		spec: {
			id: "CONF-PRD-882",
			title: "Payment Webhook Architecture v2.4",
			version: "v2.4",
			lastUpdated: "2026-11-20T14:30:00Z",
			author: "Sarah Chen (Lead Security Architect)",
			sections: [
				{
					id: "sec-1",
					title: "Signature Verification Standard",
					content:
						"All incoming payment provider webhooks must be verified using HMAC-SHA256 with the revolving shared secret from AWS Secrets Manager.",
					requirements: [
						"Verify signature header X-Signature-SHA256 using HMAC-SHA256",
						"Reject MD5 and SHA-1 legacy signatures immediately with HTTP 401",
						"Fetch signature secret with 15-minute cached TTL from AWS Secrets Manager",
					],
				},
				{
					id: "sec-2",
					title: "Idempotency & Replay Attack Defense",
					content:
						"Webhooks must implement strict idempotency key checks stored in Redis with 72-hour TTL to prevent double-charging.",
					requirements: [
						"Enforce presence of Idempotency-Key header on all charge callbacks",
						"Store processed transaction UUIDs in Redis cluster with 72-hour TTL",
						"Return HTTP 409 Conflict if duplicate idempotency key is detected within active processing window",
					],
				},
				{
					id: "sec-3",
					title: "Throughput & Burst Protection",
					content:
						"Gateway must throttle incoming requests per merchant ID to maintain SLA.",
					requirements: [
						"Rate limit incoming webhooks to 100 req/sec per merchant ID",
						"Emit standard Retry-After header on HTTP 429",
					],
				},
			],
		},
		ticket: {
			key: "FIN-104",
			summary: "Implement Payment Provider Webhook Handler",
			status: "Done",
			assignee: "Alex Rivera",
			updated: "2026-11-18T10:15:00Z",
			acceptanceCriteria: [
				"Endpoint /api/v1/webhooks/payment receives POST requests",
				"Verify signature using MD5 hash check against merchant secret",
				"Record transaction status in PostgreSQL payments table",
				"Return HTTP 200 OK on successful processing",
			],
			subtasks: [
				"FIN-105: Scaffold Express router endpoint",
				"FIN-106: Write PostgreSQL insert query",
			],
		},
	},
	{
		id: "scenario-ecommerce",
		name: "E-Commerce Checkout (Compliance & Telemetry Drift)",
		description:
			"Confluence PRD-401 mandated PCI-DSS 4.0 CVV discard & zero-PAN logging, but Jira CHECK-209 overlooked scrubbing telemetry logs.",
		spec: {
			id: "CONF-PRD-401",
			title: "Checkout Flow PCI-DSS 4.0 Compliance Specs",
			version: "v3.0",
			lastUpdated: "2026-11-21T09:00:00Z",
			author: "Marcus Vance (Compliance Director)",
			sections: [
				{
					id: "sec-1",
					title: "Cardholder Data Handling",
					content:
						"Primary Account Numbers (PAN) and sensitive authentication data must undergo strict client-side tokenization.",
					requirements: [
						"Client-side tokenization via Stripe Elements iframe",
						"Zero plain-text PAN storage in database or memory heap",
						"Immediate memory wipe and discard of CVV after payment intent authorization",
					],
				},
				{
					id: "sec-2",
					title: "Observability & Log Sanitization",
					content:
						"All logging pipelines into Datadog and CloudWatch must run deterministic regex maskers.",
					requirements: [
						"Scrub full card numbers from request body logging via PII filter",
						"Never log CVV/CVC in debug logs under any log-level",
						"Unit test validating log interceptor scrubs 16-digit credit card patterns",
					],
				},
			],
		},
		ticket: {
			key: "CHECK-209",
			summary: "Migrate Checkout Backend to Stripe v2026 SDK",
			status: "In Review",
			assignee: "David Kim",
			updated: "2026-11-22T16:00:00Z",
			acceptanceCriteria: [
				"Integrate Stripe Elements tokenization payload",
				"Store only customer_id and payment_method_id in billing_profiles table",
				"Process 3D-Secure 2.0 biometric challenge redirects",
			],
			subtasks: [
				"CHECK-210: Stripe Webhook integration",
				"CHECK-211: Update payment error toast UI",
			],
		},
	},
	{
		id: "scenario-sso",
		name: "Enterprise OAuth2 SSO (Aligned / In-Sync)",
		description:
			"Confluence PRD-119 and Jira AUTH-55 are fully aligned with 100% acceptance criteria coverage.",
		spec: {
			id: "CONF-PRD-119",
			title: "Enterprise Okta OIDC SSO Architecture",
			version: "v1.2",
			lastUpdated: "2026-11-15T11:00:00Z",
			author: "Elena Rostova (Platform Architect)",
			sections: [
				{
					id: "sec-1",
					title: "Authorization Code Flow with PKCE",
					content: "Implementation of RFC 7636 Proof Key for Code Exchange.",
					requirements: [
						"Generate cryptographic code_verifier with min 43 characters",
						"Compute code_challenge using SHA-256 method",
						"Validate state and nonce parameters against session store to prevent CSRF",
					],
				},
				{
					id: "sec-2",
					title: "Token Exchange & Claims Verification",
					content: "Verify JWT signature against Okta JWKS discovery endpoint.",
					requirements: [
						"Fetch and cache JWKS keys with 24-hour expiration",
						"Verify exp, nbf, and aud claims on id_token",
						"Extract email and enterprise organization_id claims for user session provisioning",
					],
				},
			],
		},
		ticket: {
			key: "AUTH-55",
			summary: "Implement Okta OIDC SSO with PKCE for Enterprise Tenants",
			status: "In Review",
			assignee: "Elena Rostova",
			updated: "2026-11-20T17:45:00Z",
			acceptanceCriteria: [
				"Generate cryptographic code_verifier (43-128 chars) and SHA-256 code_challenge",
				"Validate state and nonce parameters to prevent CSRF during callback",
				"Fetch and cache JWKS keys from Okta discovery endpoint",
				"Verify exp, nbf, aud claims on id_token before session creation",
				"Extract organization_id and email claims to provision tenant session",
			],
			subtasks: [
				"AUTH-56: Unit tests for PKCE generator",
				"AUTH-57: JWKS key caching service",
			],
		},
	},
];
