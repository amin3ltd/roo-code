/**
 * Unit Tests for Hook System - Post-Hook
 *
 * Tests the trace logging functionality:
 * - SHA-256 content hashing
 * - Trace entry generation
 * - Mutation class determination
 */

import { vi, describe, it, expect, beforeEach } from "vitest"
import * as fs from "fs/promises"
import * as crypto from "crypto"
import { computeSHA256, postHook, TraceEntry } from "../hooks/post-hook"

describe("Post-Hook", () => {
	const testCwd = "/test/workspace"

	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe("computeSHA256", () => {
		it("should compute SHA-256 hash of file content", async () => {
			const testContent = "Hello, World!"
			const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex")

			vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from(testContent))

			const result = await computeSHA256("/test/file.txt")

			expect(result).toBe(expectedHash)
		})

		it("should return empty hash when file cannot be read", async () => {
			vi.spyOn(fs, "readFile").mockRejectedValue(new Error("ENOENT"))

			const result = await computeSHA256("/nonexistent/file.txt")

			// Should return hash of empty string
			expect(result).toBe(crypto.createHash("sha256").update("").digest("hex"))
		})

		it("should produce consistent hashes for same content", async () => {
			const testContent = "const x = 42;"
			vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from(testContent))

			const result1 = await computeSHA256("/test/file1.txt")
			const result2 = await computeSHA256("/test/file2.txt")

			expect(result1).toBe(result2)
		})

		it("should produce different hashes for different content", async () => {
			vi.spyOn(fs, "readFile")
				.mockResolvedValueOnce(Buffer.from("content A"))
				.mockResolvedValueOnce(Buffer.from("content B"))

			const result1 = await computeSHA256("/test/file1.txt")
			const result2 = await computeSHA256("/test/file2.txt")

			expect(result1).not.toBe(result2)
		})
	})

	describe("postHook", () => {
		it("should skip logging for read-only tools", async () => {
			const result = await postHook("read_file", { path: "test.ts" }, {}, testCwd)

			// Should return early without throwing
			expect(result).toBeUndefined()
		})

		it("should skip logging when no intent_id provided", async () => {
			const result = await postHook("write_to_file", { path: "src/app.ts" }, {}, testCwd, undefined)

			expect(result).toBeUndefined()
		})

		it("should create trace entry with correct structure", async () => {
			vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from("test content"))
			vi.spyOn(fs, "mkdir").mockResolvedValue(undefined)
			vi.spyOn(fs, "appendFile").mockResolvedValue(undefined)

			await postHook(
				"write_to_file",
				{
					path: "src/app.ts",
					start_line: 1,
					end_line: 10,
				},
				{},
				testCwd,
				"INT-001",
			)

			// Verify appendFile was called with a valid JSON line
			expect(fs.appendFile).toHaveBeenCalled()
			const appendedContent = (fs.appendFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as string

			// The content should be a valid JSON line (ends with newline)
			expect(appendedContent.endsWith("\n")).toBe(true)

			// Should be valid JSON
			const entry = JSON.parse(appendedContent.trim())
			expect(entry).toHaveProperty("id")
			expect(entry).toHaveProperty("timestamp")
			expect(entry).toHaveProperty("intent_id", "INT-001")
			expect(entry).toHaveProperty("mutation_class")
			expect(entry).toHaveProperty("files")
		})

		it("should include content hash in trace entry", async () => {
			const testContent = "console.log('test')"
			const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex")

			vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from(testContent))
			vi.spyOn(fs, "mkdir").mockResolvedValue(undefined)
			vi.spyOn(fs, "appendFile").mockResolvedValue(undefined)

			await postHook(
				"write_to_file",
				{
					path: "src/app.ts",
					start_line: 1,
					end_line: 1,
				},
				{},
				testCwd,
				"INT-001",
			)

			const appendedContent = (fs.appendFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
			const entry = JSON.parse(appendedContent.trim())

			expect(entry.files[0].conversations[0].ranges[0].content_hash).toBe(expectedHash)
		})

		it("should link intent in related array", async () => {
			vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from("test"))
			vi.spyOn(fs, "mkdir").mockResolvedValue(undefined)
			vi.spyOn(fs, "appendFile").mockResolvedValue(undefined)

			await postHook("write_to_file", { path: "src/app.ts" }, {}, testCwd, "INT-001")

			const appendedContent = (fs.appendFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
			const entry = JSON.parse(appendedContent.trim())

			expect(entry.files[0].conversations[0].related).toContainEqual({
				type: "intent",
				value: "INT-001",
			})
		})

		it("should classify execute_command with test as AST_REFACTOR", async () => {
			vi.spyOn(fs, "mkdir").mockResolvedValue(undefined)
			vi.spyOn(fs, "appendFile").mockResolvedValue(undefined)

			await postHook("execute_command", { command: "npm test" }, {}, testCwd, "INT-001")

			const appendedContent = (fs.appendFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
			const entry = JSON.parse(appendedContent.trim())

			expect(entry.mutation_class).toBe("AST_REFACTOR")
		})

		it("should classify write_to_file as INTENT_EVOLUTION", async () => {
			vi.spyOn(fs, "readFile").mockResolvedValue(Buffer.from("test"))
			vi.spyOn(fs, "mkdir").mockResolvedValue(undefined)
			vi.spyOn(fs, "appendFile").mockResolvedValue(undefined)

			await postHook("write_to_file", { path: "src/app.ts" }, {}, testCwd, "INT-001")

			const appendedContent = (fs.appendFile as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
			const entry = JSON.parse(appendedContent.trim())

			expect(entry.mutation_class).toBe("INTENT_EVOLUTION")
		})

		it("should handle errors gracefully without throwing", async () => {
			vi.spyOn(fs, "readFile").mockRejectedValue(new Error("Mock error"))

			// Should not throw
			await expect(
				postHook("write_to_file", { path: "src/app.ts" }, {}, testCwd, "INT-001"),
			).resolves.not.toThrow()
		})
	})
})
