import { Task } from "../task/Task"
import { formatResponse } from "../prompts/responses"
import type { ToolUse } from "../../shared/tools"
import { BaseTool, ToolCallbacks } from "./BaseTool"
import { validateIntentId, getActiveIntents, IntentContext } from "../../hooks/validator"

interface SelectActiveIntentParams {
	intent_id: string
}

export class SelectIntentTool extends BaseTool<any> {
	readonly name = "select_active_intent" as const

	async execute(params: SelectActiveIntentParams, task: Task, callbacks: ToolCallbacks): Promise<void> {
		const { intent_id } = params
		const { handleError, pushToolResult } = callbacks

		try {
			if (!intent_id) {
				task.consecutiveMistakeCount++
				task.recordToolError("execute_command" as any)
				task.didToolFailInCurrentTurn = true
				pushToolResult(await task.sayAndCreateMissingParamError("execute_command" as any, "intent_id"))
				return
			}

			// Validate the intent_id
			const validation = await validateIntentId(intent_id, task.cwd)

			if (!validation.valid) {
				// Return error with available intents
				const activeIntents = await getActiveIntents(task.cwd)
				const availableIntentsList = activeIntents.map((i) => `- ${i.id}: ${i.name} (${i.status})`).join("\n")

				pushToolResult(
					formatResponse.toolResult(
						`ERROR: ${validation.message}\n\nAvailable Intents:\n${availableIntentsList || "No active intents found. Create .orchestration/active_intents.yaml"}`,
					),
				)
				return
			}

			// Set the current intent on the task
			task.setCurrentIntent(intent_id)

			const context = validation.context as IntentContext
			const constraints = context.constraints?.join("\n- ") || "No constraints"
			const scope = context.owned_scope?.join("\n- ") || "No scope defined"

			// Build the intent context response
			const response = `
Intent Selected: ${context.name} (${intent_id})

CONSTRAINTS:
- ${constraints}

OWNED SCOPE:
- ${scope}

ACCEPTANCE CRITERIA:
- ${context.acceptance_criteria?.join("\n- ") || "No acceptance criteria defined"}

You are now authorized to make changes within the owned scope. All file modifications will be logged to agent_trace.jsonl.
			`.trim()

			pushToolResult(formatResponse.toolResult(response))
		} catch (error) {
			await handleError("selecting active intent", error as Error)
		}
	}

	override async handlePartial(task: Task, block: ToolUse<any>): Promise<void> {
		// No partial streaming needed for this tool
	}
}

export const selectIntentTool = new SelectIntentTool()
