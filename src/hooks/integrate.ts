/**
 * Hook Integration Helper
 *
 * This module provides integration with Roo Code's tool execution system.
 * It wraps tool execution with pre-hook and post-hook calls.
 *
 * Integration:
 * Import this file in presentAssistantMessage.ts and wrap tool.handle() calls
 * with executeWithHooks() function.
 */

import { preHook, PreHookResult } from "./pre-hook"
import { postHook } from "./post-hook"

export interface ToolExecutionContext {
	toolName: string
	params: Record<string, unknown>
	cwd: string
	intentId?: string
}

/**
 * Execute a tool with hook interception
 *
 * @param context - Tool execution context
 * @param executeTool - The tool execution function
 * @param onBlocked - Callback when execution is blocked
 * @returns Result of tool execution
 */
export async function executeWithHooks<T>(
	context: ToolExecutionContext,
	executeTool: () => Promise<T>,
	onBlocked?: (error: string) => void,
): Promise<T> {
	const { toolName, params, cwd, intentId } = context

	// Pre-hook: Validate before execution
	const preResult = await preHook(toolName, params, cwd, intentId)

	if (preResult.blocked) {
		if (onBlocked) {
			onBlocked(preResult.error || "Execution blocked")
		}
		throw new HookBlockedError(preResult.error || "Execution blocked by pre-hook")
	}

	// Check if approval is required
	if (preResult.requiresApproval) {
		// Return special result to trigger approval flow
		throw new HookApprovalRequiredError("High-risk operation requires approval")
	}

	try {
		// Execute the tool
		const result = await executeTool()

		// Post-hook: Log after execution
		await postHook(toolName, params, result, cwd, intentId || preResult.intentContext?.id)

		return result
	} catch (error) {
		// Log error in post-hook
		await postHook(toolName, params, { error: String(error) }, cwd, intentId)
		throw error
	}
}

/**
 * Custom error for blocked executions
 */
export class HookBlockedError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "HookBlockedError"
	}
}

/**
 * Custom error for approval-required executions
 */
export class HookApprovalRequiredError extends Error {
	constructor(message: string) {
		super(message)
		this.name = "HookApprovalRequiredError"
	}
}

/**
 * Get intent context from pre-hook result
 */
export function getIntentContext(preResult: PreHookResult): PreHookResult["intentContext"] {
	return preResult.intentContext
}

/**
 * Check if an error is a hook error
 */
export function isHookError(error: unknown): boolean {
	return error instanceof HookBlockedError || error instanceof HookApprovalRequiredError
}
