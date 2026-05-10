import mongoose from 'mongoose';

const WalletSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    totalPoints: {
        type: Number,
        default: 0,
        min: 0
    },
    totalSpent: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [{
        type: {
            type: String,
            enum: ['earned', 'spent', 'bonus', 'refund'],
            required: true
        },
        points: {
            type: Number,
            required: true
        },
        amount: {
            type: Number,
            default: 0
        },
        description: {
            type: String,
            required: true
        },
        orderId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Order'
        },
        status: {
            type: String,
            enum: ['PENDING', 'ACTIVE', 'CANCELLED'],
            default: 'ACTIVE'
        },
        refundWindowExpiry: {
            type: Date
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    lastCouponGenerated: {
        points: {
            type: Number,
            default: 0
        },
        generatedAt: {
            type: Date
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field before saving
WalletSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Index for better performance (user field already indexed by unique: true)
WalletSchema.index({ totalPoints: -1 });

const Wallet = mongoose.model('Wallet', WalletSchema);

export default Wallet;
