import express from "express";
import { CreateSeller, getallSellerData, loginSeller, verifySellerLoginCode, sellerForgotPassword, sellerResetPassword, verifySellerCode, verifySellerData, updateSellerStatus, updateSellerProfile, changeSellerPassword, getTopPerformingSellers } from "../Controllers/SellerController.js";

import upload from "../Middleware/Uploadmiddleware.js";
import verifyuser from "../Middleware/VerifyUser.js";

const SellerRouter = express.Router();

SellerRouter.post("/create", upload.single("image"), CreateSeller);
SellerRouter.post("/verify", verifySellerCode);
SellerRouter.post("/login", loginSeller);
SellerRouter.post("/verify-login", verifySellerLoginCode);
SellerRouter.patch("/forgot", sellerForgotPassword);
SellerRouter.patch("/resetpass", sellerResetPassword);
SellerRouter.get("/getall", getallSellerData);
SellerRouter.get("/sellerverify", verifyuser, verifySellerData);
SellerRouter.get("/top-performing", getTopPerformingSellers);
SellerRouter.patch("/update-status/:id", updateSellerStatus);
SellerRouter.patch("/editprofile", verifyuser, upload.single("image"), updateSellerProfile);
SellerRouter.patch("/changepassword", verifyuser, changeSellerPassword);

export default SellerRouter;
