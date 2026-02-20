# Intent-Code Traceability System

This directory contains the Intent-Code Traceability Hook System for Roo Code.

## Files

- `active_intents.yaml` - Defines active intents (business goals) that agents can work on
- `agent_trace.jsonl` - Append-only log of all file modifications with intent linkage

## How It Works

### 1. Intent Selection (Required First Step)

Before an AI agent can modify any code, it MUST select an active intent:

```
Call: select_active_intent(intent_id="INT-001")
```

This "checks out" the intent, granting permission to modify files within its `owned_scope`.

### 2. File Modification

After selecting an intent, the agent can make changes. Each change is automatically traced:

- `write_to_file` - Creates or overwrites files
- `edit` - Modifies existing files
- `apply_diff` - Applies patch/diff changes
- `execute_command` - Runs shell commands

### 3. Trace Output

Each modification is logged to `agent_trace.jsonl` with:
- Intent ID linkage
- File path and line ranges
- Content hash (SHA-256) for spatial independence
- Mutation class: `AST_REFACTOR` | `INTENT_EVOLUTION` | `READ_ONLY`

## Example Workflow

```
1. User: "Add user login to the auth system"

2. Agent: [Analyzes request, identifies relevant intent]
   [Calls select_active_intent(intent_id="INT-001")]
   
3. System: Returns intent context:
   - CONSTRAINTS: Must maintain backward compatibility
   - OWNED SCOPE: src/auth/**, src/middleware/auth.ts
   
4. Agent: [Now authorized to make changes within scope]
   [Calls write_to_file(path="src/auth/login.ts", content="...")]
   
5. System: [Logs trace entry to agent_trace.jsonl]
```

## Scope Validation

If an agent tries to modify files outside the intent's `owned_scope`, the operation is BLOCKED:

```
BLOCKED: Scope Violation. File "src/unrelated/file.ts" is not in owned_scope for intent INT-001
```

## Benefits

- **Traceability**: Every code change is linked to a business intent
- **Auditability**: Complete history of who changed what and why
- **Safety**: Prevents agents from modifying files outside their intended scope
- **Spatial Independence**: Content hashes enable cross-repository correlation
