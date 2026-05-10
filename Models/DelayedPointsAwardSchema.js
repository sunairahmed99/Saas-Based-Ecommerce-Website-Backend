import mongoose from 'mongoose';

const delayedPointsAwardSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        required: true
    },
    orderAmount: {
        type: Number,
        required: true
    },
    pointsToAward: {
        type: Number,
        required: true
    },
    awardTime: {
        type: Date,
        required: true,
        default: () => new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now
    },
    status: {
        type: String,
        enum: ['PENDING', 'AWARDED', 'CANCELLED'],
        default: 'PENDING'
    },
    refundWindowExpiry: {
        type: Date,
        default: () => new Date(Date.now() + 60 * 60 * 1000) // Set to 1 hour to match return policy
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient querying
delayedPointsAwardSchema.index({ awardTime: 1, status: 1 });
delayedPointsAwardSchema.index({ orderId: 1 });
delayedPointsAwardSchema.index({ userId: 1 });

const DelayedPointsAward = mongoose.model('DelayedPointsAward', delayedPointsAwardSchema);

export default DelayedPointsAward;
