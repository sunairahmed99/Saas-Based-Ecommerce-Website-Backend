import express from "express";
import { getSettings, updateSettings } from "../Controllers/PlatformSettingsController.js";

const router = express.Router();

router.get("/", getSettings);
router.patch("/", updateSettings);

export default router;
