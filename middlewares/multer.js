import multer from "multer"
import path from "path"
import fs from "fs"

// Create upload directory if it doesn't exist
const uploadDir = "public/uploads"
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        const filename = `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`
        cb(null, filename)
    },
})

const fileFilter = (req, file, cb) => {
    const allowed = [".pdf"]
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowed.includes(ext)) {
        cb(null, true)
    } else {
        cb(new Error("Only PDF files are allowed."), false)
    }
}

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter,
})