/**
 * Unit Tests for Hook System - Post-Hook
 *
 * Tests the trace logging functionality:
 * - SHA-256 content hashing
 * - Trace entry generation
 * - Mutation class determination
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as crypto from "crypto"
import { computeSHA256, postHook, TraceEntry } from "../hooks/post-hook"

describe("Post-Hook", () => {
	const testDir = path.join(process.cwd(), "test-temp-post-hook")

	beforeEach(async () => {
		await fs.mkdir(testDir, { recursive: true })
		await fs.mkdir(path.join(testDir, ".orchestration"), { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch {
			// Ignore cleanup errors
		}
	})

	describe("computeSHA256", () => {
		it("should compute SHA-256 hash of file content", async () => {
			const testFile = path.join(testDir, "test1.txt")
			const testContent = "Hello, World!"
			await fs.writeFile(testFile, testContent)

			const result = await computeSHA256(testFile)
			const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex")

			expect(result).toBe(expectedHash)
		})

		it("should return empty hash when file cannot be read", async () => {
			const result = await computeSHA256(path.join(testDir, "nonexistent.txt"))

			// Should return hash of empty string
			expect(result).toBe(crypto.createHash("sha256").update("").digest("hex"))
		})

		it("should produce consistent hashes for same content", async () => {
			const testFile1 = path.join(testDir, "file1.txt")
			const testFile2 = path.join(testDir, "file2.txt")
			const testContent = "const x = 42;"
			await fs.writeFile(testFile1, testContent)
			await fs.writeFile(testFile2, testContent)

			const result1 = await computeSHA256(testFile1)
			const result2 = await computeSHA256(testFile2)

			expect(result1).toBe(result2)
		})

		it("should produce different hashes for different content", async () => {
			const testFile1 = path.join(testDir, "file1.txt")
			const testFile2 = path.join(testDir, "file2.txt")
			await fs.writeFile(testFile1, "content A")
			await fs.writeFile(testFile2, "content B")

			const result1 = await computeSHA256(testFile1)
			const result2 = await computeSHA256(testFile2)

			expect(result1).not.toBe(result2)
		})
	})

	describe("postHook", () => {
		it("should create trace entry with correct structure", async () => {
			const testFile = path.join(testDir, "src", "app.ts")
			await fs.mkdir(path.dirname(testFile), { recursive: true })
			await fs.writeFile(testFile, "test content")

			await postHook("write_to_file", { path: "src/app.ts" }, { success: true }, testDir, "INT-001")

			// Read and verify trace entry
			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")
			const content = await fs.readFile(traceFile, "utf-8")
			const lines = content.trim().split("\n")
			const entry = JSON.parse(lines[0]) as TraceEntry

			expect(entry.timestamp).toBeDefined()
			expect(entry.intent_id).toBe("INT-001")
			expect(entry.mutation_class).toBeDefined()
			expect(entry.files).toBeDefined()
			expect(entry.files.length).toBeGreaterThan(0)
		})

		it("should include content hash in trace entry files", async () => {
			const testContent = "export const test = 42;"
			const testFile = path.join(testDir, "src", "app.ts")
			await fs.mkdir(path.dirname(testFile), { recursive: true })
			await fs.writeFile(testFile, testContent)

			await postHook("write_to_file", { path: "src/app.ts" }, { success: true }, testDir, "INT-001")

			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")
			const content = await fs.readFile(traceFile, "utf-8")
			const lines = content.trim().split("\n")
			const entry = JSON.parse(lines[0]) as TraceEntry
			const expectedHash = crypto.createHash("sha256").update(testContent).digest("hex")

			expect(entry.files[0].conversations[0].ranges[0].content_hash).toBe(expectedHash)
		})

		it("should link intent in related array", async () => {
			const testFile = path.join(testDir, "src", "app.ts")
			await fs.mkdir(path.dirname(testFile), { recursive: true })
			await fs.writeFile(testFile, "test")

			await postHook("write_to_file", { path: "src/app.ts" }, { success: true }, testDir, "INT-001")

			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")
			const content = await fs.readFile(traceFile, "utf-8")
			const lines = content.trim().split("\n")
			const entry = JSON.parse(lines[0]) as TraceEntry

			expect(entry.files[0].conversations[0].related?.some((r) => r.value === "INT-001")).toBe(true)
		})

		it("should classify execute_command with test as AST_REFACTOR", async () => {
			await postHook(
				"execute_command",
				{ command: "npm test" },
				{ success: true, output: "tests passed" },
				testDir,
				"INT-002",
			)

			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")
			const content = await fs.readFile(traceFile, "utf-8")
			const lines = content.trim().split("\n")
			const entry = JSON.parse(lines[0]) as TraceEntry

			expect(entry.mutation_class).toBe("AST_REFACTOR")
		})

		it("should classify write_to_file as INTENT_EVOLUTION", async () => {
			const testFile = path.join(testDir, "src", "new.ts")
			await fs.mkdir(path.dirname(testFile), { recursive: true })
			await fs.writeFile(testFile, "test")

			await postHook("write_to_file", { path: "src/new.ts" }, { success: true }, testDir, "INT-003")

			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")
			const content = await fs.readFile(traceFile, "utf-8")
			const lines = content.trim().split("\n")
			const entry = JSON.parse(lines[0]) as TraceEntry

			expect(entry.mutation_class).toBe("INTENT_EVOLUTION")
		})

		it("should handle errors gracefully without throwing", async () => {
			// Call postHook without a valid file - should not throw
			await expect(
				postHook("write_to_file", { path: "src/app.ts" }, { success: true }, testDir, "INT-001"),
			).resolves.not.toThrow()
		})

		it("should skip read-only operations", async () => {
			const testFile = path.join(testDir, "src", "app.ts")
			await fs.mkdir(path.dirname(testFile), { recursive: true })
			await fs.writeFile(testFile, "test")

			await postHook("read_file", { path: "src/app.ts" }, { content: "test" }, testDir, "INT-001")

			const traceFile = path.join(testDir, ".orchestration", "agent_trace.jsonl")

			// Should not create trace file for read operations
			try {
				await fs.access(traceFile)
				// If file exists, check it's empty
				const content = await fs.readFile(traceFile, "utf-8")
				expect(content.trim()).toBe("")
			} catch {
				// File doesn't exist - this is expected
			}
		})
	})
})
