# Shared Brain - CLAUDE.md

## Project Context

This project uses **Intent-Code Traceability** to govern AI-assisted development. All code changes must be linked to specific business intents tracked in `active_intents.yaml`.

## Core Principles

1. **Intent-First**: Always select an active intent before making code changes
2. **Traceable**: Every modification is logged to `agent_trace.jsonl` with SHA-256 content hashes
3. **Scoped**: Only work within your assigned intent's `owned_scope`
4. **Verified**: All changes must pass acceptance criteria

## Two-Stage State Machine

This project implements a strict Two-Stage State Machine for governance:

### Stage 1: REQUEST

- User provides natural language task
- Agent analyzes request and identifies relevant intent
- **Agent CANNOT write code yet**

### Stage 2: INTENT CHECKOUT (The Handshake)

- Agent MUST call `select_active_intent(intent_id)`
- Pre-Hook intercepts and verifies:
    - Intent ID is valid
    - Target file is within `owned_scope`
- Returns intent context (constraints, scope, acceptance criteria)
- If invalid: **BLOCKS execution**

### Stage 3: CONTEXTUALIZED ACTION

- Agent proceeds with write/edit operations
- Post-Hook logs trace with content_hash
- Maintains Intent-AST correlation

## Workflow

### Before Writing Code

```
1. Analyze user's request
2. Select appropriate intent: select_active_intent(intent_id)
3. Receive constraints and scope
4. Proceed with implementation
```

### After Writing Code

```
1. Post-hook automatically logs trace
2. Verify changes meet acceptance criteria
3. Update intent status if complete
```

## Parallel Orchestration

This project supports parallel agent execution using the **Master Thinker Pattern**:

### Architect Agent (Agent A)

- Monitors `intent_map.md`
- Defines high-level plans
- Creates/updates intents in `active_intents.yaml`
- Does NOT write code directly

### Builder Agent (Agent B)

- Executes code changes for assigned intent
- Reads from `active_intents.yaml` for constraints
- Logs to `agent_trace.jsonl`
- Can trigger optimistic locking collision if file modified

### Shared Brain (CLAUDE.md)

- Both agents read/write to this file
- Lessons learned are recorded here
- Prevents collision through shared knowledge

### Optimistic Locking

When parallel agents attempt to modify the same file:

1. Agent reads file and stores content hash
2. Agent attempts write
3. Pre-Hook compares current hash vs. stored hash
4. If different: **BLOCKS with "Stale File" error**
5. Agent must re-read and retry

## Available Intents

See `active_intents.yaml` for the current list of active intents.

## Common Patterns

### Feature Development

- Select intent with status "IN_PROGRESS"
- Only modify files within `owned_scope`
- Update acceptance criteria as you go

### Refactoring

- Select intent with type "refactor"
- Mutation class should be "AST_REFACTOR"
- Ensure tests still pass

### Bug Fixes

- Create new intent or use existing
- Document the fix in acceptance criteria
- Add test cases

### Parallel Work

- Agent A: Plan and create intents
- Agent B: Execute within intent scope
- Both: Reference CLAUDE.md for context

## Lessons Learned

_This section is updated when verification fails_

### 2026-02-16

- Agent attempted to modify file outside scope - **BLOCKED** by Pre-Hook
- Optimistic locking prevented collision between parallel agents
- System prompt mandate ensures agent cannot skip intent selection

### 2026-02-17

- SHA-256 content hashing enables spatial independence
- Even if lines shift, hash remains valid for traceability
- Related field links code to specification (REQ-001)

### 2026-02-18

- Two-Stage State Machine enforces governance at architecture level
- Pre-Hook validation happens before any tool execution
- Post-Hook logging is transparent to agent workflow

## Mutation Classification

When logging changes, classify correctly:

- **AST_REFACTOR**: Same intent, syntax changes only (e.g., renaming variables)
- **INTENT_EVOLUTION**: New feature or behavior change
- **READ_ONLY**: File reads (not logged to trace)

## Governance Commands

- `select_active_intent(intent_id)` - Checkout intent before coding
- Pre-Hook validates automatically
- Post-Hook logs automatically
- No manual trace updates needed
