import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
import streamifier from 'streamifier';

dotenv.config();

// ✅ Cloudinary Config
cloudinary.config({
  cloud_name: process.env.Cloudinaryname,
  api_key: process.env.Cloudinary_key,
  api_secret: process.env.Cloudinary_secret,
});


// ✅ Multer Memory Storage
const storage = multer.memoryStorage();
const upload = multer({ storage });

// ✅ Cloudinary Upload Function
export const uploadImageToCloudinary = (fileBuffer, folder = 'uploads') => {
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

// ✅ Cloudinary Delete Function
export const deleteImageFromCloudinary = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) return reject(error);
      resolve(result);
    });
  });
};

// ✅ Export multer middleware
export default upload;
