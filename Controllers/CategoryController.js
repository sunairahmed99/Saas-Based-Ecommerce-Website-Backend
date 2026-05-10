import { uploadImageToCloudinary, deleteImageFromCloudinary } from "../Middleware/Uploadmiddleware.js";
import Category from "../Models/CategorySchema.js";


const createCategory = async (req, res) => {

    try {

        const { name } = req.body;

        let imageUrl = null;
        let publicId = null;

        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(req.file.buffer, "category");
                imageUrl = uploadResult.secure_url;
                publicId = uploadResult.public_id;
            } catch (err) {
            }
        }

        const category = await Category.create({
            'name': name,
            'Image': imageUrl
        })

        return res.status(200).json({

            status: "success",
            data: category


        })
    } catch (err) {

        return res.status(500).json({

            status: "fail",
            message: "something went wrong try later"
        })
    }
}

const getallCategory = async (req, res) => {

    try {


        const category = await Category.find()
        return res.status(200).json({

            status: "success",
            data: category


        })
    } catch (err) {

        return res.status(500).json({

            status: "fail",
            message: "something went wrong try later"
        })
    }
}

const getTrendingCategories = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 6;

        const trendingCategories = await Category.find()
            .sort({ clicks: -1 }) // Sort by clicks in descending order
            .limit(limit);

        return res.status(200).json({
            status: "success",
            data: trendingCategories
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "something went wrong try later"
        });
    }
}

const incrementCategoryClicks = async (req, res) => {
    try {
        const { id } = req.params;

        const category = await Category.findByIdAndUpdate(
            id,
            { $inc: { clicks: 1 } },
            { new: true }
        );

        if (!category) {
            return res.status(404).json({
                status: "fail",
                message: "Category not found"
            });
        }

        return res.status(200).json({
            status: "success",
            data: category
        });
    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "something went wrong try later"
        });
    }
}


const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

   
        const existingCategory = await Category.findById(id);

        if (!existingCategory) {
            return res.status(404).json({
                status: "fail",
                message: "Category not found"
            });
        }

        let imageUrl = existingCategory.Image;
        let publicId = existingCategory.publicId;

 
        if (req.file) {
            try {
                const uploadResult = await uploadImageToCloudinary(
                    req.file.buffer,
                    "category"
                );

                imageUrl = uploadResult.secure_url;
                publicId = uploadResult.public_id;

            
                if (existingCategory.publicId) {
                    await deleteImageFromCloudinary(existingCategory.publicId);
                }
            } catch (error) {
            }
        }

     
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                name,
                Image: imageUrl,
                publicId: publicId
            },
            { new: true } 
        );

        return res.status(200).json({
            status: "success",
            data: updatedCategory
        });

    } catch (err) {
        return res.status(500).json({
            status: "fail",
            message: "Something went wrong, try later"
        });
    }
};



const deleteCategory = async (req, res) => {

    try {

        const { id } = req.params;

    
        const category = await Category.findByIdAndDelete(id)
        return res.status(200).json({

            status: "success",
            data: category


        })
    } catch (err) {

        return res.status(500).json({

            status: "fail",
            message: "something went wrong try later"
        })
    }
}


export{createCategory,getallCategory,deleteCategory,updateCategory,getTrendingCategories,incrementCategoryClicks}
