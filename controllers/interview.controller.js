import fs from "fs"
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs"
import { askAi } from "../services/openRouter.service.js"
import User from "../models/user.model.js"
import Interview from "../models/interview.model.js"
import safeParseAI from "../utils/safeParseAI.js"
import calcAverages from "../utils/calcAverages.js"

// ─── Analyze Resume ────────────────────────────────────────────────────────────

export const analyzeResume = async (req, res, next) => {
    let filePath = null

    try {
        if (!req.file) {
            return res.status(400).json({ message: "Resume file is required." })
        }

        filePath = req.file.path

        const fileBuffer = await fs.promises.readFile(filePath)
        const uint8Array = new Uint8Array(fileBuffer)
        const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise

        let resumeText = ""
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum)
            const content = await page.getTextContent()
            resumeText += content.items.map((item) => item.str).join(" ") + "\n"
        }

        resumeText = resumeText.replace(/\s+/g, " ").trim()

        if (!resumeText) {
            return res.status(400).json({ message: "Could not extract text from PDF." })
        }

        const messages = [
            {
                role: "system",
                content: `Extract structured data from the resume. Return ONLY valid JSON, no markdown, no explanation:
{
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}`,
            },
            { role: "user", content: resumeText },
        ]

        const aiResponse = await askAi(messages)
        const parsed = safeParseAI(aiResponse) // FIX: safe JSON parse

        // Clean up uploaded file
        fs.unlinkSync(filePath)
        filePath = null

        return res.status(200).json({
            role: parsed.role || "",
            experience: parsed.experience || "",
            projects: Array.isArray(parsed.projects) ? parsed.projects : [],
            skills: Array.isArray(parsed.skills) ? parsed.skills : [],
            resumeText,
        })

    } catch (error) {
        // Always clean up file even if something fails
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
        }
        next(error)
    }
}

// ─── Generate Questions ────────────────────────────────────────────────────────

export const generateQuestion = async (req, res, next) => {
    try {
        let { role, experience, mode, resumeText, projects, skills } = req.body

        role = role?.trim()
        experience = experience?.trim()
        mode = mode?.trim()

        if (!role || !experience || !mode) {
            return res.status(400).json({ message: "Role, experience and mode are required." })
        }

        const user = await User.findById(req.userId)
        if (!user) {
            return res.status(404).json({ message: "User not found." })
        }

        if (user.credits < 50) {
            return res.status(400).json({
                message: `Not enough credits. You have ${user.credits} but need 50.`,
            })
        }

        const projectText =
            Array.isArray(projects) && projects.length ? projects.join(", ") : "None"
        const skillsText =
            Array.isArray(skills) && skills.length ? skills.join(", ") : "None"
        const safeResume = resumeText?.trim() || "None"

        const messages = [
            {
                role: "system",
                content: `You are a real human interviewer conducting a professional interview.
Speak in simple, natural English as if directly talking to the candidate.

Generate exactly 5 interview questions.

Strict Rules:
- Each question must be between 15 and 25 words.
- Each question must be a single complete sentence.
- Do NOT number them.
- Do NOT add explanations or extra text.
- One question per line only.
- Keep language simple and conversational.

Difficulty progression:
Question 1 → easy
Question 2 → easy
Question 3 → medium
Question 4 → medium
Question 5 → hard

Base questions on the candidate's role, experience, mode, projects, skills, and resume.`,
            },
            {
                role: "user",
                content: `Role: ${role}
Experience: ${experience}
Interview Mode: ${mode}
Projects: ${projectText}
Skills: ${skillsText}
Resume: ${safeResume}`,
            },
        ]

        const aiResponse = await askAi(messages)

        const questionsArray = aiResponse
            .split("\n")
            .map((q) => q.trim())
            .filter((q) => q.length > 0)
            .slice(0, 5)

        if (questionsArray.length === 0) {
            return res.status(500).json({ message: "AI failed to generate questions." })
        }

        // Deduct credits after successful generation
        user.credits -= 50
        await user.save()

        const interview = await Interview.create({
            userId: user._id,
            role,
            experience,
            mode,
            resumeText: safeResume,
            questions: questionsArray.map((q, index) => ({
                question: q,
                difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
                timeLimit: [60, 60, 90, 90, 120][index],
            })),
        })

        return res.status(201).json({
            interviewId: interview._id,
            creditsLeft: user.credits,
            userName: user.name,
            questions: interview.questions,
        })

    } catch (error) {
        next(error)
    }
}

// ─── Submit Answer ─────────────────────────────────────────────────────────────

export const submitAnswer = async (req, res, next) => {
    try {
        const { interviewId, questionIndex, answer, timeTaken } = req.body

        if (interviewId === undefined || questionIndex === undefined) {
            return res.status(400).json({ message: "interviewId and questionIndex are required." })
        }

        const interview = await Interview.findById(interviewId)

        if (!interview) {
            return res.status(404).json({ message: "Interview not found." })
        }

        // FIX: ownership check — only the owner can submit answers
        if (interview.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "Forbidden." })
        }

        // FIX: bounds check — prevent crash on invalid index
        if (questionIndex < 0 || questionIndex >= interview.questions.length) {
            return res.status(400).json({ message: "Invalid question index." })
        }

        const question = interview.questions[questionIndex]

        // No answer submitted
        if (!answer || !answer.trim()) {
            question.score = 0
            question.feedback = "You did not submit an answer."
            question.answer = ""
            await interview.save()
            return res.status(200).json({ feedback: question.feedback })
        }

        // Time exceeded
        if (timeTaken > question.timeLimit) {
            question.score = 0
            question.feedback = "Time limit exceeded. Answer not evaluated."
            question.answer = answer
            await interview.save()
            return res.status(200).json({ feedback: question.feedback })
        }

        const messages = [
            {
                role: "system",
                content: `You are a professional human interviewer evaluating a candidate's answer.

Score in these areas (0 to 10):
1. Confidence – Clear, confident, well-presented?
2. Communication – Simple, clear, easy to understand?
3. Correctness – Accurate, relevant, complete?

Rules:
- Be realistic. Do not give random high scores.
- Weak answer = low score. Strong answer = high score.
- finalScore = average of the three scores, rounded to nearest whole number.
- Feedback: 10 to 15 words, natural and professional tone.
- Do NOT repeat the question. Do NOT explain scoring.

Return ONLY valid JSON, no markdown:
{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short human feedback"
}`,
            },
            {
                role: "user",
                content: `Question: ${question.question}\nAnswer: ${answer}`,
            },
        ]

        const aiResponse = await askAi(messages)
        const parsed = safeParseAI(aiResponse) // FIX: safe JSON parse

        question.answer = answer
        question.confidence = parsed.confidence
        question.communication = parsed.communication
        question.correctness = parsed.correctness
        question.score = parsed.finalScore
        question.feedback = parsed.feedback
        await interview.save()

        return res.status(200).json({ feedback: parsed.feedback })

    } catch (error) {
        next(error)
    }
}

// ─── Finish Interview ──────────────────────────────────────────────────────────

export const finishInterview = async (req, res, next) => {
    try {
        const { interviewId } = req.body

        if (!interviewId) {
            return res.status(400).json({ message: "interviewId is required." })
        }

        const interview = await Interview.findById(interviewId)

        if (!interview) {
            return res.status(404).json({ message: "Interview not found." })
        }

        // FIX: ownership check
        if (interview.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "Forbidden." })
        }

        const averages = calcAverages(interview.questions) // FIX: reusable utility

        interview.finalScore = averages.finalScore
        interview.status = "completed"
        await interview.save()

        return res.status(200).json({
            ...averages,
            questionWiseScore: interview.questions.map((q) => ({
                question: q.question,
                score: q.score || 0,
                feedback: q.feedback || "",
                confidence: q.confidence || 0,
                communication: q.communication || 0,
                correctness: q.correctness || 0,
            })),
        })

    } catch (error) {
        next(error)
    }
}

// ─── Get My Interviews ─────────────────────────────────────────────────────────

export const getMyInterviews = async (req, res, next) => {
    try {
        const interviews = await Interview.find({ userId: req.userId })
            .sort({ createdAt: -1 })
            .select("role experience mode finalScore status createdAt")

        return res.status(200).json(interviews)

    } catch (error) {
        next(error)
    }
}

// ─── Get Interview Report ──────────────────────────────────────────────────────

export const getInterviewReport = async (req, res, next) => {
    try {
        const interview = await Interview.findById(req.params.id)

        if (!interview) {
            return res.status(404).json({ message: "Interview not found." })
        }

        // FIX: ownership check — only the owner can view their report
        if (interview.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "Forbidden." })
        }

        const averages = calcAverages(interview.questions) // FIX: reusable utility

        return res.status(200).json({
            ...averages,
            questionWiseScore: interview.questions,
        })

    } catch (error) {
        next(error)
    }
}