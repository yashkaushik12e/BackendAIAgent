import crypto from "crypto"
import Payment from "../models/payment.model.js"
import User from "../models/user.model.js"
import getRazorpay from "../services/razorpay.service.js"

export const createOrder = async (req, res, next) => {
    try {
        const { planId, amount, credits } = req.body

        if (!amount || !credits || amount <= 0 || credits <= 0) {
            return res.status(400).json({ message: "Invalid plan data." })
        }

        const options = {
            amount: Math.round(amount * 100), // convert to paise, ensure integer
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        }
       const razorpay = getRazorpay()
        const order = await razorpay.orders.create(options)

        await Payment.create({
            userId: req.userId,
            planId: planId || "",
            amount,
            credits,
            razorpayOrderId: order.id,
            status: "created",
        })

        return res.status(201).json(order)

    } catch (error) {
        next(error)
    }
}

export const verifyPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ message: "Missing payment verification fields." })
        }

        // Verify signature
        const body = razorpay_order_id + "|" + razorpay_payment_id
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex")

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ message: "Invalid payment signature." })
        }

        const payment = await Payment.findOne({ razorpayOrderId: razorpay_order_id })

        if (!payment) {
            return res.status(404).json({ message: "Payment record not found." })
        }

        // FIX: ensure this payment belongs to the logged-in user
        if (payment.userId.toString() !== req.userId) {
            return res.status(403).json({ message: "Forbidden." })
        }

        // Idempotency check — prevent double processing
        if (payment.status === "paid") {
            return res.status(200).json({ message: "Payment already processed." })
        }

        payment.status = "paid"
        payment.razorpayPaymentId = razorpay_payment_id
        await payment.save()

        const updatedUser = await User.findByIdAndUpdate(
            payment.userId,
            { $inc: { credits: payment.credits } },
            { new: true }
        ).select("-__v")

        return res.status(200).json({
            success: true,
            message: "Payment verified and credits added.",
            credits: updatedUser.credits,
        })

    } catch (error) {
        next(error)
    }
}