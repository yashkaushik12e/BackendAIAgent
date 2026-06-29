import jwt from "jsonwebtoken"

const isAuth = (req, res, next) => {
    try {
        const { token } = req.cookies
 
        if (!token) {
            return res.status(401).json({ message: "Unauthorized. Please log in." })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)

        if (!decoded) {
            return res.status(401).json({ message: "Invalid or expired token." })
        }

        req.userId = decoded.userId
        next()

    } catch (error) {
        return res.status(401).json({ message: "Invalid or expired token." })
    }
}

export default isAuth