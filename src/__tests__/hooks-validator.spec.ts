/**
 * Unit Tests for Hook System - Validator
 *
 * Tests the intent validation and scope matching functionality:
 * - Intent ID validation
 * - Scope pattern matching
 * - Path normalization
 */

import { vi, describe, it, expect, beforeEach } from "vitest"
import * as fs from "fs/promises"
import * as yaml from "js-yaml"
import { validateIntentId, validateScope, getActiveIntents } from "../hooks/validator"

describe("Validator", () => {
	const testCwd = "/test/workspace"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("validateIntentId", () => {
		it("should return error when active_intents.yaml does not exist", async () => {
			vi.spyOn(fs, "access").mockRejectedValue(new Error("ENOENT"))

			const result = await validateIntentId("INT-001", testCwd)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("No active_intents.yaml found")
		})

		it("should return error when YAML is malformed", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue("invalid: yaml: content:")

			const result = await validateIntentId("INT-001", testCwd)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("malformed")
		})

		it("should return error when intent ID does not exist", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [{ id: "INT-002", name: "Test", status: "IN_PROGRESS" }],
				}),
			)

			const result = await validateIntentId("INT-001", testCwd)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("not found")
			expect(result.message).toContain("INT-002")
		})

		it("should return error when intent status is not active", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "COMPLETED",
							owned_scope: ["src/**"],
						},
					],
				}),
			)

			const result = await validateIntentId("INT-001", testCwd)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("status")
		})

		it("should return valid with context for IN_PROGRESS intent", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
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
				}),
			)

			const result = await validateIntentId("INT-001", testCwd)

			expect(result.valid).toBe(true)
			expect(result.context).toBeDefined()
			expect(result.context?.id).toBe("INT-001")
			expect(result.context?.name).toBe("Build Weather API")
			expect(result.context?.owned_scope).toContain("src/weather/**")
		})

		it("should return valid with context for ACTIVE intent", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "ACTIVE",
							owned_scope: ["src/**"],
						},
					],
				}),
			)

			const result = await validateIntentId("INT-001", testCwd)

			expect(result.valid).toBe(true)
		})

		it("should handle empty active_intents array", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(yaml.dump({ active_intents: [] }))

			const result = await validateIntentId("INT-001", testCwd)

			expect(result.valid).toBe(false)
		})
	})

	describe("validateScope", () => {
		it("should return error when intent does not exist", async () => {
			vi.spyOn(fs, "access").mockRejectedValue(new Error("ENOENT"))

			const result = await validateScope("src/app.ts", "INT-001", testCwd)

			expect(result.valid).toBe(false)
		})

		it("should return valid for exact file match", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/app.ts"],
						},
					],
				}),
			)

			const result = await validateScope("src/app.ts", "INT-001", testCwd)

			expect(result.valid).toBe(true)
		})

		it("should return valid for glob pattern match", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/**/*.ts"],
						},
					],
				}),
			)

			const result = await validateScope("src/utils/helper.ts", "INT-001", testCwd)

			expect(result.valid).toBe(true)
		})

		it("should return valid for directory pattern match", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/auth/**"],
						},
					],
				}),
			)

			const result = await validateScope("src/auth/middleware.ts", "INT-001", testCwd)

			expect(result.valid).toBe(true)
		})

		it("should return error for file outside scope", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/auth/**"],
						},
					],
				}),
			)

			const result = await validateScope("src/payment/billing.ts", "INT-001", testCwd)

			expect(result.valid).toBe(false)
			expect(result.message).toContain("Scope Violation")
		})

		it("should handle Windows path separators", async () => {
			vi.spyOn(fs, "access").mockResolvedValue(undefined)
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{
							id: "INT-001",
							name: "Test",
							status: "IN_PROGRESS",
							owned_scope: ["src/auth/**"],
						},
					],
				}),
			)

			const result = await validateScope("src\\auth\\middleware.ts", "INT-001", testCwd)

			expect(result.valid).toBe(true)
		})
	})

	describe("getActiveIntents", () => {
		it("should return empty array when file does not exist", async () => {
			vi.spyOn(fs, "readFile").mockRejectedValue(new Error("ENOENT"))

			const result = await getActiveIntents(testCwd)

			expect(result).toEqual([])
		})

		it("should return parsed intents", async () => {
			vi.spyOn(fs, "readFile").mockResolvedValue(
				yaml.dump({
					active_intents: [
						{ id: "INT-001", name: "Test 1", status: "IN_PROGRESS" },
						{ id: "INT-002", name: "Test 2", status: "PENDING" },
					],
				}),
			)

			const result = await getActiveIntents(testCwd)

			expect(result).toHaveLength(2)
			expect(result[0].id).toBe("INT-001")
			expect(result[1].id).toBe("INT-002")
		})
	})
})
