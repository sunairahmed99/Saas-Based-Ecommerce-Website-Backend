import mongoose from 'mongoose';

const ChatMessageSchema = mongoose.Schema({
    // Message content
    message: {
        type: String,
        required: true,
        trim: true
    },

    // Message type (text, image)
    messageType: {
        type: String,
        enum: ['text', 'image'],
        default: 'text'
    },

    // Image data (if messageType is 'image')
    image: {
        url: String,
        filename: String,
        size: Number,
        mimetype: String
    },

    // Sender information
    sender: {
        id: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        email: String,
        type: {
            type: String,
            enum: ['user', 'admin', 'seller', 'guest'],
            required: true
        },
        isLoggedIn: {
            type: Boolean,
            default: false
        }
    },

    // Receiver (always admin for user messages, user for admin messages)
    receiver: {
        id: {
            type: String,
            required: true
        },
        name: String,
        type: {
            type: String,
            enum: ['user', 'admin', 'seller', 'guest'],
            required: true
        }
    },

    // Chat room/session identifier
    roomId: {
        type: String,
        required: true,
        index: true
    },

    // Message status
    status: {
        type: String,
        enum: ['sent', 'delivered', 'read'],
        default: 'sent'
    },

    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },

    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for performance
ChatMessageSchema.index({ roomId: 1, createdAt: -1 });
ChatMessageSchema.index({ 'sender.id': 1 });
ChatMessageSchema.index({ 'receiver.id': 1 });
ChatMessageSchema.index({ status: 1 });

// Pre-save middleware
ChatMessageSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Static methods for chat operations
ChatMessageSchema.statics.getRoomMessages = function(roomId, limit = 50) {
    return this.find({ roomId })
        .sort({ createdAt: -1 })
        .limit(limit);
};

ChatMessageSchema.statics.markAsRead = function(roomId, userId) {
    return this.updateMany(
        {
            roomId,
            'receiver.id': userId,
            status: { $ne: 'read' }
        },
        { status: 'read' }
    );
};

ChatMessageSchema.statics.getUnreadCount = function(userId, userType) {
    return this.countDocuments({
        'receiver.id': userId,
        'receiver.type': userType,
        status: { $ne: 'read' }
    });
};

ChatMessageSchema.statics.getActiveRooms = function() {
    return this.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                }
            }
        },
        {
            $group: {
                _id: '$roomId',
                lastMessage: { $last: '$message' },
                lastMessageTime: { $last: '$createdAt' },
                participants: {
                    $addToSet: {
                        id: '$sender.id',
                        name: '$sender.name',
                        type: '$sender.type'
                    }
                },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $eq: ['$status', 'read'] },
                            0,
                            1
                        ]
                    }
                }
            }
        },
        { $sort: { lastMessageTime: -1 } }
    ]);
};

ChatMessageSchema.statics.getActiveRoomsByType = function(participantType) {
    return this.aggregate([
        {
            $match: {
                createdAt: {
                    $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
                },
                $or: [
                    { 'sender.type': participantType },
                    { 'receiver.type': participantType }
                ]
            }
        },
        {
            $group: {
                _id: '$roomId',
                lastMessage: { $last: '$message' },
                lastMessageTime: { $last: '$createdAt' },
                participants: {
                    $addToSet: {
                        $cond: [
                            { $eq: ['$sender.type', participantType] },
                            {
                                id: '$sender.id',
                                name: '$sender.name',
                                type: '$sender.type'
                            },
                            {
                                id: '$receiver.id',
                                name: '$receiver.name',
                                type: '$receiver.type'
                            }
                        ]
                    }
                },
                unreadCount: {
                    $sum: {
                        $cond: [
                            { $eq: ['$status', 'read'] },
                            0,
                            1
                        ]
                    }
                }
            }
        },
        { $sort: { lastMessageTime: -1 } }
    ]);
};

const ChatMessage = mongoose.model('ChatMessage', ChatMessageSchema);

export default ChatMessage;
