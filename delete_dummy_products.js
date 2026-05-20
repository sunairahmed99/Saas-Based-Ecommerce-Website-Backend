import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";

// Load backend models (ensure this script is run from the root of the Backend folder)
import Product from "./Models/ProductSchema.js";
import ProductVariation from "./Models/ProductVariationSchema.js";

dotenv.config();

// Fix DNS for MongoDB Atlas
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const deleteDummyProducts = async () => {
  try {
    const dbString = process.env.DB;
    if (!dbString) {
      console.error("❌ No DB connection string found in .env");
      process.exit(1);
    }

    console.log("Connecting to Database...");
    await mongoose.connect(dbString);
    console.log("✅ Connected to MongoDB");

    // Find products with "Pulse" in the name or "loremflickr.com" in the image
    const query = {
      $or: [
        { pname: { $regex: /Pulse/i } },
        { pimage1: { $regex: /loremflickr\.com/i } }
      ]
    };

    const productsToDelete = await Product.find(query);
    console.log(`Found ${productsToDelete.length} dummy products to delete.`);

    if (productsToDelete.length === 0) {
      console.log("No dummy products found. Exiting.");
      process.exit(0);
    }

    for (const product of productsToDelete) {
      console.log(`Deleting: ${product.pname} (${product._id})`);
      await Product.findByIdAndDelete(product._id);
      await ProductVariation.deleteMany({ productId: product._id });
    }

    console.log("✅ Successfully deleted all dummy products.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

deleteDummyProducts();
