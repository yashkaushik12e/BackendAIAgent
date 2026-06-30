/**
 * Calculates average scores across all interview questions.
 * Extracted to avoid duplication between finishInterview and getInterviewReport.
 */
const calcAverages = (questions) => {
    const n = questions.length || 1

    const sum = questions.reduce(
        (acc, q) => ({
            score: acc.score + (q.score || 0),
            confidence: acc.confidence + (q.confidence || 0),
            communication: acc.communication + (q.communication || 0),
            correctness: acc.correctness + (q.correctness || 0),
        }),
        { score: 0, confidence: 0, communication: 0, correctness: 0 }
    )

    return {
        finalScore: Number((sum.score / n).toFixed(1)),
        confidence: Number((sum.confidence / n).toFixed(1)),
        communication: Number((sum.communication / n).toFixed(1)),
        correctness: Number((sum.correctness / n).toFixed(1)),
    }
}

export default calcAverages