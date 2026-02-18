/**
 * Pre-Hook: Intercepts tool execution before it runs
 *
 * Two-Stage State Machine Implementation:
 *
 * Stage 1: REQUEST - User provides natural language request
 *   -> Agent analyzes request and identifies relevant intent
 *
 * Stage 2: INTENT CHECKOUT (The Handshake) - Agent must call select_active_intent(intent_id)
 *   -> Pre-Hook intercepts and verifies intent is valid
 *   -> Validates scope permissions for target files
 *   -> Returns intent context (constraints, owned_scope, acceptance_criteria)
 *   -> If no valid intent: BLOCKS execution with error message
 *
 * Stage 3: CONTEXTUALIZED ACTION - Agent proceeds with tool execution
 *   -> Post-Hook logs trace entry with content_hash
 *   -> Maintains Intent-AST correlation
 *
 * Responsibilities:
 * - Validate intent selection before code changes
 * - Check scope permissions
 * - Calculate risk scores
 * - Block unauthorized operations
 */

import * as vscode from "vscode"
import * as fs from "fs/promises"
import * as path from "path"
import { classifyCommand, CommandClassification } from "./classifier"
import { validateIntentId, validateScope } from "./validator"

export interface PreHookResult {
	blocked: boolean
	error?: string
	requiresApproval?: boolean
	intentContext?: IntentContext
}

export interface IntentContext {
	id: string
	name: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

interface ActiveIntent {
	id: string
	name: string
	status: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

interface ActiveIntentsYaml {
	active_intents: ActiveIntent[]
}

/**
 * Main pre-hook function
 * Called before any tool execution to validate and prepare context
 */
export async function preHook(
	toolName: string,
	params: Record<string, unknown>,
	cwd: string,
	currentIntentId?: string,
): Promise<PreHookResult> {
	try {
		const classification = classifyCommand(toolName)

		// Log hook invocation
		console.log(`[Pre-Hook] Invoked for ${toolName} (classification: ${classification})`)

		// Skip pre-hook for read-only and safe commands
		if (classification === "safe") {
			return { blocked: false }
		}

		// For destructive commands, enforce intent selection
		if (classification === "destructive") {
			// Check if intent_id is provided
			const intentId = params.intent_id as string | undefined

			if (!intentId && !currentIntentId) {
				return {
					blocked: true,
					error: "BLOCKED: You must select an active Intent ID before making code changes. Use select_active_intent(intent_id) first.",
				}
			}

			const activeIntentId = intentId || currentIntentId

			if (activeIntentId) {
				// Validate intent_id exists
				const intentValidation = await validateIntentId(activeIntentId, cwd)
				if (!intentValidation.valid) {
					return {
						blocked: true,
						error: `BLOCKED: Invalid Intent ID "${activeIntentId}". ${intentValidation.message}`,
					}
				}

				// Validate scope for file operations
				if (params.path) {
					const scopeValidation = await validateScope(params.path as string, activeIntentId, cwd)
					if (!scopeValidation.valid) {
						return {
							blocked: true,
							error: `BLOCKED: Scope Violation. ${scopeValidation.message}`,
						}
					}

					// Return intent context for injection
					return {
						blocked: false,
						intentContext: intentValidation.context,
					}
				}

				return {
					blocked: false,
					intentContext: intentValidation.context,
				}
			}

			return {
				blocked: true,
				error: "BLOCKED: You must select an active Intent ID before making code changes.",
			}
		}

		return { blocked: false }
	} catch (error) {
		// Log error but don't block - fail-open for safety
		console.error("[Pre-Hook] Error:", error)
		return { blocked: false }
	}
}

/**
 * Calculate risk score for a tool call
 * Higher scores indicate more risky operations
 */
export function calculateRiskScore(toolName: string, params: Record<string, unknown>): number {
	let score = 0

	// Base score by command type
	switch (toolName) {
		case "write_to_file":
			score += 50
			break
		case "execute_command":
			score += 40
			// Additional score for dangerous commands
			{
				const command = (params.command as string) || ""
				if (command.match(/rm|del|format|drop|truncate/i)) {
					score += 30
				}
			}
			break
		case "edit":
		case "search_and_replace":
			score += 30
			break
		case "delete_file":
		case "apply_diff":
			score += 60
			break
		default:
			score += 10
	}

	// Additional scoring for file count
	if (params.path && typeof params.path === "string") {
		// Check if pattern suggests multiple files
		if (params.path.includes("**") || params.path.includes("*")) {
			score += 20
		}
	}

	return Math.min(score, 100)
}

/**
 * Optimistic Locking: Check if file has been modified since last read
 * This prevents parallel agents from overwriting each other's changes
 */
export async function checkOptimisticLock(
	filePath: string,
	expectedHash: string,
	cwd: string,
): Promise<{ locked: boolean; message?: string }> {
	try {
		const fs = await import("fs/promises")
		const path = await import("path")
		const crypto = await import("crypto")

		const fullPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath)

		// Check if file exists
		try {
			await fs.access(fullPath)
		} catch {
			// File doesn't exist yet, no lock needed
			return { locked: false }
		}

		// Compute current hash
		const content = await fs.readFile(fullPath)
		const currentHash = crypto.createHash("sha256").update(content).digest("hex")

		// Compare with expected hash
		if (currentHash !== expectedHash) {
			return {
				locked: true,
				message: `STALE_FILE: File "${filePath}" has been modified by another agent since you last read it. Please re-read the file and retry your operation.`,
			}
		}

		return { locked: false }
	} catch (error) {
		console.error("[Pre-Hook] Optimistic lock error:", error)
		// Fail-open for safety
		return { locked: false }
	}
}

/**
 * Record lesson learned to CLAUDE.md
 * Used when verification fails to share knowledge across agents
 */
export async function recordLesson(lesson: string, cwd: string): Promise<void> {
	try {
		const fs = await import("fs/promises")
		const path = await import("path")

		const claudePath = path.join(cwd, ".orchestration", "CLAUDE.md")
		const timestamp = new Date().toISOString()
		const entry = `\n## ${timestamp}\n${lesson}\n`

		await fs.appendFile(claudePath, entry, "utf-8")
		console.log("[Pre-Hook] Lesson recorded to CLAUDE.md")
	} catch (error) {
		console.error("[Pre-Hook] Failed to record lesson:", error)
	}
}
