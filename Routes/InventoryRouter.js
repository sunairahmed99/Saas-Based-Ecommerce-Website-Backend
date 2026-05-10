import express from "express";
import {
  updateProductStock,
  updateVariationStock,
  bulkUpdateStock,
  getInventoryLogs,
  getInventoryAlerts,
  acknowledgeAlert,
  getInventoryReports,
  exportReport,
} from "../Controllers/InventoryController.js";
import verifyuser from "../Middleware/VerifyUser.js";
import {
  checkProductOwnership,
  checkVariationOwnership,
  checkSellerAccess,
} from "../Middleware/InventoryPermissions.js";

const router = express.Router();

// All inventory routes require authentication
router.use(verifyuser);

// Stock management routes (with ownership checks)
router.put("/products/:productId/stock", checkProductOwnership, updateProductStock);
router.put("/variations/:variationId/stock", checkVariationOwnership, updateVariationStock);
router.post("/bulk-update", checkSellerAccess, bulkUpdateStock);

// Inventory logs (seller can only see their own)
router.get("/logs", checkSellerAccess, getInventoryLogs);

// Inventory alerts (seller can only see their own)
router.get("/alerts", checkSellerAccess, getInventoryAlerts);
router.put("/alerts/:alertId/acknowledge", checkSellerAccess, acknowledgeAlert);

// Inventory reports (seller can only see their own data)
router.get("/reports", checkSellerAccess, getInventoryReports);
router.get("/reports/export", checkSellerAccess, exportReport);

export default router;
