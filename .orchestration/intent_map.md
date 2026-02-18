# Intent Map - Spatial Map

This file maps high-level business intents to physical files and directories.

## Intent to File Mapping

### INT-001: Weather API Implementation

- **Directory**: `src/api/weather/`
- **Files**:
    - `src/api/weather/index.ts` - API entry point
    - `src/api/weather/routes.ts` - Route definitions
    - `src/api/weather/controllers/` - Request handlers
    - `src/services/weather.ts` - Weather service
    - `tests/weather/` - Test files

### INT-002: User Authentication Refactor

- **Directory**: `src/auth/`
- **Files**:
    - `src/auth/middleware.ts` - Auth middleware
    - `src/auth/providers/` - Auth providers
    - `src/auth/strategies/` - Auth strategies

### INT-003: Performance Optimization

- **Scope**: `src/**` (all source files)
- **Focus Areas**:
    - Database queries in `src/db/`
    - API endpoints in `src/api/`
    - Bundle size in `src/bundles/`

## File to Intent Lookup

| File                    | Intent  | Type         |
| ----------------------- | ------- | ------------ |
| src/api/weather/\*      | INT-001 | Feature      |
| src/services/weather.ts | INT-001 | Feature      |
| src/auth/middleware.ts  | INT-002 | Refactor     |
| src/auth/\*             | INT-002 | Refactor     |
| src/\*_/_.ts            | INT-003 | Optimization |

## Notes

- Use this map to quickly find which intent owns a file
- Updated automatically when INTENT_EVOLUTION occurs
- Use CLAUDE.md for shared knowledge across agents
