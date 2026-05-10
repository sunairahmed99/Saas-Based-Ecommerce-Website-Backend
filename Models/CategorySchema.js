import mongoose from 'mongoose';

const categorySchema = mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    Image:{
        type:String
    },
    clicks:{
        type:Number,
        default:0
    }
}, {
    timestamps: true
})

const Category = mongoose.model('Category',categorySchema)

export default Category;