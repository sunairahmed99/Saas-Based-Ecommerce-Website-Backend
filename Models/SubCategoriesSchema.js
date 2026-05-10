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

const Subcategory = mongoose.model('Subcategory',subcategorySchema)

export default Subcategory