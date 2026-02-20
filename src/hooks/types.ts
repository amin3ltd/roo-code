/**
 * Hook System Types
 *
 * This file defines the core types for the Intent-Code Traceability hook system.
 * Provides clean module boundaries and type safety.
 */

/**
 * Classification of tool operations
 */
export type CommandClassification = "safe" | "destructive" | "read_only"

/**
 * Result from pre-hook validation
 */
export interface PreHookResult {
	blocked: boolean
	error?: string
	requiresApproval?: boolean
	intentContext?: IntentContext
}

/**
 * Context returned when an intent is selected
 */
export interface IntentContext {
	id: string
	name: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

/**
 * Active intent from active_intents.yaml
 */
export interface ActiveIntent {
	id: string
	name: string
	status: "PENDING" | "IN_PROGRESS" | "COMPLETED"
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

/**
 * Root structure of active_intents.yaml
 */
export interface ActiveIntentsYaml {
	active_intents: ActiveIntent[]
}

/**
 * Hook configuration
 */
export interface HookConfig {
	cwd: string
	orchestrationDir: string
	enableRiskScoring: boolean
	riskThreshold: number
}

/**
 * Default hook configuration
 */
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

/**
 * Scope validation result
 */
export interface ScopeValidation {
	valid: boolean
	message?: string
}

/**
 * Intent validation result
 */
export interface IntentValidation {
	valid: boolean
	message?: string
	context?: IntentContext
}

/**
 * Optimistic lock check result
 */
export interface LockCheck {
	locked: boolean
	message?: string
}

/**
 * Risk score from command analysis
 */
export interface RiskScore {
	score: number
	classification: CommandClassification
	factors: string[]
}
