/**
 * Validator: Validates intent IDs and scope permissions
 *
 * Responsibilities:
 * - Validate intent_id exists in active_intents.yaml
 * - Validate file operations are within owned_scope
 * - Load and parse YAML configuration
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"

const ORCHESTRATION_DIR = ".orchestration"
const ACTIVE_INTENTS_FILE = "active_intents.yaml"

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

interface ValidationResult {
	valid: boolean
	message?: string
	context?: IntentContext
}

export interface IntentContext {
	id: string
	name: string
	owned_scope: string[]
	constraints: string[]
	acceptance_criteria: string[]
}

/**
 * Validate that an intent_id exists in active_intents.yaml
 */
export async function validateIntentId(intentId: string, cwd: string): Promise<ValidationResult> {
	try {
		const yamlPath = path.join(cwd, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE)

		// Check if file exists
		try {
			await fs.access(yamlPath)
		} catch {
			return {
				valid: false,
				message: `No active_intents.yaml found. Create one in ${ORCHESTRATION_DIR}/`,
			}
		}

		// Read and parse YAML
		const content = await fs.readFile(yamlPath, "utf-8")
		const data = yaml.load(content) as ActiveIntentsYaml

		if (!data || !data.active_intents) {
			return {
				valid: false,
				message: "active_intents.yaml is empty or malformed",
			}
		}

		// Find the intent
		const intent = data.active_intents.find((i) => i.id === intentId)

		if (!intent) {
			const availableIds = data.active_intents.map((i) => i.id).join(", ")
			return {
				valid: false,
				message: `Intent ID "${intentId}" not found. Available IDs: ${availableIds || "none"}`,
			}
		}

		// Check if intent is active
		if (intent.status !== "IN_PROGRESS" && intent.status !== "ACTIVE") {
			return {
				valid: false,
				message: `Intent "${intentId}" has status "${intent.status}". Only IN_PROGRESS or ACTIVE intents can be used.`,
			}
		}

		return {
			valid: true,
			context: {
				id: intent.id,
				name: intent.name,
				owned_scope: intent.owned_scope || [],
				constraints: intent.constraints || [],
				acceptance_criteria: intent.acceptance_criteria || [],
			},
		}
	} catch (error) {
		console.error("[Validator] Error validating intent:", error)
		return {
			valid: false,
			message: `Error validating intent: ${error instanceof Error ? error.message : "Unknown error"}`,
		}
	}
}

/**
 * Validate that a file path is within the intent's owned_scope
 */
export async function validateScope(filePath: string, intentId: string, cwd: string): Promise<ValidationResult> {
	try {
		// First validate the intent exists
		const intentValidation = await validateIntentId(intentId, cwd)
		if (!intentValidation.valid || !intentValidation.context) {
			return intentValidation
		}

		const intent = intentValidation.context
		const normalizedFilePath = normalizePath(filePath)

		// Check if file matches any scope pattern
		for (const scopePattern of intent.owned_scope) {
			if (matchesPattern(normalizedFilePath, scopePattern)) {
				return { valid: true }
			}
		}

		return {
			valid: false,
			message: `Scope Violation: Intent ${intentId} is not authorized to edit "${filePath}". Authorized scope: ${intent.owned_scope.join(", ")}`,
		}
	} catch (error) {
		console.error("[Validator] Error validating scope:", error)
		return {
			valid: false,
			message: `Error validating scope: ${error instanceof Error ? error.message : "Unknown error"}`,
		}
	}
}

/**
 * Normalize file path for comparison
 */
function normalizePath(filePath: string): string {
	// Convert to forward slashes and remove leading/trailing slashes
	return filePath.replace(/\\/g, "/").replace(/^\/|\/$/g, "")
}

/**
 * Check if a file path matches a glob pattern
 */
function matchesPattern(filePath: string, pattern: string): boolean {
	const normalizedPattern = pattern.replace(/\\/g, "/")

	// Simple pattern matching
	// Supports: exact match, **/*.ext, *.ext, directory/**

	// Handle ** (recursive match)
	if (normalizedPattern.includes("**")) {
		const basePattern = normalizedPattern.replace("/**", "").replace("**", "")
		if (basePattern) {
			return filePath.startsWith(basePattern) || filePath.includes("/" + basePattern)
		}
		return true // ** matches everything
	}

	// Handle * (any characters in filename)
	if (normalizedPattern.includes("*")) {
		const regex = new RegExp("^" + normalizedPattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$")
		return regex.test(filePath)
	}

	// Exact match or directory match
	if (normalizedPattern.endsWith("/")) {
		return filePath.startsWith(normalizedPattern) || filePath.startsWith(normalizedPattern.slice(0, -1))
	}

	return filePath === normalizedPattern || filePath.endsWith("/" + normalizedPattern)
}

/**
 * Get all active intents
 */
export async function getActiveIntents(cwd: string): Promise<ActiveIntent[]> {
	try {
		const yamlPath = path.join(cwd, ORCHESTRATION_DIR, ACTIVE_INTENTS_FILE)
		const content = await fs.readFile(yamlPath, "utf-8")
		const data = yaml.load(content) as ActiveIntentsYaml
		return data?.active_intents || []
	} catch {
		return []
	}
}
