import express from 'express';
import verifyuser, { verifyAdmin } from '../Middleware/VerifyUser.js';
import upload from '../Middleware/Uploadmiddleware.js';
import {
    getSellerMessages,
    sendChatMessage,
    uploadChatImage,
    getAdminChatRooms,
    getAdminRoomMessages,
    getMessages,
    markAsRead,
} from '../Controllers/ChatController.js';

const ChatRouter = express.Router();

// ─── Seller routes ──────────────────────────────────────────────────────────
// GET  /api/chat/seller/messages       → get this seller's conversation with admin
ChatRouter.get('/seller/messages', verifyuser, getSellerMessages);

// POST /api/chat/message               → send a text message (seller or admin)
ChatRouter.post('/message', verifyuser, sendChatMessage);

// POST /api/chat/image                 → upload an image, returns Cloudinary URL
ChatRouter.post('/image', verifyuser, upload.single('image'), uploadChatImage);

// ─── Admin routes ──────────────────────────────────────────────────────────
// GET  /api/chat/admin/rooms           → list all seller conversations
ChatRouter.get('/admin/rooms', verifyAdmin, getAdminChatRooms);

// GET  /api/chat/admin/room/:sellerId  → get one seller's conversation
ChatRouter.get('/admin/room/:sellerId', verifyAdmin, getAdminRoomMessages);

// POST /api/chat/admin/message         → admin replies to a seller
ChatRouter.post('/admin/message', verifyAdmin, sendChatMessage);

// ─── Legacy routes (backward compat) ───────────────────────────────────────
ChatRouter.get('/messages/:userId', verifyuser, getMessages);
ChatRouter.patch('/read/:userId', verifyuser, markAsRead);

export default ChatRouter;
