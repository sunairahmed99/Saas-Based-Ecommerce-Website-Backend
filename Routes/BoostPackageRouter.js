import express from "express";
import {
    createBoostPackage,
    getAllBoostPackages,
    getBoostPackageById,
    updateBoostPackage,
    toggleBoostPackageStatus,
    getActiveBoostPackages
} from "../Controllers/BoostPackageController.js";
import { verifyAdmin } from "../Middleware/VerifyUser.js";

const BoostPackageRouter = express.Router();

// Admin routes
BoostPackageRouter.post("/admin/create", verifyAdmin, createBoostPackage);
BoostPackageRouter.get("/admin/all", verifyAdmin, getAllBoostPackages);
BoostPackageRouter.get("/admin/:packageId", verifyAdmin, getBoostPackageById);
BoostPackageRouter.patch("/admin/update/:packageId", verifyAdmin, updateBoostPackage);
BoostPackageRouter.patch("/admin/toggle/:packageId", verifyAdmin, toggleBoostPackageStatus);

// Public/Seller routes
BoostPackageRouter.get("/active", getActiveBoostPackages);

export default BoostPackageRouter;
