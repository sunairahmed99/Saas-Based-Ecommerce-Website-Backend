import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.Gmailuser,
    pass: process.env.Gmail_password,
  },
});

export const sendEmail = async (to, subject, message) => {
  const mailOptions = {
    from: `"Ecommerce_Store" <${process.env.Gmailuser}>`,
    to,
    subject,
    text: message,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};
