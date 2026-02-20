/**
 * Integration Tests for Hook System
 *
 * Tests the complete hook flow:
 * - Pre-Hook + Post-Hook integration
 * - End-to-end intent validation flow
 * - Scope enforcement with real file operations
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import * as crypto from "crypto"
import { classifyCommand, isHighRisk } from "../hooks/classifier"
import { validateIntentId, validateScope, getActiveIntents } from "../hooks/validator"
import { computeSHA256 } from "../hooks/post-hook"

describe("Hook System Integration Tests", () => {
	const testCwd = "/tmp/hook-integration-test"

	beforeEach(async () => {
		// Create test directory structure
		try {
			await fs.mkdir(path.join(testCwd, ".orchestration"), { recursive: true })
			await fs.mkdir(path.join(testCwd, "src", "auth"), { recursive: true })
			await fs.mkdir(path.join(testCwd, "src", "payment"), { recursive: true })
		} catch {
			// Ignore errors
		}
	})

	afterEach(async () => {
		// Cleanup
		try {
			await fs.rm(testCwd, { recursive: true, force: true })
		} catch {
			// Ignore errors
		}
	})

	describe("Complete Intent Flow", () => {
		it("should enforce complete intent-validation-trace flow", async () => {
			// Step 1: Create active_intents.yaml
			const intentConfig = {
				active_intents: [
					{
						id: "INT-001",
						name: "Build Weather API",
						status: "IN_PROGRESS",
						owned_scope: ["src/weather/**", "src/api/weather.ts"],
						constraints: ["Use Express.js"],
						acceptance_criteria: ["Tests pass"],
					},
				],
			}
			await fs.writeFile(path.join(testCwd, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Step 2: Validate intent exists
			const intentResult = await validateIntentId("INT-001", testCwd)
			expect(intentResult.valid).toBe(true)
			expect(intentResult.context?.name).toBe("Build Weather API")

			// Step 3: Classify the command
			const classification = classifyCommand("write_to_file")
			expect(classification).toBe("destructive")

			// Step 4: Check if it's high-risk (should not be for this path)
			const riskLevel = isHighRisk("write_to_file", {
				path: "src/api/weather.ts",
			})
			expect(riskLevel).toBe(false)

			// Step 5: Validate scope
			const scopeResult = await validateScope("src/api/weather.ts", "INT-001", testCwd)
			expect(scopeResult.valid).toBe(true)

			// Step 6: Write file and compute hash
			const testContent = "export const weather = {};"
			await fs.writeFile(path.join(testCwd, "src", "api", "weather.ts"), testContent)

			const contentHash = await computeSHA256(path.join(testCwd, "src", "api", "weather.ts"))
			const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex")
			expect(contentHash).toBe(expectedHash)
		})

		it("should block unauthorized scope", async () => {
			// Create intent with limited scope
			const intentConfig = {
				active_intents: [
					{
						id: "INT-001",
						name: "Auth Work",
						status: "IN_PROGRESS",
						owned_scope: ["src/auth/**"],
						constraints: [],
						acceptance_criteria: [],
					},
				],
			}
			await fs.writeFile(path.join(testCwd, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Try to access file outside scope
			const scopeResult = await validateScope("src/payment/billing.ts", "INT-001", testCwd)
			expect(scopeResult.valid).toBe(false)
			expect(scopeResult.message).toContain("Scope Violation")
		})

		it("should detect high-risk operations", async () => {
			// Test dangerous command detection
			const dangerousCommands = [
				{ command: "rm -rf /", expected: true },
				{ command: "del /s /q C:\\", expected: true },
				{ command: "npm install", expected: false },
				{ command: "git commit -m", expected: false },
			]

			for (const { command, expected } of dangerousCommands) {
				const result = isHighRisk("execute_command", { command })
				expect(result).toBe(expected)
			}
		})
	})

	describe("Parallel Agent Simulation", () => {
		it("should detect file changes between reads", async () => {
			const filePath = path.join(testCwd, "src", "auth", "middleware.ts")

			// Agent A reads file
			const originalContent = "const auth = {}"
			await fs.writeFile(filePath, originalContent)
			const hashBefore = await computeSHA256(filePath)

			// Agent B (or human) modifies file
			const modifiedContent = "const auth = { token: true }"
			await fs.writeFile(filePath, modifiedContent)

			// Agent A tries to write but should detect change
			const hashAfter = await computeSHA256(filePath)

			expect(hashBefore).not.toBe(hashAfter)
		})
	})

	describe("Trace Entry Integration", () => {
		it("should create complete trace entry", async () => {
			// Setup
			const intentConfig = {
				active_intents: [
					{
						id: "INT-001",
						name: "Test",
						status: "IN_PROGRESS",
						owned_scope: ["src/**"],
						constraints: [],
						acceptance_criteria: [],
					},
				],
			}
			await fs.writeFile(path.join(testCwd, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Create file to trace
			const testFile = path.join(testCwd, "src", "app.ts")
			const testContent = "console.log('hello')"
			await fs.writeFile(testFile, testContent)

			// Compute trace data
			const contentHash = await computeSHA256(testFile)
			const classification = classifyCommand("write_to_file")
			const scopeValid = await validateScope("src/app.ts", "INT-001", testCwd)

			// Verify trace would be valid
			expect(classification).toBe("destructive")
			expect(scopeValid.valid).toBe(true)
			expect(contentHash).toBe(crypto.createHash("sha256").update(testContent).digest("hex"))
		})
	})

	describe("Error Handling", () => {
		it("should handle missing orchestration directory", async () => {
			const result = await validateIntentId("INT-001", "/nonexistent/path")
			expect(result.valid).toBe(false)
			expect(result.message).toContain("No active_intents.yaml found")
		})

		it("should handle invalid YAML gracefully", async () => {
			await fs.mkdir(path.join(testCwd, ".orchestration"), { recursive: true })
			await fs.writeFile(path.join(testCwd, ".orchestration", "active_intents.yaml"), "invalid: yaml: content:")

			const result = await validateIntentId("INT-001", testCwd)
			expect(result.valid).toBe(false)
		})
	})
})
