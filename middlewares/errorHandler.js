const errorHandler = (err, req, res, next) => {
    const status = err.status || 500

    // In production, hide internal error details from client
    const message =
        process.env.NODE_ENV === "production"
            ? status === 500
                ? "Something went wrong. Please try again."
                : err.message
            : err.message || "Internal server error"

    if (process.env.NODE_ENV !== "production") {
        console.error(`[${req.method}] ${req.path} →`, err.message)
    }

    return res.status(status).json({ message })
}

export default errorHandler