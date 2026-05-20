import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from './Models/ProductSchema.js';

dotenv.config({ quiet: true });
const encodedPassword = encodeURIComponent(process.env.DB_PASSWORD || "sunair123");
const Database = process.env.DB.replace("<db_password>", encodedPassword);

async function test() {
  await mongoose.connect(Database);
  console.log("Connected to DB");
  const query = 'lap';
  const searchRegex = new RegExp(query.trim(), 'i');
  console.log("Regex:", searchRegex);
  const products = await Product.find({
    pstatus: "active",
    $or: [
      { pname: searchRegex },
      { pdescription: searchRegex }
    ]
  }).select("pname pstatus");
  console.log("Matching products for 'lap':", products);
  await mongoose.disconnect();
}

test().catch(console.error);
