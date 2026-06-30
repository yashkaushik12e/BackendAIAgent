/**
 * Safely parses AI response that may contain markdown code fences.
 * Throws a clean error instead of crashing if JSON is malformed.
 */
const safeParseAI = (raw) => {
    try {
        // Strip markdown code fences if AI wraps response in ```json ... ```
        const cleaned = raw
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim()

        return JSON.parse(cleaned)
    } catch {
        throw new Error("AI returned invalid JSON. Please try again.")
    }
}

export default safeParseAI