import mongoose from 'mongoose';


const UserSchema = mongoose.Schema({

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
        required: function () {
            return this.authProvider !== 'google';
        }
    },
    password: {
        type: String,
        required: function () {
            return this.authProvider !== 'google';
        }
    },
    gender: {
        type: String,
        required: function () {
            return this.authProvider !== 'google';
        }
    },
    role: {
        type: String,
        default: 'admin'
    },
    Image: {
        type: String,
    },
    verifiedstatus: {
        type: Boolean,
        default: false,
    },
    verifycode: {
        type: Number,
    },
    forgotpasscode: {
        type: Number,
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
        default: true
    },
    googleId: {
        type: String,
        sparse: true
    },
    googleEmail: {
        type: String
    },
    authProvider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local'
    },
    isGoogleLogin: {
        type: Boolean,
        default: false
    }
}, { autoIndex: false })

const User = mongoose.model('User', UserSchema)

export default User