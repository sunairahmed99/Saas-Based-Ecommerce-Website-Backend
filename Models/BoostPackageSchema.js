import mongoose from "mongoose";

const BoostPackageSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    productLimit: {
        type: Number,
        required: true,
        min: 1,
        description: "Maximum number of products that can be boosted with this package"
    },
    duration: {
        type: Number,
        required: true,
        min: 1,
        description: "Duration in days"
    },
    durationType: {
        type: String,
        enum: ["days", "weeks", "months"],
        default: "days"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, { timestamps: true });

export default mongoose.model("BoostPackage", BoostPackageSchema);
