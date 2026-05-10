import mongoose from "mongoose";

const ProductBoostRequestSchema = new mongoose.Schema({
    sellerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Seller",
        required: true,
    },
    packageId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BoostPackage",
        required: true,
    },
    productIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    }],
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "active", "expired", "cancelled"],
        default: "pending",
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
    },
    approvedAt: {
        type: Date,
    },
    startDate: {
        type: Date,
    },
    endDate: {
        type: Date,
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "completed", "failed"],
        default: "pending",
    },
    paymentId: {
        type: String,
    },
    paymentScreenshot: {
        type: String,
    },
    totalAmount: {
        type: Number,
        required: true,
    },
    notes: {
        type: String,
    }
}, { timestamps: true });

// Index for efficient queries
ProductBoostRequestSchema.index({ sellerId: 1, status: 1 });
ProductBoostRequestSchema.index({ status: 1 });
ProductBoostRequestSchema.index({ endDate: 1 });

export default mongoose.model("ProductBoostRequest", ProductBoostRequestSchema);
