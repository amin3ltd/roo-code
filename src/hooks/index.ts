/**
 * Hook Engine for Intent-Code Traceability
 *
 * This module provides the hook system for intercepting tool executions
 * and enforcing Intent-Code Traceability.
 *
 * Key Features:
 * - Pre-Hook: Validates intent selection before code changes
 * - Post-Hook: Logs trace entries after tool execution
 * - Command Classification: Distinguishes safe vs destructive commands
 */

import { preHook, PreHookResult, checkOptimisticLock, recordLesson, calculateRiskScore } from "./pre-hook"
import { postHook } from "./post-hook"
import { classifyCommand, CommandClassification } from "./classifier"
import { validateIntentId, validateScope } from "./validator"

export {
	preHook,
	postHook,
	classifyCommand,
	validateIntentId,
	validateScope,
	checkOptimisticLock,
	recordLesson,
	calculateRiskScore,
}
export type { CommandClassification, PreHookResult }

/**
 * Hook configuration
 */
export interface HookConfig {
	cwd: string
	orchestrationDir: string
	enableRiskScoring: boolean
	riskThreshold: number
}

export const DEFAULT_HOOK_CONFIG: HookConfig = {
	cwd: "",
	orchestrationDir: ".orchestration",
	enableRiskScoring: true,
	riskThreshold: 70,
}

/**
 * Tool call context passed to hooks
 */
export interface ToolCallContext {
	toolName: string
	intentId?: string
	params: Record<string, unknown>
	cwd: string
}
