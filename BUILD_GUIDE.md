# Building and Running the Extension

## Prerequisites

- Node.js 20.19.2
- pnpm 10.8.1 (already installed)

## Build Commands

### 1. Install Dependencies

```bash
cd roo-code
pnpm install
```

### 2. Build the Extension

```bash
pnpm build
```

### 3. Create VSIX Package (Optional - for distribution)

```bash
pnpm vsix
```

### 4. Run in Development Mode (Recommended for testing)

**Option A: Using VS Code**

1. Open the `roo-code` folder in VS Code
2. Press `F5` to launch the Extension Development Host
3. This will open a new VS Code window with the extension loaded

**Option B: Using terminal**

```bash
# This creates a .vsix file and installs it
pnpm install:vsix
```

## Project Structure

```
roo-code/
├── src/
│   ├── core/
│   │   ├── assistant-message/
│   │   │   └── presentAssistantMessage.ts  ← Hooks integrated here
│   │   └── prompts/
│   │       └── sections/
│   │           └── rules.ts  ← System prompt modified
│   └── hooks/  ← Hook system code
├── .orchestration/  ← Templates for testing
└── packages/  ← Workspace packages
```

## Testing the Hook System

### 1. Create a Test Workspace

Create a new folder with `.orchestration/active_intents.yaml`:

```yaml
active_intents:
    - id: "INT-001"
      name: "Test Feature"
      status: "IN_PROGRESS"
      owned_scope:
          - "src/**"
      constraints:
          - "Test constraint"
      acceptance_criteria:
          - "Tests pass"
```

### 2. Open in Extension Development Host

1. Press `F5` in the roo-code folder
2. Open your test workspace in the new window
3. Ask the agent to modify a file in the owned_scope

### 3. Verify Hooks Work

- Agent should ask to select intent first
- Check `.orchestration/agent_trace.jsonl` for trace entries

## Troubleshooting

### TypeScript Errors

If you see TypeScript errors about missing modules:

```bash
pnpm install
pnpm build
```

### Extension Not Loading

- Check the Output panel in VS Code
- Look for errors in "Roo Code" or "Extension Host" sections

### Hooks Not Firing

- Verify the extension is running (check status bar)
- Check console.log output in Output panel
- Ensure `.orchestration/` directory exists in workspace
