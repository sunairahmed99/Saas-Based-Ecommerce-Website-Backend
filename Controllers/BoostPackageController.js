import BoostPackage from "../Models/BoostPackageSchema.js";

// Admin: Create a new boost package
const createBoostPackage = async (req, res) => {
    try {
        const { title, description, price, productLimit, duration, durationType } = req.body;

        const newPackage = new BoostPackage({
            title,
            description,
            price,
            productLimit,
            duration,
            durationType,
            createdBy: req.id // Use authenticated admin's ID
        });

        const savedPackage = await newPackage.save();
        return res.status(201).json({
            success: true,
            message: "Boost package created successfully",
            data: savedPackage
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Admin: Get all boost packages
const getAllBoostPackages = async (req, res) => {
    try {
        const { isActive } = req.query;
        const query = {};
        if (isActive !== undefined) {
            query.isActive = isActive === 'true';
        }

        const packages = await BoostPackage.find(query).sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            message: "Boost packages retrieved successfully",
            data: packages
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Admin: Get boost package by ID
const getBoostPackageById = async (req, res) => {
    try {
        const { packageId } = req.params;
        const packageData = await BoostPackage.findById(packageId);

        if (!packageData) {
            return res.status(404).json({
                success: false,
                message: "Boost package not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Boost package retrieved successfully",
            data: packageData
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Admin: Update boost package
const updateBoostPackage = async (req, res) => {
    try {
        const { packageId } = req.params;
        const updateData = req.body;

        // Remove fields that shouldn't be updated directly
        delete updateData.createdBy;
        delete updateData.createdAt;

        const updatedPackage = await BoostPackage.findByIdAndUpdate(
            packageId,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedPackage) {
            return res.status(404).json({
                success: false,
                message: "Boost package not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Boost package updated successfully",
            data: updatedPackage
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Admin: Delete/Toggle active status of boost package
const toggleBoostPackageStatus = async (req, res) => {
    try {
        const { packageId } = req.params;
        const { isActive } = req.body;

        const updatedPackage = await BoostPackage.findByIdAndUpdate(
            packageId,
            { isActive },
            { new: true }
        );

        if (!updatedPackage) {
            return res.status(404).json({
                success: false,
                message: "Boost package not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: `Boost package ${isActive ? 'activated' : 'deactivated'} successfully`,
            data: updatedPackage
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

// Public: Get active boost packages (for sellers to view)
const getActiveBoostPackages = async (req, res) => {
    try {
        const packages = await BoostPackage.find({ isActive: true }).sort({ createdAt: -1 });
        return res.status(200).json({
            success: true,
            message: "Active boost packages retrieved successfully",
            data: packages
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

export {
    createBoostPackage,
    getAllBoostPackages,
    getBoostPackageById,
    updateBoostPackage,
    toggleBoostPackageStatus,
    getActiveBoostPackages
};
