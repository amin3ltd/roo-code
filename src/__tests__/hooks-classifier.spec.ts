/**
 * Unit Tests for Hook System - Classifier
 *
 * Tests the command classification functionality:
 * - Safe vs Destructive command classification
 * - High-risk command detection
 * - Tool name normalization
 */

import { classifyCommand, isHighRisk, CommandClassification } from "../hooks/classifier"

describe("Classifier", () => {
	describe("classifyCommand", () => {
		describe("Safe Commands", () => {
			it("should classify read_file as safe", () => {
				expect(classifyCommand("read_file")).toBe("safe")
			})

			it("should classify list_files as safe", () => {
				expect(classifyCommand("list_files")).toBe("safe")
			})

			it("should classify list_directory as safe", () => {
				expect(classifyCommand("list_directory")).toBe("safe")
			})

			it("should classify search_files as safe", () => {
				expect(classifyCommand("search_files")).toBe("safe")
			})

			it("should classify search_and_replace (read mode) as safe", () => {
				expect(classifyCommand("search_and_replace")).toBe("safe")
			})

			it("should classify read_command_output as safe", () => {
				expect(classifyCommand("read_command_output")).toBe("safe")
			})

			it("should classify ask_followup_question as safe", () => {
				expect(classifyCommand("ask_followup_question")).toBe("safe")
			})

			it("should classify update_todo_list as safe", () => {
				expect(classifyCommand("update_todo_list")).toBe("safe")
			})
		})

		describe("Destructive Commands", () => {
			it("should classify write_to_file as destructive", () => {
				expect(classifyCommand("write_to_file")).toBe("destructive")
			})

			it("should classify edit as destructive", () => {
				expect(classifyCommand("edit")).toBe("destructive")
			})

			it("should classify edit_file as destructive", () => {
				expect(classifyCommand("edit_file")).toBe("destructive")
			})

			it("should classify delete_file as destructive", () => {
				expect(classifyCommand("delete_file")).toBe("destructive")
			})

			it("should classify execute_command as destructive", () => {
				expect(classifyCommand("execute_command")).toBe("destructive")
			})

			it("should classify apply_diff as destructive", () => {
				expect(classifyCommand("apply_diff")).toBe("destructive")
			})

			it("should classify apply_patch as destructive", () => {
				expect(classifyCommand("apply_patch")).toBe("destructive")
			})
		})

		describe("Unknown Commands", () => {
			it("should default unknown commands to destructive (fail-safe)", () => {
				expect(classifyCommand("unknown_tool")).toBe("destructive")
				expect(classifyCommand("random_command")).toBe("destructive")
				expect(classifyCommand("do_something")).toBe("destructive")
			})
		})

		describe("Tool Name Aliases", () => {
			it("should normalize write_file alias to write_to_file", () => {
				expect(classifyCommand("write_file")).toBe("destructive")
			})

			it("should normalize str_replace_editor alias to write_to_file", () => {
				expect(classifyCommand("str_replace_editor")).toBe("destructive")
			})

			it("should normalize insert_content_at_line to edit_file", () => {
				expect(classifyCommand("insert_content_at_line")).toBe("destructive")
			})

			it("should normalize multi_edit to edit", () => {
				expect(classifyCommand("multi_edit")).toBe("destructive")
			})
		})
	})

	describe("isHighRisk", () => {
		describe("Safe Commands", () => {
			it("should return false for safe commands", () => {
				expect(isHighRisk("read_file")).toBe(false)
				expect(isHighRisk("search_files")).toBe(false)
			})
		})

		describe("Destructive Commands - Additional Risk", () => {
			it("should detect rm -rf as high risk", () => {
				expect(isHighRisk("execute_command", { command: "rm -rf /" })).toBe(true)
			})

			it("should detect Windows del /s /q as high risk", () => {
				expect(isHighRisk("execute_command", { command: "del /s /q C:\\" })).toBe(true)
			})

			it("should detect drop table as high risk", () => {
				expect(isHighRisk("execute_command", { command: "DROP TABLE users" })).toBe(true)
			})

			it("should detect truncate as high risk", () => {
				expect(isHighRisk("execute_command", { command: "TRUNCATE TABLE logs" })).toBe(true)
			})

			it("should detect chmod 777 as high risk", () => {
				expect(isHighRisk("execute_command", { command: "chmod 777 /" })).toBe(true)
			})

			it("should detect glob patterns in paths as high risk", () => {
				expect(isHighRisk("delete_file", { path: "src/**/*.ts" })).toBe(true)
				expect(isHighRisk("write_to_file", { path: "**/*.js" })).toBe(true)
			})
		})

		describe("Regular Destructive Commands", () => {
			it("should return false for regular destructive commands without risky params", () => {
				expect(isHighRisk("write_to_file", { path: "src/app.ts" })).toBe(false)
				expect(isHighRisk("edit", { path: "src/index.ts" })).toBe(false)
			})
		})
	})
})
