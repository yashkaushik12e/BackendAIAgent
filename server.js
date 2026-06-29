import dotenv from "dotenv"
dotenv.config()
import express from "express"
import cors from "cors"
import cookieParser from "cookie-parser"

import connectDb from "./config/connectDb.js"
import authRouter from "./routes/auth.route.js"
import userRouter from "./routes/user.route.js"
import interviewRouter from "./routes/interview.route.js"
import paymentRouter from "./routes/payment.route.js"
import errorHandler from "./middlewares/errorHandler.js"

const app = express()

app.use(cors({
    origin: process.env.CLIENT_URL ,
    credentials: true
}))

app.use(express.json())
app.use(cookieParser())

app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/interview", interviewRouter)
app.use("/api/payment", paymentRouter)

app.use(errorHandler)

const PORT = process.env.PORT 

const startServer = async()=>{
    try {
        await connectDb()
        app.listen(PORT,()=>{
            console.log(`Server is listening on the port:${PORT}`)
        })
    } catch (error) {
        console.log("FATAL:Failed to start server due to connection issues",error.message)
        process.exit(1)
    }
}

startServer();