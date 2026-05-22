import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import Product from "./Models/ProductSchema.js";

dotenv.config();

// Fix DNS for MongoDB Atlas
dns.setServers(["8.8.8.8", "8.8.4.4"]);
dns.setDefaultResultOrder("ipv4first");

const categoryPools = {
  music: [
    "https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1525201548942-d8c8b09d55f0?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1465847899084-d164df4dedc6?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1579685306716-1f9e21132644?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1552422535-c45813c61732?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?w=600&auto=format&fit=crop&q=80"
  ],
  art: [
    "https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1584992236310-6edddc08acff?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1565192647048-f997ded87958?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1598257006463-7c64a3a6379a?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&auto=format&fit=crop&q=80"
  ],
  stationery: [
    "https://images.unsplash.com/photo-1531346878377-a5be20888e57?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=80"
  ],
  baby: [
    "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1559440648-23c241516f49?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1522836924445-4478bdeb860c?w=600&auto=format&fit=crop&q=80"
  ],
  pet: [
    "https://images.unsplash.com/photo-1541599540903-216a46ca1ad0?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1576201836106-db1758fd1c97?w=600&auto=format&fit=crop&q=80"
  ],
  automotive: [
    "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&auto=format&fit=crop&q=80"
  ],
  tools: [
    "https://images.unsplash.com/photo-1504148455328-c376907d081c?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1581244277943-fe4a9c777189?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1530124560072-aec937bd8db7?w=600&auto=format&fit=crop&q=80"
  ],
  bags: [
    "https://images.unsplash.com/photo-1627124118304-4c40139e8f6d?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1565026057447-bc90a3dceb87?w=600&auto=format&fit=crop&q=80"
  ],
  jewelry: [
    "https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1611591437281-460bfbe1220a?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?w=600&auto=format&fit=crop&q=80"
  ],
  eyewear: [
    "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=600&auto=format&fit=crop&q=80"
  ],
  health: [
    "https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?w=600&auto=format&fit=crop&q=80"
  ],
  books: [
    "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1495640388908-05fa85288e61?w=600&auto=format&fit=crop&q=80"
  ],
  toys: [
    "https://images.unsplash.com/photo-1559251606-c623743a6d76?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=600&auto=format&fit=crop&q=80"
  ],
  garden: [
    "https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600&auto=format&fit=crop&q=80"
  ],
  aquariums: [
    "https://images.unsplash.com/photo-1522069169874-c58ec4b76be5?w=600&auto=format&fit=crop&q=80"
  ],
  watches: [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=600&auto=format&fit=crop&q=80"
  ],
  safety: [
    "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80"
  ],
  general: [
    "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1560343090-f0409e92791a?w=600&auto=format&fit=crop&q=80"
  ]
};

const mapCategory = (category, name) => {
  const cat = (category || "").toLowerCase();
  const nm = (name || "").toLowerCase();

  // 1. Music Instruments
  if (cat.includes("guitar") || nm.includes("guitar") ||
      cat.includes("violin") || nm.includes("violin") ||
      cat.includes("drum") || nm.includes("drum") ||
      cat.includes("flute") || nm.includes("flute") ||
      cat.includes("keyboard") || nm.includes("keyboard") ||
      cat.includes("microphone") || nm.includes("microphone") ||
      cat.includes("violins") || nm.includes("violins") ||
      cat.includes("guitars") || nm.includes("guitars") ||
      cat.includes("drums") || nm.includes("drums") ||
      cat.includes("flutes") || nm.includes("flutes") ||
      cat.includes("keyboards") || nm.includes("keyboards") ||
      cat.includes("microphones") || nm.includes("microphones")) {
    return "music";
  }

  // 2. Art/Crafts
  if (cat.includes("art") || nm.includes("art") ||
      cat.includes("paint") || nm.includes("paint") ||
      cat.includes("craft") || nm.includes("craft") ||
      cat.includes("knitting") || nm.includes("knitting") ||
      cat.includes("origami") || nm.includes("origami") ||
      cat.includes("scrapbooking") || nm.includes("scrapbooking") ||
      cat.includes("modeling") || nm.includes("modeling") || nm.includes("clay") ||
      cat.includes("crochet") || nm.includes("crochet")) {
    return "art";
  }

  // 3. Stationery/Office
  if (cat.includes("stapler") || nm.includes("stapler") ||
      cat.includes("notebook") || nm.includes("notebook") ||
      cat.includes("planner") || nm.includes("planner") ||
      cat.includes("sticky") || nm.includes("sticky") ||
      cat.includes("paper") || nm.includes("paper") ||
      cat.includes("staplers") || nm.includes("staplers") ||
      cat.includes("notebooks") || nm.includes("notebooks") ||
      cat.includes("planners") || nm.includes("planners") ||
      cat.includes("sticky notes") || nm.includes("sticky notes")) {
    return "stationery";
  }

  // 4. Baby
  if (cat.includes("diaper") || nm.includes("diaper") ||
      cat.includes("feeding") || nm.includes("feeding") ||
      cat.includes("stroller") || nm.includes("stroller") ||
      cat.includes("diapers") || nm.includes("diapers") ||
      cat.includes("strollers") || nm.includes("strollers")) {
    return "baby";
  }

  // 5. Pet
  if (cat.includes("leash") || nm.includes("leash") || nm.includes("collar") ||
      cat.includes("leashes") || nm.includes("leashes") || nm.includes("collars")) {
    return "pet";
  }

  // 6. Automotive/Engine
  if (cat.includes("motorcycle") || nm.includes("motorcycle") ||
      cat.includes("engine") || nm.includes("engine") || nm.includes("oil")) {
    return "automotive";
  }

  // 7. Tools
  if (cat.includes("drill") || nm.includes("drill") ||
      cat.includes("hand") || nm.includes("hand tool") ||
      cat.includes("measuring") || nm.includes("measuring tool") ||
      cat.includes("tool") || nm.includes("tool") ||
      cat.includes("power") || nm.includes("power tool") ||
      cat.includes("tools") || nm.includes("tools")) {
    return "tools";
  }

  // 8. Bags/Wallets
  if (cat.includes("wallet") || nm.includes("wallet") ||
      cat.includes("trolley") || nm.includes("trolley") || nm.includes("bag") ||
      cat.includes("wallets") || nm.includes("wallets") ||
      cat.includes("trolley bags") || nm.includes("trolley bags")) {
    return "bags";
  }

  // 9. Jewelry
  if (cat.includes("jewel") || nm.includes("jewel") ||
      cat.includes("bracelet") || nm.includes("bracelet") ||
      cat.includes("necklace") || nm.includes("necklace") ||
      cat.includes("jewellery") || nm.includes("jewellery") ||
      cat.includes("bracelets") || nm.includes("bracelets") ||
      cat.includes("necklaces") || nm.includes("necklaces")) {
    return "jewelry";
  }

  // 10. Eyewear
  if (cat.includes("sunglass") || nm.includes("sunglass") ||
      cat.includes("wayfarer") || nm.includes("wayfarer") ||
      cat.includes("aviator") || nm.includes("aviator") ||
      cat.includes("polarized") || nm.includes("polarized") ||
      cat.includes("round") || nm.includes("round frame") ||
      cat.includes("sunglasses") || nm.includes("sunglasses") ||
      cat.includes("wayfarers") || nm.includes("wayfarers") ||
      cat.includes("aviators") || nm.includes("aviators") ||
      cat.includes("round frames") || nm.includes("round frames")) {
    return "eyewear";
  }

  // 11. Health/Medical
  if (cat.includes("blood") || nm.includes("blood pressure") ||
      cat.includes("nebulizer") || nm.includes("nebulizer") ||
      cat.includes("first") || nm.includes("first aid") ||
      cat.includes("pulse") || nm.includes("pulse oximeter") ||
      cat.includes("thermometer") || nm.includes("thermometer") ||
      cat.includes("nebulizers") || nm.includes("nebulizers") ||
      cat.includes("thermometers") || nm.includes("thermometers") ||
      cat.includes("pulse oximeters") || nm.includes("pulse oximeters")) {
    return "health";
  }

  // 12. Books
  if (cat.includes("children") || nm.includes("book") ||
      cat.includes("selfhelp") || nm.includes("self-help") ||
      cat.includes("academic") || nm.includes("academic") ||
      cat.includes("books") || nm.includes("books")) {
    return "books";
  }

  // 13. Toys
  if (cat.includes("doll") || nm.includes("doll") ||
      cat.includes("dolls") || nm.includes("dolls")) {
    return "toys";
  }

  // 14. Garden
  if (cat.includes("garden") || nm.includes("garden") ||
      cat.includes("soil") || nm.includes("soil") ||
      cat.includes("pot") || nm.includes("pot") || nm.includes("planter") ||
      cat.includes("pots") || nm.includes("pots") ||
      cat.includes("planters") || nm.includes("planters")) {
    return "garden";
  }

  // 15. Aquariums
  if (cat.includes("aquarium") || nm.includes("aquarium") ||
      cat.includes("aquariums") || nm.includes("aquariums")) {
    return "aquariums";
  }

  // 16. Watches
  if (cat.includes("digital") || nm.includes("digital watch") ||
      cat.includes("analog") || nm.includes("analog watch") || nm.includes("watch") ||
      nm.includes("watches")) {
    return "watches";
  }

  // 17. Safety
  if (cat.includes("safety") || nm.includes("safety")) {
    return "safety";
  }

  return "general";
};

const getIndexFromHash = (str, length) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % length;
};

const updateImages = async () => {
  try {
    const dbString = process.env.DB;
    if (!dbString) {
      console.error("❌ No DB connection string found in .env");
      process.exit(1);
    }

    console.log("Connecting to Database...");
    await mongoose.connect(dbString);
    console.log("✅ Connected to MongoDB");

    // Find products containing loremflickr.com
    const query = {
      $or: [
        { pimage1: { $regex: /loremflickr\.com/i } },
        { pimage2: { $regex: /loremflickr\.com/i } },
        { pimage3: { $regex: /loremflickr\.com/i } }
      ]
    };

    const products = await Product.find(query);
    console.log(`Found ${products.length} products to update.`);

    let updatedCount = 0;

    for (const p of products) {
      // Parse category from URL
      let category = "";
      if (p.pimage1 && p.pimage1.includes("loremflickr.com")) {
        const parts = p.pimage1.split('/');
        category = parts[parts.length - 1]?.toLowerCase() || '';
        category = category.split('?')[0].split(',')[0];
      }

      const targetPoolKey = mapCategory(category, p.pname);
      const pool = categoryPools[targetPoolKey] || categoryPools.general;

      const idx = getIndexFromHash(p.pname, pool.length);
      const newImage1 = pool[idx];
      const newImage2 = pool[(idx + 1) % pool.length];
      const newImage3 = pool[(idx + 2) % pool.length];

      console.log(`Updating product: "${p.pname}"`);
      console.log(`  Old Image: "${p.pimage1}"`);
      console.log(`  New Image 1: "${newImage1}"`);
      console.log(`  New Image 2: "${newImage2}"`);
      console.log(`  New Image 3: "${newImage3}"`);

      p.pimage1 = newImage1;
      p.pimage2 = newImage2;
      p.pimage3 = newImage3;

      await p.save();
      updatedCount++;
    }

    console.log(`✅ Successfully updated ${updatedCount} products in the database.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error during migration:", error);
    process.exit(1);
  }
};

updateImages();
