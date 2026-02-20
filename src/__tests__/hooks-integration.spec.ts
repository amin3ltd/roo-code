/**
 * Integration Tests for Hook System
 *
 * Tests the complete hook flow:
 * - Pre-Hook + Post-Hook integration
 * - End-to-end intent validation flow
 * - Scope enforcement with real file operations
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import * as crypto from "crypto"
import { classifyCommand, isHighRisk } from "../hooks/classifier"
import { validateIntentId, validateScope, getActiveIntents } from "../hooks/validator"
import { computeSHA256, postHook } from "../hooks/post-hook"

describe("Hook System Integration Tests", () => {
	const testDir = path.join(process.cwd(), "test-temp-integration")

	beforeEach(async () => {
		// Create test directory structure
		await fs.mkdir(path.join(testDir, ".orchestration"), { recursive: true })
		await fs.mkdir(path.join(testDir, "src", "auth"), { recursive: true })
		await fs.mkdir(path.join(testDir, "src", "payment"), { recursive: true })
		await fs.mkdir(path.join(testDir, "src", "api"), { recursive: true })
		await fs.mkdir(path.join(testDir, "src", "weather"), { recursive: true })
	})

	afterEach(async () => {
		// Cleanup
		try {
			await fs.rm(testDir, { recursive: true, force: true })
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
			await fs.writeFile(path.join(testDir, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Step 2: Validate intent exists
			const intentResult = await validateIntentId("INT-001", testDir)
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
			const scopeResult = await validateScope("src/api/weather.ts", "INT-001", testDir)
			expect(scopeResult.valid).toBe(true)

			// Step 6: Write file and compute hash
			const testContent = "export const weather = {};"
			await fs.writeFile(path.join(testDir, "src", "api", "weather.ts"), testContent)

			const contentHash = await computeSHA256(path.join(testDir, "src", "api", "weather.ts"))
			const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex")
			expect(contentHash).toBe(expectedHash)

			// Step 7: Run postHook to create trace entry
			await postHook("write_to_file", { path: "src/api/weather.ts" }, { success: true }, testDir, "INT-001")

			// Verify trace entry was created
			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")
			const traceContent = await fs.readFile(traceFile, "utf-8")
			const lines = traceContent.trim().split("\n")
			expect(lines.length).toBe(1)
			const entry = JSON.parse(lines[0])
			expect(entry.intent_id).toBe("INT-001")
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
			await fs.writeFile(path.join(testDir, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Try to access file outside scope
			const scopeResult = await validateScope("src/payment/billing.ts", "INT-001", testDir)
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

		it("should handle parallel intent operations", async () => {
			// Create multiple intents
			const intentConfig = {
				active_intents: [
					{
						id: "INT-001",
						name: "Auth Feature",
						status: "IN_PROGRESS",
						owned_scope: ["src/auth/**"],
						constraints: [],
						acceptance_criteria: [],
					},
					{
						id: "INT-002",
						name: "Payment Feature",
						status: "IN_PROGRESS",
						owned_scope: ["src/payment/**"],
						constraints: [],
						acceptance_criteria: [],
					},
				],
			}
			await fs.writeFile(path.join(testDir, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Get all active intents
			const intents = await getActiveIntents(testDir)
			expect(intents.length).toBe(2)

			// Validate both intents can work in their respective scopes
			const authScope = await validateScope("src/auth/login.ts", "INT-001", testDir)
			const paymentScope = await validateScope("src/payment/checkout.ts", "INT-002", testDir)

			expect(authScope.valid).toBe(true)
			expect(paymentScope.valid).toBe(true)

			// But they can't cross scopes
			const crossScope = await validateScope("src/auth/login.ts", "INT-002", testDir)
			expect(crossScope.valid).toBe(false)
		})

		it("should classify commands correctly in flow", async () => {
			// Test command classification integration
			expect(classifyCommand("write_to_file")).toBe("destructive")
			expect(classifyCommand("edit")).toBe("destructive")
			expect(classifyCommand("read_file")).toBe("safe")
			expect(classifyCommand("search_files")).toBe("safe")
			expect(classifyCommand("list_files")).toBe("safe")

			// Test high-risk with specific paths - glob patterns in path are high risk
			expect(isHighRisk("write_to_file", { path: "src/**/*.ts" })).toBe(true)
			expect(isHighRisk("write_to_file", { path: "src/app.ts" })).toBe(false)
		})

		it("should handle complete workflow with trace", async () => {
			// Setup intent
			const intentConfig = {
				active_intents: [
					{
						id: "INT-003",
						name: "Add User Service",
						status: "IN_PROGRESS",
						owned_scope: ["src/auth/**"],
						constraints: [],
						acceptance_criteria: [],
					},
				],
			}
			await fs.writeFile(path.join(testDir, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Validate intent
			const intentResult = await validateIntentId("INT-003", testDir)
			expect(intentResult.valid).toBe(true)

			// Create file
			const filePath = path.join(testDir, "src", "auth", "service.ts")
			await fs.writeFile(filePath, "export class AuthService {}")

			// Post-hook
			await postHook("write_to_file", { path: "src/auth/service.ts" }, { success: true }, testDir, "INT-003")

			// Verify
			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")
			const content = await fs.readFile(traceFile, "utf-8")
			const entry = JSON.parse(content.trim().split("\n")[0])

			expect(entry.intent_id).toBe("INT-003")
			expect(entry.mutation_class).toBe("INTENT_EVOLUTION")
			expect(entry.files[0].relative_path).toBe("src/auth/service.ts")
		})

		it("should work with simple patterns in scope", async () => {
			const intentConfig = {
				active_intents: [
					{
						id: "INT-004",
						name: "API Work",
						status: "IN_PROGRESS",
						owned_scope: ["src/"],
						constraints: [],
						acceptance_criteria: [],
					},
				],
			}
			await fs.writeFile(path.join(testDir, ".orchestration", "active_intents.yaml"), yaml.dump(intentConfig))

			// Test various paths
			expect((await validateScope("src/api/v1/user.ts", "INT-004", testDir)).valid).toBe(true)
			expect((await validateScope("src/index.ts", "INT-004", testDir)).valid).toBe(true)
			expect((await validateScope("config/app.json", "INT-004", testDir)).valid).toBe(false)
		})
	})
})
