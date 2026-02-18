# Shared Brain - CLAUDE.md

## Project Context

This project uses **Intent-Code Traceability** to govern AI-assisted development. All code changes must be linked to specific business intents tracked in `active_intents.yaml`.

## Core Principles

1. **Intent-First**: Always select an active intent before making code changes
2. **Traceable**: Every modification is logged to `agent_trace.jsonl`
3. **Scoped**: Only work within your assigned intent's `owned_scope`
4. **Verified**: All changes must pass acceptance criteria

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

## Lessons Learned

_This section is updated when verification fails_

- (Date) Agent attempted to modify file outside scope - blocked
- (Date) Optimistic locking prevented collision between parallel agents
