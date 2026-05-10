import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  auth: {
    user: process.env.Gmailuser,
    pass: process.env.Gmail_password,
  },
});


export const sendEmail = async (to, subject,message) => {
  const mailOptions = {
    from: `"Ecommerce_Store`,
    to,
    subject,
    text:message
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};
