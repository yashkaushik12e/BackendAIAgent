import mongoose from "mongoose"

const paymentSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        planId: { type: String, default: "" },
        amount: { type: Number, required: true },
        credits: { type: Number, required: true },
        razorpayOrderId: { type: String, required: true },
        razorpayPaymentId: { type: String, default: "" },
        status: {
            type: String,
            enum: ["created", "paid", "failed"],
            default: "created",
        },
    },
    { timestamps: true }
)

const Payment = mongoose.model("Payment", paymentSchema)

export default Payment