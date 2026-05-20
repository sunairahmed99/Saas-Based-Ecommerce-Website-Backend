import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../Middleware/Uploadmiddleware.js";
import Category from "../Models/CategorySchema.js";
import Subcategory from "../Models/SubCategoriesSchema.js";




// CREATE SUBCATEGORY
const createSubcategory = async (req, res) => {
    try {
        const { name, catid } = req.body;

        // Validate if parent category exists
        const category = await Category.findById(catid);
        if (!category) {
            return res.status(404).json({ status: "fail", message: "Parent category not found" });
        }

        let imageUrl = null;
        let publicId = null;

        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "subcategory");
                imageUrl = uploadResult.secure_url;
                publicId = uploadResult.public_id;
            } catch (err) {
            }
        }

        const subcategory = await Subcategory.create({
            name,
            catid,
            Image: imageUrl,
        });

        return res.status(200).json({ status: "success", data: subcategory });

    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong, try later" });
    }
};

// GET ALL SUBCATEGORIES
const getAllSubcategories = async (req, res) => {
    try {
        const subcategories = await Subcategory.find().populate("catid", "name Image").lean();
        return res.status(200).json({ status: "success", data: subcategories });
    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Error fetching subcategories" });
    }
};

// UPDATE SUBCATEGORY
const updateSubcategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, catid } = req.body;

        const existingSubcategory = await Subcategory.findById(id);
        if (!existingSubcategory) {
            return res.status(404).json({ status: "fail", message: "Subcategory not found" });
        }

        // Optional: Validate parent category
        if (catid) {
            const category = await Category.findById(catid);
            if (!category) {
                return res.status(404).json({ status: "fail", message: "Parent category not found" });
            }
            existingSubcategory.catid = catid;
        }

        existingSubcategory.name = name || existingSubcategory.name;

        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "subcategory");
                existingSubcategory.Image = uploadResult.secure_url;

                // Delete old image from Cloudinary
                if (existingSubcategory.publicId) {
                    await deleteImageFromCloudinary(existingSubcategory.publicId);
                }

                existingSubcategory.publicId = uploadResult.public_id;
            } catch (err) {
            }
        }

        const updatedSubcategory = await existingSubcategory.save();
        return res.status(200).json({ status: "success", data: updatedSubcategory });

    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong, try later" });
    }
};


const deleteSubcategory = async (req, res) => {
    try {
        const { id } = req.params;

        const subcategory = await Subcategory.findByIdAndDelete(id);

        if (!subcategory) {
            return res.status(404).json({ status: "fail", message: "Subcategory not found" });
        }

        if (subcategory.publicId) {
            await deleteImageFromCloudinary(subcategory.publicId);
            
        }

        return res.status(200).json({ status: "success", data: subcategory });

    } catch (err) {
        return res.status(500).json({ status: "fail", message: "Something went wrong, try later" });
    }
};

export { createSubcategory, getAllSubcategories, updateSubcategory,deleteSubcategory};
