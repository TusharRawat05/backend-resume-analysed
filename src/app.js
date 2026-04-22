const express = require("express")
const cookieParser = require("cookie-parser")
const cors = require("cors")

const app = express()
const allowedOrigins = [
    ...(process.env.FRONTEND_URLS || process.env.FRONTEND_URL || "").split(","),
    "https://frontend-resume-analyse.onrender.com",
    "http://localhost:5173",
].map(origin => origin.trim()).filter(Boolean)

app.use(express.json())
app.use(cookieParser())
app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            return callback(null, true)
        }

        return callback(new Error("Not allowed by CORS"))
    },
    credentials: true
}))

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "ok",
        version: "2026-04-22-2"
    })
})

/* require all the routes here */
const authRouter = require("./routes/auth.routes")
const interviewRouter = require("./routes/interview.routes")


/* using all the routes here */
app.use("/api/auth", authRouter)
app.use("/api/interview", interviewRouter)

app.use((error, req, res, next) => {
    console.error(error)

    if (error.message === "Not allowed by CORS") {
        return res.status(403).json({
            message: "This frontend URL is not allowed by backend CORS. Add it to FRONTEND_URLS on the backend deployment."
        })
    }

    res.status(error.status || 500).json({
        message: error.message || "Server error."
    })
})


module.exports = app
