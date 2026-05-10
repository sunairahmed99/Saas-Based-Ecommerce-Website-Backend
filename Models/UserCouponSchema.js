import mongoose from 'mongoose';

const UserCouponSchema = mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        uppercase: true
    },
    discountType: {
        type: String,
        enum: ['fixed', 'percentage'],
        default: 'fixed'
    },
    discountValue: {
        type: Number,
        required: true
    },
    minOrderAmount: {
        type: Number,
        default: 0
    },
    maxDiscount: {
        type: Number
    },
    description: {
        type: String,
        required: true
    },
    generatedFrom: {
        type: String,
        enum: ['points_10', 'points_20', 'points_30', 'points_50', 'admin', 'user_generated'],
        required: true
    },
    pointsUsed: {
        type: Number,
        required: true
    },
    isUsed: {
        type: Boolean,
        default: false
    },
    usedAt: {
        type: Date
    },
    usedOrderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    expiresAt: {
        type: Date,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Generate unique coupon code (only if not already provided)
UserCouponSchema.pre('save', function(next) {
    if (this.isNew && (!this.code || this.code.trim() === '')) {
        // Generate a unique 8-character code
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code;
        let isUnique = false;
        let attempts = 0;

        do {
            code = '';
            for (let i = 0; i < 8; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            // Check uniqueness (in case of manual generation conflicts)
            // Note: We can't use async operations in pre-save hooks reliably
            // So we rely on the manual generation to handle uniqueness
            isUnique = true;
            attempts++;

            // Safety fallback
            if (attempts > 5) {
                code = `FB${Date.now().toString().slice(-6)}`;
                break;
            }
        } while (!isUnique);

        this.code = code.toUpperCase();
    } else if (this.code) {
        // Ensure code is uppercase
        this.code = this.code.toUpperCase();
    }
    next();
});

// Index for better performance (code field already indexed by unique: true)
UserCouponSchema.index({ user: 1, isUsed: 1 });
UserCouponSchema.index({ expiresAt: 1 });

const UserCoupon = mongoose.model('UserCoupon', UserCouponSchema);

export default UserCoupon;
