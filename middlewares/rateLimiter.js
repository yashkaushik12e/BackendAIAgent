import rateLimit from "express-rate-limit"

// Limit AI-heavy routes to prevent credit abuse and API hammering
export const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10,
    message: { message: "Too many requests. Please wait a minute and try again." },
    standardHeaders: true,
    legacyHeaders: false,
})

// Stricter limit for auth routes to prevent brute force
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: { message: "Too many login attempts. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
})