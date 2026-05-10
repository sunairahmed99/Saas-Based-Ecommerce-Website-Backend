// server.js — UPDATED PRODUCTION READY

import app from "./app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cron from "node-cron";
import dns from "dns";
import { expireOldBoosts } from "./Controllers/ProductBoostController.js";
import { processDelayedPointsAwards, processExpiredRefundWindows } from "./Controllers/WalletController.js";

// Load environment variables first
dotenv.config({ quiet: true });

// Disable console logs in production
if (process.env.NODE_ENV === 'production') {
  console.log = () => {};
  console.error = () => {};
  console.debug = () => {};
  console.warn = () => {};
  console.info = () => {};
}

// ===================== DNS & Node Fix for SRV =====================
// Force Node to use public DNS servers (Google + Cloudflare)
dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
// Force IPv4 resolution to avoid Node + Atlas SRV issues
dns.setDefaultResultOrder("ipv4first");

// ===================== Mongoose Configuration =====================
mongoose.set({ strictQuery: true });

const encodedPassword = encodeURIComponent(process.env.DB_PASSWORD || "sunair123");
const Database = process.env.DB.replace("<db_password>", encodedPassword);

// ===================== MongoDB Connection with Retry =====================
const connectDB = async (retries = 5) => {
  try {
    const conn = await mongoose.connect(Database, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      maxPoolSize: 10, // Maintain up to 10 socket connections
      family: 4, // Force IPv4 to avoid potential IPv6/DNS issues
    });



    // ===================== Start Server =====================
    const port = process.env.PORT || 5000;
    const { createServer } = await import("http");
    const { initSocket } = await import("./Utils/sockets.js");
    
    const httpServer = createServer(app);
    initSocket(httpServer);
    
    httpServer.listen(port, () => {
      console.log(`✅ Server is running on port ${port}`);
    }).on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${port} is already in use. Please close the other process running on this port.`);
        process.exit(1);
      } else {
        console.error("❌ Server connection error:", err);
        process.exit(1);
      }
    });

    // ===================== Cron Jobs =====================

    // Expire old product boosts every hour
    cron.schedule("0 * * * *", async () => {
      try {
        await expireOldBoosts();
      } catch (error) {
        console.error("Error in scheduled boost expiration:", error);
      }
    });

    // Process delayed points awards every 5 minutes
    cron.schedule("*/5 * * * *", async () => {
      try {
        await processDelayedPointsAwards();
      } catch (error) {
        console.error("Error in scheduled delayed points processing:", error);
      }
    });

    // Process expired refund windows every 10 minutes
    cron.schedule("*/10 * * * *", async () => {
      try {
        await processExpiredRefundWindows();
      } catch (error) {
        console.error("Error in scheduled refund window processing:", error);
      }
    });

    // Database index optimization removed for production

    // ===================== Update Product Ratings on Startup =====================
    setTimeout(async () => {
      try {
        const { updateAllProductRatings } = await import("./Utils/ProductRatingService.js");
        await updateAllProductRatings();

      } catch (error) {
        console.error("Error updating product ratings:", error);
      }
    }, 5000);

    return true;
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);

    if (retries > 0) {
      setTimeout(() => connectDB(retries - 1), 5000); // Wait 5s before retry
    } else {
      console.error("❌ Failed to connect to MongoDB after multiple attempts");
      process.exit(1);
    }
  }
};



// ===================== Mongoose Event Listeners =====================
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB Connected successfully");
});

mongoose.connection.on("error", (err) => {
  console.error("Mongoose connection error event:", err);
});

mongoose.connection.on("disconnected", () => {
  console.log("⚠️ MongoDB Disconnected");
});

// ===================== Graceful Shutdown =====================
const gracefulShutdown = async () => {

  await mongoose.connection.close();
  process.exit(0);
};

process.on("SIGINT", gracefulShutdown);
process.on("SIGTERM", gracefulShutdown);

// ===================== Start DB Connection =====================
connectDB();

export default app;
