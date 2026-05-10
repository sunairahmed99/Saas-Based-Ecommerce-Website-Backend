import express from "express";
import verifyuser from "../Middleware/VerifyUser.js";
import { createNotification } from "../Controllers/NotificationController.js";

const NotificationRouter = express.Router();

NotificationRouter.post("/", verifyuser, createNotification);

export default NotificationRouter;

