import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import Product from "./Models/ProductSchema.js";

dotenv.config();

// Fix DNS for MongoDB Atlas
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const listProducts = async () => {
  try {
    const dbString = process.env.DB;
    if (!dbString) {
      console.error("No DB connection string found in .env");
      process.exit(1);
    }

    console.log("Connecting to Database...");
    await mongoose.connect(dbString);
    console.log("Connected to MongoDB");

    const products = await Product.find({}, "pname pimage1 pstatus");
    console.log("Total products:", products.length);
    console.log("Products Listing:");
    products.forEach((p, index) => {
      console.log(`[${index + 1}] ID: ${p._id} | Status: ${p.pstatus} | Name: "${p.pname}" | Image: "${p.pimage1}"`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
};

listProducts();
