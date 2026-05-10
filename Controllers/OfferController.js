import Offer, { Banner } from "../Models/OfferSchema.js";
import { uploadImageToCloudinary } from "../Middleware/Uploadmiddleware.js";

const createOffer = async (req, res) => {
    try {
        const { title, description, offerStartDateTime, offerEndDateTime } = req.body;
        let imageUrl = null;
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "offers");
                imageUrl = uploadResult.secure_url;
            } catch (err) {
            }
        }
        const offer = await Offer.create({
            title,
            description,
            image: imageUrl,
            offerStartDateTime,
            offerEndDateTime
        });
        return res.status(200).json({ status: "success", data: offer });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "something went wrong try later" })
    }
};

const getAllOffers = async (req, res) => {
    try {
        const offers = await Offer.find();
        return res.status(200).json({ status: "success", data: offers });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "something went wrong try later" });
    }
};

const updateOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, offerStartDateTime, offerEndDateTime } = req.body;
        const existingOffer = await Offer.findById(id);
        if (!existingOffer) {
            return res.status(404).json({ status: "fail", message: "Offer not found" });
        }
        let imageUrl = existingOffer.image;
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "offers");
                imageUrl = uploadResult.secure_url;
            } catch (error) {
            }
        }
        const updatedOffer = await Offer.findByIdAndUpdate(
            id,
            { title, description, image: imageUrl, offerStartDateTime, offerEndDateTime },
            { new: true }
        );
        return res.status(200).json({ status: "success", data: updatedOffer });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong, try later" });
    }
};

const deleteOffer = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await Offer.findByIdAndDelete(id);
        return res.status(200).json({ status: "success", data: offer });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "something went wrong try later" });
    }
};

// Banner Controller Functions
const createBanner = async (req, res) => {
    try {
        const {
            title,
            subtitle,
            description,
            buttonText,
            buttonLink,
            color,
            isActive,
            sortOrder
        } = req.body;

        let imageUrl = null;
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "banners");
                imageUrl = uploadResult.secure_url;
            } catch (err) {
                console.error("Banner image upload error:", err);
            }
        }

        const banner = await Banner.create({
            title,
            subtitle,
            description,
            image: imageUrl,
            buttonText: buttonText || "Shop Now",
            buttonLink: buttonLink || "/shop",
            color: color || "#00eaff",
            isActive: isActive !== undefined ? isActive : true,
            sortOrder: sortOrder || 0
        });

        return res.status(200).json({ success: true, data: banner });
    } catch (err) {
        console.error("Create banner error:", err);
        return res.status(500).json({ success: false, message: "Failed to create banner" });
    }
};

const getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
        return res.status(200).json({ success: true, data: banners });
    } catch (err) {
        console.error("Get banners error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch banners" });
    }
};

const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            title,
            subtitle,
            description,
            buttonText,
            buttonLink,
            color,
            isActive,
            sortOrder
        } = req.body;

        const existingBanner = await Banner.findById(id);
        if (!existingBanner) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }

        let imageUrl = existingBanner.image;
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "banners");
                imageUrl = uploadResult.secure_url;
            } catch (error) {
                console.error("Banner image update error:", error);
            }
        }

        const updatedBanner = await Banner.findByIdAndUpdate(id, {
            title,
            subtitle,
            description,
            image: imageUrl,
            buttonText: buttonText || "Shop Now",
            buttonLink: buttonLink || "/shop",
            color: color || "#00eaff",
            isActive: isActive !== undefined ? isActive : true,
            sortOrder: sortOrder || 0
        }, { new: true });

        return res.status(200).json({ success: true, data: updatedBanner });
    } catch (err) {
        console.error("Update banner error:", err);
        return res.status(500).json({ success: false, message: "Failed to update banner" });
    }
};

const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedBanner = await Banner.findByIdAndDelete(id);

        if (!deletedBanner) {
            return res.status(404).json({ success: false, message: "Banner not found" });
        }

        return res.status(200).json({ success: true, message: "Banner deleted successfully" });
    } catch (err) {
        console.error("Delete banner error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete banner" });
    }
};

export { createOffer, getAllOffers, updateOffer, deleteOffer, createBanner, getAllBanners, updateBanner, deleteBanner };
