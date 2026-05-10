import express from "express";
import {
  createOrder,
  getAdminOrders,
  getOrderById,
  getOrders,
  updateOrderStatus,
  generateOrderSlip,
  exportOrderSlip
} from "../Controllers/CheckoutController.js";
import verifyuser, { verifyAdmin, verifySellerForOrder } from "../Middleware/VerifyUser.js";
const CheckoutRouter = express.Router();

// Public/user routes
CheckoutRouter.post("/", verifyuser, createOrder);
CheckoutRouter.get("/", verifyuser, getOrders);

// Admin routes
CheckoutRouter.get("/admin", verifyAdmin, getAdminOrders);

// Order status routes (allow sellers to manage their orders)
CheckoutRouter.post("/:id/status", verifySellerForOrder, updateOrderStatus);
CheckoutRouter.patch("/:id/status", verifySellerForOrder, updateOrderStatus);

// Order routes (parameterized routes should come after specific routes)
CheckoutRouter.get("/:id", verifyuser, getOrderById);

// Order slip/receipt routes (require authentication)
CheckoutRouter.get("/:orderId/slip", verifyuser, generateOrderSlip);
CheckoutRouter.get("/:orderId/slip/export", verifyuser, exportOrderSlip);

export default CheckoutRouter;

