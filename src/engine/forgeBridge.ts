import type { ForgeEnvironmentStatus } from "./types";

export async function detectForgeEnvironment(): Promise<ForgeEnvironmentStatus> {
	if (typeof window === "undefined") {
		return { isForge: false, context: null, source: "STANDALONE_SANDBOX" };
	}

	try {
		const hasBridge =
			typeof (globalThis as { __bridge?: { callBridge?: unknown } }).__bridge
				?.callBridge === "function";

		if (!hasBridge) {
			return { isForge: false, context: null, source: "STANDALONE_SANDBOX" };
		}

		// Dynamically import @forge/bridge only when bridge runtime is verified
		const { view } = await import("@forge/bridge");
		const context = await view.getContext();
		if (context) {
			return {
				isForge: true,
				context,
				source: "FORGE_CLOUD",
			};
		}
	} catch {
		// Fallback when outside container or bridge invocation fails
	}

	return {
		isForge: false,
		context: null,
		source: "STANDALONE_SANDBOX",
	};
}
