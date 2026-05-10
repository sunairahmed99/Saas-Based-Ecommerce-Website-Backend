import mongoose from "mongoose";

const PlatformSettingsSchema = new mongoose.Schema({
    paymentInstruction: {
        type: String,
        default: "Pay at this number 03082011585 JazzCash/EasyPaisa"
    }
}, { timestamps: true });

export default mongoose.model("PlatformSettings", PlatformSettingsSchema);
