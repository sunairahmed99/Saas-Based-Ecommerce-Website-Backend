import ChatMessage from '../Models/ChatSchema.js';
import Seller from '../Models/SellerSchema.js';
import User from '../Models/UserSchema.js';
import { uploadImageToCloudinary } from '../Middleware/Uploadmiddleware.js';

// ─── SELLER: Get conversation with admin ─────────────────────────────────────
// GET /api/chat/seller/messages
export const getSellerMessages = async (req, res) => {
    try {
        const sellerId = (req.sellerId || req.id)?.toString();
        if (!sellerId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const roomId = `seller-${sellerId}-admin`;

        const messages = await ChatMessage.find({ roomId })
            .sort({ createdAt: 1 });

        // Mark admin→seller messages as read
        await ChatMessage.updateMany(
            { roomId, 'sender.type': 'admin', status: { $ne: 'read' } },
            { status: 'read' }
        );

        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        console.error('getSellerMessages error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── SHARED: Send a text/image message ───────────────────────────────────────
// POST /api/chat/message
export const sendChatMessage = async (req, res) => {
    try {
        const accountId = (req.sellerId || req.id)?.toString();
        const role = req.role?.toLowerCase();

        if (!accountId) {
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        }

        const { message, messageType = 'text', receiver, image } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ success: false, message: 'Message is required' });
        }

        let senderName = 'Unknown';
        let senderEmail = '';
        let roomId;

        if (role === 'seller') {
            const seller = await Seller.findById(accountId).lean();
            senderName = seller?.name || 'Seller';
            senderEmail = seller?.email || '';
            roomId = `seller-${accountId}-admin`;
        } else if (role === 'admin') {
            // Admin replying to a seller
            const targetId = receiver?.id;
            if (!targetId) {
                return res.status(400).json({ success: false, message: 'Receiver ID required for admin messages' });
            }
            senderName = 'Admin';
            const receiverType = receiver?.type || 'seller';
            roomId = receiverType === 'seller'
                ? `seller-${targetId}-admin`
                : `user-${targetId}-admin`;
        } else {
            // Regular user
            const user = await User.findById(accountId).lean();
            senderName = user?.name || 'User';
            senderEmail = user?.email || '';
            roomId = `user-${accountId}-admin`;
        }

        const newMessage = await ChatMessage.create({
            message: message.trim(),
            messageType,
            image: image || undefined,
            sender: {
                id: accountId,
                name: senderName,
                email: senderEmail,
                type: role,
                isLoggedIn: true
            },
            receiver: receiver || { id: 'admin', name: 'Admin', type: 'admin' },
            roomId,
            status: 'sent'
        });

        return res.status(201).json({ success: true, data: newMessage });
    } catch (error) {
        console.error('sendChatMessage error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── SHARED: Upload chat image to Cloudinary ─────────────────────────────────
// POST /api/chat/image   (multipart/form-data, field: "image")
export const uploadChatImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file provided' });
        }

        const result = await uploadImageToCloudinary(req.file.buffer, 'chat_images');

        return res.status(200).json({
            success: true,
            data: {
                url: result.secure_url,
                filename: result.original_filename || 'image',
                size: result.bytes,
                mimetype: req.file.mimetype
            }
        });
    } catch (error) {
        console.error('uploadChatImage error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Get all seller chat rooms (sidebar list) ─────────────────────────
// GET /api/chat/admin/rooms
export const getAdminChatRooms = async (req, res) => {
    try {
        const rooms = await ChatMessage.aggregate([
            { $match: { roomId: { $regex: /^seller-/ } } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$roomId',
                    lastMessage: { $first: '$message' },
                    lastMessageTime: { $first: '$createdAt' },
                    sellerInfo: { $first: '$sender' },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ['$sender.type', 'seller'] },
                                        { $ne: ['$status', 'read'] }
                                    ]
                                },
                                1, 0
                            ]
                        }
                    }
                }
            },
            { $sort: { lastMessageTime: -1 } }
        ]);

        return res.status(200).json({ success: true, data: rooms });
    } catch (error) {
        console.error('getAdminChatRooms error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── ADMIN: Get messages for a specific seller room ───────────────────────────
// GET /api/chat/admin/room/:sellerId
export const getAdminRoomMessages = async (req, res) => {
    try {
        const { sellerId } = req.params;
        const roomId = `seller-${sellerId}-admin`;

        const messages = await ChatMessage.find({ roomId })
            .sort({ createdAt: 1 });

        // Mark seller→admin messages as read
        await ChatMessage.updateMany(
            { roomId, 'sender.type': 'seller', status: { $ne: 'read' } },
            { status: 'read' }
        );

        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        console.error('getAdminRoomMessages error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

// ─── Legacy stubs (kept for backward compat) ─────────────────────────────────
export const getMessages = async (req, res) => {
    return res.status(200).json({ success: true, data: [] });
};

export const getChatUsers = async (req, res) => {
    return getAdminChatRooms(req, res);
};

export const markAsRead = async (req, res) => {
    try {
        const { userId } = req.params;
        await ChatMessage.updateMany(
            { 'sender.id': userId, status: { $ne: 'read' } },
            { status: 'read' }
        );
        return res.status(200).json({ success: true, message: 'Messages marked as read' });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
};
