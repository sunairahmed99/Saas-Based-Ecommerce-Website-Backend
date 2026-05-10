import mongoose from 'mongoose';

const SellerSchema = mongoose.Schema({

    name: {
        type: String,
        required: [true, 'name required']
    },

    email: {
        type: String,
        required: [true, 'email required']
    },

    phone: {
        type: String,
        required: [true, 'phone required']
    },

    password: {
        type: String,
        required: [true, 'password required']
    },

    gender: {
        type: String,
        required: [true, 'gender required']
    },

    role: {
        type: String,
        default: 'seller'
    },

    image: {
        type: String,
    },

    // ---------- SELLER SPECIFIC FIELDS ----------
    shopName: {
        type: String,
        required: [true, "Shop name required"]
    },

    shopDescription: {
        type: String,
    },

    shopAddress: {
        type: String,
        required: [true, "Shop address required"]
    },


    verifiedstatus: {
        type: Boolean,
        default: false
    },

    verifycode: {
        type: Number
    },

    forgotpasscode: {
        type: Number
    },

    forgotpassexp: {
        type: Date
    },

    loginCode: {
        type: Number,
    },

    loginCodeExpiry: {
        type: Date
    },

    active: {
        type: Boolean,
        default:false
    }
});

const Seller = mongoose.model('Seller', SellerSchema);

export default Seller;