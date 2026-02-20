# Parallel Orchestration Demo

This document demonstrates the Master Thinker parallel workflow with multiple AI agents.

## Setup

```bash
# Create a fresh workspace
mkdir demo-project && cd demo-project

# Copy orchestration templates
cp /path/to/roo-code/.orchestration/* ./
```

## Scenario: Weather API Implementation

### Step 1: Architect Agent (Agent A) Creates Intent

Agent A monitors the project and creates an intent:

**Agent A Action:**

```json
// Creates INT-001 in active_intents.yaml
{
	"id": "INT-001",
	"name": "Weather API Implementation",
	"status": "IN_PROGRESS",
	"owned_scope": ["src/api/weather/**", "src/services/weather.ts", "tests/weather/**"],
	"constraints": ["Must use REST API only", "Must include error handling"],
	"acceptance_criteria": ["Unit tests pass with 90% coverage", "API documentation updated"]
}
```

### Step 2: Builder Agent (Agent B) Selects Intent and Works

Agent B starts working on the intent:

**Agent B Action:**

```
User: Implement a weather API endpoint

Agent B: [Calls select_active_intent(intent_id: "INT-001")]

Tool Result:
Intent Selected: Weather API Implementation (INT-001)

CONSTRAINTS:
- Must use REST API only
- Must include error handling

OWNED SCOPE:
- src/api/weather/**
- src/services/weather.ts
- tests/weather/**

Agent B: [Now proceeds to implement within scope]
```

### Step 3: Parallel Collision Prevention

If Agent B (Builder) and another agent try to modify the same file:

**Scenario:** Agent B reads `src/api/weather.ts` at 2:00 PM
**Scenario:** Agent C reads same file at 2:05 PM
**Scenario:** Agent B writes first at 2:10 PM

**Agent C Action:**

```
Agent C: [Calls write_to_file with content]

Pre-Hook Check:
- Stored hash: sha256:abc123...
- Current hash: sha256:def456...

Result: BLOCKED - "Stale File: src/api/weather.ts has been modified
by another agent since you read it. Please re-read and retry."

Agent C: [Must re-read file and retry]
```

### Step 4: Trace Logging

The Post-Hook automatically logs:

**agent_trace.jsonl:**

```json
{
	"id": "trace-001",
	"timestamp": "2026-02-16T14:30:00Z",
	"intent_id": "INT-001",
	"mutation_class": "INTENT_EVOLUTION",
	"files": [
		{
			"relative_path": "src/api/weather.ts",
			"conversations": [
				{
					"contributor": {
						"entity_type": "AI",
						"model_identifier": "claude-3-5-sonnet"
					},
					"ranges": [
						{
							"start_line": 1,
							"end_line": 50,
							"content_hash": "sha256:a1b2c3d4..."
						}
					],
					"related": [
						{
							"type": "specification",
							"value": "REQ-001"
						}
					]
				}
			]
		}
	]
}
```

## Key Takeaways

1. **Intent First**: Agent must select intent before any code changes
2. **Scope Enforcement**: Cannot modify files outside `owned_scope`
3. **Optimistic Locking**: Prevents parallel collisions
4. **Full Traceability**: Every change logged with SHA-256 hash
5. **Shared Brain**: CLAUDE.md prevents duplicate work
