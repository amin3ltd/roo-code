/**
 * Post-Hook: Intercepts tool execution after it runs
 * Responsibilities:
 * - Log trace entries to agent_trace.jsonl
 * - Compute content hashes for files
 * - Update intent status
 * - Trigger notifications
 */

import * as fs from "fs/promises"
import * as path from "path"
import * as crypto from "crypto"

const ORCHESTRATION_DIR = ".orchestration"
const TRACE_FILE = "agent_trace.jsonl"

export interface TraceEntry {
	id: string
	timestamp: string
	vcs?: {
		revision_id?: string
	}
	intent_id: string
	mutation_class: "AST_REFACTOR" | "INTENT_EVOLUTION" | "READ_ONLY"
	files: FileEntry[]
}

export interface FileEntry {
	relative_path: string
	conversations: Conversation[]
}

export interface Conversation {
	url?: string
	contributor: {
		entity_type: "AI" | "Human"
		model_identifier?: string
	}
	ranges: Range[]
	related?: RelatedReference[]
}

export interface Range {
	start_line: number
	end_line: number
	content_hash: string
}

export interface RelatedReference {
	type: "specification" | "intent" | "requirement"
	value: string
}

/**
 * Compute SHA-256 hash of file content
 */
export async function computeSHA256(filePath: string): Promise<string> {
	try {
		const content = await fs.readFile(filePath)
		return crypto.createHash("sha256").update(content).digest("hex")
	} catch (error) {
		console.error("[Post-Hook] Error computing hash:", error)
		// Return empty hash if file can't be read
		return crypto.createHash("sha256").update("").digest("hex")
	}
}

/**
 * Main post-hook function
 * Called after tool execution to log traces and update state
 */
export async function postHook(
	toolName: string,
	params: Record<string, unknown>,
	result: unknown,
	cwd: string,
	intentId?: string,
): Promise<void> {
	try {
		console.log(`[Post-Hook] Invoked for ${toolName}`)

		// Skip logging for read-only operations
		const readOnlyTools = ["read_file", "list_files", "search_files", "read_command_output"]
		if (readOnlyTools.includes(toolName)) {
			return
		}

		// Only log for file modifications
		if (!["write_to_file", "edit", "apply_diff", "execute_command"].includes(toolName)) {
			console.log(`[Post-Hook] Tool ${toolName} not in trace list, skipping`)
			return
		}

		if (!intentId) {
			console.log(`[Post-Hook] No intent_id, skipping trace. Tool: ${toolName}`)
			return
		}

		// Determine mutation class
		const mutationClass = determineMutationClass(toolName, params)

		// Build trace entry
		const entry: TraceEntry = {
			id: generateUUID(),
			timestamp: new Date().toISOString(),
			intent_id: intentId,
			mutation_class: mutationClass,
			files: [],
		}

		// Add file information if available
		if (params.path && typeof params.path === "string") {
			const filePath = path.isAbsolute(params.path as string)
				? (params.path as string)
				: path.join(cwd, params.path as string)

			const contentHash = await computeSHA256(filePath)

			entry.files.push({
				relative_path: params.path as string,
				conversations: [
					{
						contributor: {
							entity_type: "AI",
							model_identifier: "claude-3-5-sonnet",
						},
						ranges: [
							{
								start_line: (params.start_line as number) || 1,
								end_line: (params.end_line as number) || 1,
								content_hash: contentHash,
							},
						],
						related: [
							{
								type: "intent",
								value: intentId,
							},
						],
					},
				],
			})
		}

		// Append to trace file
		await appendToTrace(entry, cwd)

		console.log(`[Post-Hook] Trace entry logged: ${entry.id}, intent: ${intentId}, tool: ${toolName}`)
	} catch (error) {
		console.error("[Post-Hook] Error:", error)
		// Don't throw - post-hook errors should not break the flow
	}
}

/**
 * Determine mutation class based on tool and parameters
 */
function determineMutationClass(
	toolName: string,
	params: Record<string, unknown>,
): "AST_REFACTOR" | "INTENT_EVOLUTION" | "READ_ONLY" {
	// Execute commands are typically INTENT_EVOLUTION
	if (toolName === "execute_command") {
		const command = ((params.command as string) || "").toLowerCase()
		if (command.match(/test|spec|lint|check/i)) {
			return "AST_REFACTOR" // Verification doesn't change intent
		}
		return "INTENT_EVOLUTION"
	}

	// File edits can be either
	if (["write_to_file", "edit", "apply_diff"].includes(toolName)) {
		// Check if this is a refactor (looking at params)
		const isRefactor = params.intent === "refactor" || params.mutation_class === "AST_REFACTOR"
		return isRefactor ? "AST_REFACTOR" : "INTENT_EVOLUTION"
	}

	return "READ_ONLY"
}

/**
 * Append a trace entry to the JSONL file
 */
async function appendToTrace(entry: TraceEntry, cwd: string): Promise<void> {
	const tracePath = path.join(cwd, ORCHESTRATION_DIR, TRACE_FILE)
	console.log(`[Post-Hook] Writing trace to: ${tracePath}`)

	// Ensure directory exists
	await fs.mkdir(path.join(cwd, ORCHESTRATION_DIR), { recursive: true })

	// Append entry as JSON line
	const line = JSON.stringify(entry) + "\n"
	await fs.appendFile(tracePath, line, "utf-8")
}

/**
 * Generate a simple UUID v4
 */
function generateUUID(): string {
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0
		const v = c === "x" ? r : (r & 0x3) | 0x8
		return v.toString(16)
	})
}
