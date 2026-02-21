/**
 * Task Complexity Analyzer
 * 
 * Analyzes user tasks to determine complexity level for prompt optimization.
 * This helps reduce system prompt length for simple tasks, making local/smaller
 * models more responsive.
 */

export type TaskComplexity = "simple" | "moderate" | "complex"

/**
 * Keywords that indicate simple tasks
 */
const SIMPLE_KEYWORDS = [
	"hi", "hello", "hey", "help", "thanks", "thank you",
	"what is", "who is", "how does", "explain",
	"summarize", "describe", "define",
	"calculate", "convert", "translate",
	"write a poem", "write a joke", "tell me",
	"what time", "what day", "weather",
]

/**
 * Keywords that indicate complex tasks
 */
const COMPLEX_KEYWORDS = [
	"refactor", "migrate", "architect", "design pattern",
	"implement", "create from scratch", "build entire",
	"optimize performance", "security audit",
	"full stack", "end to end", "comprehensive",
	"multiple files", "entire application", "complete rewrite",
]

/**
 * Analyzes a task message and returns its complexity level
 * 
 * @param taskMessage - The user's task message
 * @returns TaskComplexity - simple, moderate, or complex
 */
export function analyzeTaskComplexity(taskMessage: string): TaskComplexity {
	const normalizedMessage = taskMessage.toLowerCase().trim()
	const wordCount = normalizedMessage.split(/\s+/).length
	
	// Check for simple task keywords
	const simpleMatches = SIMPLE_KEYWORDS.filter(keyword => 
		normalizedMessage.includes(keyword)
	).length
	
	// Check for complex task keywords
	const complexMatches = COMPLEX_KEYWORDS.filter(keyword => 
		normalizedMessage.includes(keyword)
	).length
	
	// Very short messages are likely simple
	if (wordCount <= 3 && simpleMatches > 0) {
		return "simple"
	}
	
	// Short messages without complex keywords are likely simple
	if (wordCount <= 10 && complexMatches === 0) {
		return "simple"
	}
	
	// Messages with complex keywords or many words are complex
	if (wordCount > 50 || complexMatches > 0) {
		return "complex"
	}
	
	// Everything else is moderate
	return "moderate"
}

/**
 * Checks if a task is simple enough for lightweight prompt
 * 
 * @param taskMessage - The user's task message
 * @returns boolean - true if the task is simple
 */
export function isSimpleTask(taskMessage: string): boolean {
	return analyzeTaskComplexity(taskMessage) === "simple"
}

/**
 * Estimates the recommended context length based on task complexity
 * 
 * @param complexity - The task complexity level
 * @returns number - Recommended context length in tokens
 */
export function getRecommendedContextLength(complexity: TaskComplexity): number {
	switch (complexity) {
		case "simple":
			return 2048
		case "moderate":
			return 8192
		case "complex":
			return 32768
	}
}
