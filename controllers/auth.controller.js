import genToken from "../config/token.js"
import User from "../models/user.model.js"

export const googleAuth = async (req, res, next) => {
    try {
        const { name, email } = req.body

        if (!name || !email) {
            return res.status(400).json({ message: "Name and email are required." })
        }

        let user = await User.findOne({ email })

        if (!user) {
            user = await User.create({ name, email })
        }

        const token = genToken(user._id)

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // FIX: false in dev, true in prod
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        })

        return res.status(200).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            credits: user.credits,
        })

    } catch (error) {
        next(error) // FIX: pass to central error handler instead of swallowing
    }
}

export const logOut = async (req, res, next) => {
    try {
        res.clearCookie("token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        })
        return res.status(200).json({ message: "Logged out successfully." })
    } catch (error) {
        next(error)
    }
}