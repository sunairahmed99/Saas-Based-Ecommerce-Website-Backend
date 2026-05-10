import PlatformSettings from "../Models/PlatformSettingsSchema.js";

// Get settings
export const getSettings = async (req, res) => {
    try {
        let settings = await PlatformSettings.findOne();
        if (!settings) {
            settings = await PlatformSettings.create({});
        }
        res.status(200).json({ success: true, data: settings });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// Update settings
export const updateSettings = async (req, res) => {
    try {
        const { paymentInstruction } = req.body;
        let settings = await PlatformSettings.findOne();
        
        if (!settings) {
            settings = await PlatformSettings.create({ paymentInstruction });
        } else {
            if (paymentInstruction !== undefined) {
                settings.paymentInstruction = paymentInstruction;
            }
            await settings.save();
        }
        
        res.status(200).json({ success: true, data: settings, message: "Settings updated successfully" });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
