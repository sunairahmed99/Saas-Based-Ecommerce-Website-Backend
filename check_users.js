import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './Models/UserSchema.js';

dotenv.config({ quiet: true });
const encodedPassword = encodeURIComponent(process.env.DB_PASSWORD || "sunair123");
const Database = process.env.DB.replace("<db_password>", encodedPassword);

async function test() {
  await mongoose.connect(Database);
  console.log("Connected to DB");
  const users = await User.find().select("name email role verifiedstatus");
  console.log("Users in DB:", users);
  await mongoose.disconnect();
}

test().catch(console.error);
