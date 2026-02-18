# Architecture Notes - Roo Code Extension

## Overview

This document outlines the architecture of the Roo Code VS Code extension and identifies key integration points for the Intent-Code Traceability hook system.

---

## 1. Tool Execution Flow

### Entry Point

The tool execution flow starts in [`src/core/assistant-message/presentAssistantMessage.ts`](src/core/assistant-message/presentAssistantMessage.ts). This file:

- Processes assistant message content
- Executes tool use requests with user approval
- Coordinates file system checkpointing
- Controls conversation state

### Tool Execution Pipeline

```
User Request → LLM Response → presentAssistantMessage.ts
                                    ↓
                           Tool Use Blocks
                                    ↓
                    ┌────────────────┴────────────────┐
                    ↓                                   ↓
           Native Tools (in-tree)              MCP Tools (external)
                    ↓                                   ↓
           ExecuteCommandTool.ts              UseMcpToolTool.ts
           WriteToFileTool.ts
           ReadFileTool.ts
           EditTool.ts
           ... etc
```

### Key Files

| File                                                    | Purpose                         |
| ------------------------------------------------------- | ------------------------------- |
| `src/core/assistant-message/presentAssistantMessage.ts` | Main tool execution entry point |
| `src/core/tools/ExecuteCommandTool.ts`                  | Handles command execution       |
| `src/core/tools/WriteToFileTool.ts`                     | Handles file writing            |
| `src/core/tools/EditTool.ts`                            | Handles file editing            |
| `src/core/task/Task.ts`                                 | Main task orchestration         |
| `src/shared/tools.ts`                                   | Tool definitions and types      |

---

## 2. System Prompt Building

### Entry Point

System prompt is built in [`src/core/prompts/system.ts`](src/core/prompts/system.ts).

### Prompt Sections

The system prompt is composed of multiple sections:

```
System Prompt = roleDefinition
              + markdownFormattingSection
              + sharedToolUseSection
              + toolUseGuidelinesSection
              + capabilitiesSection
              + modesSection
              + skillsSection
              + rulesSection
              + systemInfoSection
              + objectiveSection
              + customInstructions
```

### Key Files

| File                                        | Purpose                                       |
| ------------------------------------------- | --------------------------------------------- |
| `src/core/prompts/system.ts`                | Main prompt generation                        |
| `src/core/prompts/sections/rules.ts`        | Rules section (modify for intent requirement) |
| `src/core/prompts/sections/capabilities.ts` | Capabilities section                          |
| `src/core/prompts/sections/objective.ts`    | Objective section                             |
| `src/core/prompts/sections/system-info.ts`  | System info section                           |

---

## 3. Hook Integration Points

### Pre-Hook Integration (Before Tool Execution)

The best integration point for pre-execution hooks is in `presentAssistantMessage.ts`. The tool execution happens around line 760+ where each tool's `handle` method is called.

**Integration Strategy:**

1. Wrap the tool execution logic
2. Add pre-hook validation before each tool call
3. Check intent selection status before write operations

### Post-Hook Integration (After Tool Execution)

The post-hook can be integrated in two ways:

1. After each tool's `handle` method completes
2. Using event emitters for tool completion events

### Key Integration Points

1. **Before tool execution**: In `presentAssistantMessage.ts` before `await tool.handle(cline, block, callbacks)`
2. **After tool execution**: After the `handle` method returns
3. **System prompt modification**: In `src/core/prompts/sections/rules.ts`

---

## 4. Data Model Storage

### Workspace Storage

- VS Code workspace state for session data
- File system for `.orchestration/` directory
- Extension global state for persistent data

### Key Storage Files

- `extension.ts` - Extension entry point
- Configuration in `.roo/` directory

---

## 5. Implementation Plan

### Phase 1: Intent Selection Tool

1. **Create Hook Directory**: `src/hooks/`
2. **Add Intent Selection Tool**:
    - Define tool in `src/shared/tools.ts`
    - Implement handler in `src/core/tools/SelectIntentTool.ts` (new)
3. **Modify System Prompt**:
    - Update `src/core/prompts/sections/rules.ts` to require intent selection

### Phase 2: Hook System

1. **Create Hook Engine**: `src/hooks/index.ts`
2. **Pre-Hook**:
    - Intercept in `presentAssistantMessage.ts`
    - Validate intent selection
    - Check scope
3. **Post-Hook**:
    - Log to agent_trace.jsonl
    - Compute content hash

### Phase 3: Traceability

1. **Initialize `.orchestration/`** in workspace root
2. **Implement SHA-256 hashing**
3. **Create trace logging**

### Phase 4: Parallel Orchestration

1. **Implement file locking**
2. **Add collision detection**
3. **Implement lesson recording**

---

## 6. Key Modifications Summary

### Files to Modify

| File                                                    | Modification                     |
| ------------------------------------------------------- | -------------------------------- |
| `src/core/assistant-message/presentAssistantMessage.ts` | Inject pre/post hooks            |
| `src/core/prompts/sections/rules.ts`                    | Add intent selection requirement |
| `src/shared/tools.ts`                                   | Add select_active_intent tool    |
| `src/core/task/Task.ts`                                 | Add intent context handling      |

### Files to Create

| File                                 | Purpose                   |
| ------------------------------------ | ------------------------- |
| `src/hooks/index.ts`                 | Hook engine entry point   |
| `src/hooks/pre-hook.ts`              | Pre-execution intercepts  |
| `src/hooks/post-hook.ts`             | Post-execution intercepts |
| `src/hooks/classifier.ts`            | Command classification    |
| `src/hooks/validator.ts`             | Input validation          |
| `src/core/tools/SelectIntentTool.ts` | Intent selection tool     |
| `.orchestration/active_intents.yaml` | Intent storage            |
| `.orchestration/agent_trace.jsonl`   | Trace ledger              |

---

## 7. Testing Strategy

1. **Unit Tests**: Test hooks in isolation
2. **Integration Tests**: Test full flow with mock LLM
3. **E2E Tests**: Manual testing with real workspace

---

## 8. Dependencies

Key npm packages used:

- `@anthropic-ai/sdk` - Claude API client
- `vscode` - VS Code API
- `uuid` - UUID generation
- `js-yaml` - YAML parsing
- `crypto` - SHA-256 hashing (built-in Node.js)

---

## 9. Debugging Tips

1. Use VS Code "Extension Development Host" mode
2. Add console.log statements in hook functions
3. Check the Output panel for extension logs
4. Use `task.say()` to send messages to the chat

---

## 10. Risk Assessment

| Risk                                           | Mitigation                      |
| ---------------------------------------------- | ------------------------------- |
| Hook integration breaks existing functionality | Use non-invasive wrapping       |
| LLM doesn't follow protocol                    | Add explicit examples in prompt |
| Performance impact                             | Lazy-load intent data           |
| Extension crashes                              | Add try-catch in all hooks      |
