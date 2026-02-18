# Hook Integration Guide

This document explains how to integrate the Intent-Code Traceability hooks into Roo Code's `presentAssistantMessage.ts`.

## Integration Overview

The hooks are designed to intercept tool execution at the entry point in `src/core/assistant-message/presentAssistantMessage.ts`.

## Step 1: Add Import

At the top of `presentAssistantMessage.ts`, add:

```typescript
// Hook system imports
import { executeWithHooks, HookBlockedError, isHookError, getIntentContext } from "../hooks/integrate"
import { preHook } from "../hooks/pre-hook"
```

## Step 2: Get CWD and Intent Context

Find where `cwd` is obtained in the function and ensure it's available. The `cwd` should be accessible from the task context.

## Step 3: Wrap Tool Execution

For each tool case in the switch statement, wrap the execution with hooks:

### Example: write_to_file

Before:

```typescript
case "write_to_file":
  await writeToFileTool.handle(cline, block as ToolUse<"write_to_file">, {
    askApproval,
    handleError,
    pushToolResult,
  })
  break
```

After:

```typescript
case "write_to_file": {
  const toolUse = block as ToolUse<"write_to_file">;
  try {
    await executeWithHooks(
      {
        toolName: 'write_to_file',
        params: toolUse.params,
        cwd: cline.task.cwd,  // Adjust based on actual context
        intentId: cline.task.currentIntentId  // If available
      },
      () => writeToFileTool.handle(cline, toolUse, {
        askApproval,
        handleError,
        pushToolResult,
      }),
      (error) => {
        pushToolResult(`BLOCKED: ${error}`);
      }
    );
  } catch (error) {
    if (isHookError(error)) {
      // Already handled by onBlocked callback
    } else {
      handleError(error);
    }
  }
  break
}
```

## Step 4: Track Current Intent

Add state tracking for the current intent ID. In the Task class or similar:

```typescript
// In Task class or state management
private currentIntentId?: string;

setCurrentIntent(intentId: string) {
  this.currentIntentId = intentId;
}

getCurrentIntent(): string | undefined {
  return this.currentIntentId;
}
```

## Step 5: Create select_active_intent Tool Handler

Create a new tool handler in `src/core/tools/SelectIntentTool.ts`:

```typescript
import { getActiveIntents, validateIntentId } from "../hooks/validator"

export const selectIntentTool = {
	name: "select_active_intent",

	async handle(params: { intent_id: string }, task: Task) {
		const validation = await validateIntentId(params.intent_id, task.cwd)

		if (!validation.valid) {
			return {
				success: false,
				error: validation.message,
				available_intents: await getActiveIntents(task.cwd),
			}
		}

		// Set current intent
		task.setCurrentIntent(params.intent_id)

		return {
			success: true,
			intent: validation.context,
			message: `Intent ${params.intent_id} selected. Constraints: ${validation.context?.constraints.join(", ")}`,
		}
	},
}
```

## Complete Integration Checklist

- [ ] Import hook functions in presentAssistantMessage.ts
- [ ] Add currentIntentId state to Task class
- [ ] Wrap write_to_file with executeWithHooks
- [ ] Wrap edit/tool modification with executeWithHooks
- [ ] Wrap execute_command with executeWithHooks
- [ ] Add select_active_intent tool handler
- [ ] Test the flow: intent selection → code modification → trace logging

## Testing Integration

1. Start VS Code with Extension Development Host
2. Open a workspace with `.orchestration/active_intents.yaml`
3. Ask agent to modify a file
4. Verify agent selects intent first
5. Verify trace is logged after modification

## Troubleshooting

**Hook not firing**: Check that cwd is correctly passed to executeWithHooks
**Agent writes without intent**: Verify system prompt modification is active
**Trace not logging**: Check .orchestration/ directory exists and is writable
