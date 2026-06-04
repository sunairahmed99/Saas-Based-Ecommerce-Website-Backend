import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Seller from './Models/SellerSchema.js';
import Product from './Models/ProductSchema.js';
import dns from 'dns';

dotenv.config({ quiet: true });
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const encodedPassword = encodeURIComponent(process.env.DB_PASSWORD || "sunair123");
const Database = process.env.DB.replace("<db_password>", encodedPassword);

async function check() {
  await mongoose.connect(Database);
  console.log("Connected to DB");
  
  const seller = await Seller.findOne({ email: "hw3851607@gmail.com" });
  if (!seller) {
    console.log("Seller not found for hw3851607@gmail.com");
    // Find any seller
    const allSellers = await Seller.find();
    console.log("All sellers in DB:", allSellers.map(s => ({ id: s._id, email: s.email, name: s.name })));
  } else {
    console.log("Seller found:", {
      id: seller._id,
      name: seller.name,
      email: seller.email,
      shopName: seller.shopName,
      verifiedstatus: seller.verifiedstatus,
      active: seller.active
    });
    
    const products = await Product.find({ sellerid: seller._id });
    console.log(`Products count for this seller (${seller._id}):`, products.length);
    products.forEach((p, idx) => {
      console.log(`[${idx+1}] ID: ${p._id} | Status: ${p.pstatus} | Name: "${p.pname}"`);
    });
  }
  
  await mongoose.disconnect();
}

check().catch(console.error);
