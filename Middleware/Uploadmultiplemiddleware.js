import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";
import streamifier from "streamifier";

dotenv.config();


cloudinary.config({
  cloud_name: process.env.Cloudinaryname,
  api_key: process.env.Cloudinary_key,
  api_secret: process.env.Cloudinary_secret,
});


const storage = multer.memoryStorage();
const upload = multer({ storage });


export const uploadMultipleImages = upload.fields([
  { name: "pimage1", maxCount: 1 },
  { name: "pimage2", maxCount: 1 },
  { name: "pimage3", maxCount: 1 },
]);


export const uploadImageToCloudinary = (fileBuffer, folder = "uploads") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(fileBuffer).pipe(stream);
  });
};


export default upload;
