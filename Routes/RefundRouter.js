import express from 'express';
import {
  createRefundRequest,
  getUserRefundRequests,
  getAllRefundRequests,
  processRefund,
  rejectRefund,
  getRefundStats
} from '../Controllers/RefundController.js';
import verifyuser, { verifyAdmin } from '../Middleware/VerifyUser.js';

const RefundRouter = express.Router();

// User routes
RefundRouter.post('/request', verifyuser, createRefundRequest);
RefundRouter.get('/user', verifyuser, getUserRefundRequests);

// Admin routes
RefundRouter.get('/all', verifyAdmin, getAllRefundRequests);
RefundRouter.post('/process/:refundId', verifyAdmin, processRefund);
RefundRouter.post('/reject/:refundId', verifyAdmin, rejectRefund);
RefundRouter.get('/stats', verifyAdmin, getRefundStats);

export default RefundRouter;
