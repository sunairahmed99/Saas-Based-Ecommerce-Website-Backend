import mongoose from 'mongoose';

const offerSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String
    },
    offerStartDateTime: {
        type: Date
    },
    offerEndDateTime: {
        type: Date
    }
});

// Homepage Banner Schema
const bannerSchema = mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    subtitle: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    image: {
        type: String,
        required: true
    },
    buttonText: {
        type: String,
        default: "Shop Now"
    },
    buttonLink: {
        type: String,
        default: "/shop"
    },
    color: {
        type: String,
        default: "#00eaff"
    },
    isActive: {
        type: Boolean,
        default: true
    },
    sortOrder: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Offer = mongoose.model('Offer', offerSchema);
const Banner = mongoose.model('Banner', bannerSchema);

export { Offer as default, Banner };
