/**
 * Unit Tests for Hook System - Validator
 *
 * Tests the intent validation and scope matching functionality:
 * - Intent ID validation
 * - Scope pattern matching
 * - Path normalization
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as yaml from "js-yaml"
import { validateIntentId, validateScope, getActiveIntents, IntentContext } from "../hooks/validator"

describe("Validator", () => {
	const testDir = path.join(process.cwd(), "test-temp-validator")
	const orchestrationDir = path.join(testDir, ".orchestration")

	beforeEach(async () => {
		await fs.mkdir(orchestrationDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe("validateIntentId", () => {
		it("should return error when active_intents.yaml does not exist", async () => {
			const result = await validateIntentId("INT-001", testDir)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("No active_intents.yaml found")
		})

		it("should return error when YAML is malformed", async () => {
			await fs.writeFile(path.join(orchestrationDir, "active_intents.yaml"), "invalid: yaml: content:")

			const result = await validateIntentId("INT-001", testDir)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("Error")
		})

		it("should return error when intent ID does not exist", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-002",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await validateIntentId("INT-001", testDir)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("not found")
		})

		it("should return error when intent status is not active", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "PENDING",
							owned_scope: ["src/"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await validateIntentId("INT-001", testDir)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("PENDING")
		})

		it("should return valid with context for IN_PROGRESS intent", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Build Weather API",
							status: "IN_PROGRESS",
							owned_scope: ["src/api/", "tests/"],
							constraints: ["Use TypeScript"],
							acceptance_criteria: ["API returns weather data"],
						},
					],
				}),
			)

			const result = await validateIntentId("INT-001", testDir)

			expect(result.valid).toBe(true)
			expect(result.context).toBeDefined()
			expect(result.context?.id).toBe("INT-001")
			expect(result.context?.name).toBe("Build Weather API")
			expect(result.context?.owned_scope).toContain("src/api/")
		})

		it("should return valid with context for ACTIVE intent", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-002",
							name: "Add Auth",
							status: "ACTIVE",
							owned_scope: ["src/auth/"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await validateIntentId("INT-002", testDir)

			expect(result.valid).toBe(true)
			expect(result.context).toBeDefined()
		})

		it("should handle empty active_intents array", async () => {
			await fs.writeFile(path.join(orchestrationDir, "active_intents.yaml"), yaml.dump({ active_intents: [] }))

			const result = await validateIntentId("INT-001", testDir)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("not found")
		})
	})

	describe("validateScope", () => {
		it("should return error when intent does not exist", async () => {
			// No active_intents.yaml
			const result = await validateScope("src/app.ts", "INT-001", testDir)

			expect(result.valid).toBe(false)
		})

		it("should return valid for exact file match", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/app.ts"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await validateScope("src/app.ts", "INT-001", testDir)

			expect(result.valid).toBe(true)
		})

		it("should return valid for exact file match with glob-like scope", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/api/*.ts"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await validateScope("src/api/weather.ts", "INT-001", testDir)

			expect(result.valid).toBe(true)
		})

		it("should return valid for directory pattern match", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/auth/"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await validateScope("src/auth/login.ts", "INT-001", testDir)

			expect(result.valid).toBe(true)
		})

		it("should return error for file outside scope", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/auth/"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await validateScope("src/payment/checkout.ts", "INT-001", testDir)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("Scope Violation")
		})

		it("should handle Windows path separators", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/app.ts"],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			// Test with Windows-style path
			const result = await validateScope("src\\app.ts", "INT-001", testDir)

			expect(result.valid).toBe(true)
		})
	})

	describe("getActiveIntents", () => {
		it("should return empty array when file does not exist", async () => {
			const result = await getActiveIntents(testDir)

			expect(result).toEqual([])
		})

		it("should return parsed intents", async () => {
			await fs.writeFile(
				path.join(orchestrationDir, "active_intents.yaml"),
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Task 1",
							status: "IN_PROGRESS",
							owned_scope: [],
							constraints: [],
							acceptance_criteria: [],
						},
						{
							id: "INT-002",
							name: "Task 2",
							status: "PENDING",
							owned_scope: [],
							constraints: [],
							acceptance_criteria: [],
						},
					],
				}),
			)

			const result = await getActiveIntents(testDir)

			expect(result.length).toBe(2)
			expect(result[0].id).toBe("INT-001")
			expect(result[1].id).toBe("INT-002")
		})
	})
})
