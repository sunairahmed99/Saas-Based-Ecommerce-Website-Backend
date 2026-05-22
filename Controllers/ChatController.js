import ChatMessage from '../Models/ChatSchema.js';
import Message from '../Models/MessageSchema.js';
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

// ─── User ↔ Admin live chat (Message model, used by storefront + admin panel) ─
export const getMessages = async (req, res) => {
    try {
        const { userId } = req.params;
        const adminUser = await User.findOne({ role: 'admin' }).lean();
        if (!adminUser) {
            return res.status(200).json({ success: true, data: [] });
        }

        const messages = await Message.find({
            $or: [
                { sender: userId, receiver: adminUser._id },
                { sender: adminUser._id, receiver: userId },
            ],
        })
            .sort({ createdAt: 1 })
            .lean();

        return res.status(200).json({ success: true, data: messages });
    } catch (error) {
        console.error('getMessages error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getAdminChatUsers = async (req, res) => {
    try {
        const adminUser = await User.findOne({ role: 'admin' }).lean();
        if (!adminUser) {
            return res.status(200).json({ success: true, data: [] });
        }

        const adminId = adminUser._id;

        const conversations = await Message.aggregate([
            {
                $match: {
                    $or: [{ sender: adminId }, { receiver: adminId }],
                },
            },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: {
                        $cond: [
                            { $eq: ['$sender', adminId] },
                            '$receiver',
                            '$sender',
                        ],
                    },
                    lastMessage: { $first: '$message' },
                    lastMessageTime: { $first: '$createdAt' },
                },
            },
            { $sort: { lastMessageTime: -1 } },
        ]);

        const userIds = conversations.map((c) => c._id).filter(Boolean);
        const users = await User.find({ _id: { $in: userIds } })
            .select('name email Image')
            .lean();

        const userMap = new Map(users.map((u) => [u._id.toString(), u]));

        const data = conversations
            .map((conv) => {
                const u = userMap.get(conv._id?.toString());
                if (!u) return null;
                return {
                    _id: u._id,
                    name: u.name,
                    email: u.email,
                    profileImage: u.Image,
                    lastMessage: conv.lastMessage,
                    lastMessageTime: conv.lastMessageTime,
                };
            })
            .filter(Boolean);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('getAdminChatUsers error:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
};

export const getChatUsers = async (req, res) => {
    return getAdminChatUsers(req, res);
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
