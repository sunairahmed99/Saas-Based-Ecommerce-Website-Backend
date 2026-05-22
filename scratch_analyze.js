import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import Product from "./Models/ProductSchema.js";

dotenv.config();

dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const analyzeProducts = async () => {
  try {
    await mongoose.connect(process.env.DB);
    const products = await Product.find({});
    
    const categories = new Set();
    const loremflickrProducts = [];
    
    for (const p of products) {
      if (p.pimage1 && p.pimage1.includes("loremflickr.com")) {
        const parts = p.pimage1.split('/');
        let category = parts[parts.length - 1]?.toLowerCase() || 'general';
        category = category.split('?')[0].split(',')[0];
        categories.add(category);
        loremflickrProducts.push({
          id: p._id,
          name: p.pname,
          image: p.pimage1,
          parsedCategory: category
        });
      }
    }
    
    console.log("Unique Parsed Categories from loremflickr:", Array.from(categories));
    console.log(`Total products with loremflickr images: ${loremflickrProducts.length}`);
    
    // Print a sample of products for each category
    const samples = {};
    for (const cat of categories) {
      samples[cat] = loremflickrProducts.filter(p => p.parsedCategory === cat).slice(0, 3).map(p => p.name);
    }
    console.log("Samples by category:", JSON.stringify(samples, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

analyzeProducts();
