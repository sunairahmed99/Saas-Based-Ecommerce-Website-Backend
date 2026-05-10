import mongoose from 'mongoose';


const subcategorySchema = mongoose.Schema({

    name:{
        type:String
    },
    Image:{
        type:String
    },
    catid:{
        type:mongoose.Types.ObjectId,
        ref:'Category'
    }
})

// Performance Indexes
subcategorySchema.index({ catid: 1 });
subcategorySchema.index({ name: 1 });

const Subcategory = mongoose.model('Subcategory',subcategorySchema)

export default Subcategory