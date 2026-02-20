/**
 * Command Classifier: Classifies tools as safe or destructive
 *
 * Safe commands: Read-only operations that don't modify the codebase
 * Destructive commands: Write, delete, or execute operations
 */

export type CommandClassification = "safe" | "destructive"

/**
 * List of safe (read-only) commands
 */
const SAFE_COMMANDS = [
	"read_file",
	"list_files",
	"list_directory",
	"search_files",
	"search_and_replace", // Read mode
	"read_command_output",
	"codebase_search",
	"get_context",
	"ask_followup_question",
	"update_todo_list",
]

/**
 * List of destructive (write) commands
 */
const DESTRUCTIVE_COMMANDS = [
	"write_to_file",
	"edit",
	"edit_file",
	"apply_diff",
	"apply_patch",
	"delete_file",
	"execute_command",
	// new_task is not a file-modifying operation, it's creating subtasks
	// switch_mode and attempt_completion don't modify workspace files
	"switch_mode",
	"attempt_completion",
]

/**
 * Classify a command as safe or destructive
 */
export function classifyCommand(toolName: string): CommandClassification {
	const normalizedName = normalizeToolName(toolName)

	if (DESTRUCTIVE_COMMANDS.includes(normalizedName)) {
		return "destructive"
	}

	if (SAFE_COMMANDS.includes(normalizedName)) {
		return "safe"
	}

	// Default to destructive for unknown commands (fail-safe)
	return "destructive"
}

/**
 * Normalize tool name to handle aliases
 */
function normalizeToolName(toolName: string): string {
	// Handle aliases
	const aliases: Record<string, string> = {
		write_file: "write_to_file",
		str_replace_editor: "write_to_file",
		insert_content_at_line: "edit_file",
		multi_edit: "edit",
	}

	return aliases[toolName] || toolName
}

/**
 * Check if a command is considered high-risk
 */
export function isHighRisk(toolName: string, params: Record<string, unknown> = {}): boolean {
	const classification = classifyCommand(toolName)

	if (classification !== "destructive") {
		return false
	}

	// Additional high-risk checks
	if (toolName === "execute_command") {
		const command = ((params.command as string) || "").toLowerCase()
		// Check for dangerous commands
		const dangerousPatterns = [
			"rm -rf",
			"del /s /q",
			"format",
			"drop table",
			"truncate",
			"> /dev/null",
			"chmod 777",
			"icacls",
			"takeown",
		]

		for (const pattern of dangerousPatterns) {
			if (command.includes(pattern)) {
				return true
			}
		}
	}

	// Multiple file operations are high-risk
	if (params.path && typeof params.path === "string") {
		if (params.path.includes("**") || params.path.includes("*")) {
			return true
		}
	}

	return false
}
