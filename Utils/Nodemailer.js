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

export const sendEmail = async (to, subject, message, html = null) => {
  const mailOptions = {
    from: `"MYSHOP Store" <${process.env.Gmailuser}>`,
    to,
    subject,
    text: message,
  };

  // If HTML is provided, use it for rich email
  if (html) {
    mailOptions.html = html;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error("❌ Error sending email:", error);
    throw error;
  }
};

// ─── Premium HTML Email Template ───
const buildEmailTemplate = ({ title, greeting, message, code, codeLabel, expiryText, footerNote }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#111827 0%,#1e293b 100%);border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);box-shadow:0 25px 50px rgba(0,0,0,0.5);">
          
          <!-- Header with Logo -->
          <tr>
            <td style="padding:40px 40px 20px 40px;text-align:center;">
              <h1 style="margin:0;font-size:32px;font-weight:900;letter-spacing:-1px;">
                <span style="color:#ffffff;">MY</span><span style="color:#00eaff;">SHOP</span>
              </h1>
              <p style="margin:8px 0 0 0;color:#00eaff;font-size:11px;letter-spacing:6px;text-transform:uppercase;font-weight:300;">
                Premium Store
              </p>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(0,234,255,0.3),transparent);"></div>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:30px 40px 10px 40px;text-align:center;">
              <h2 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">
                ${title}
              </h2>
            </td>
          </tr>

          <!-- Greeting & Message -->
          <tr>
            <td style="padding:10px 40px 20px 40px;text-align:center;">
              <p style="margin:0 0 8px 0;color:rgba(255,255,255,0.85);font-size:15px;line-height:1.6;">
                ${greeting}
              </p>
              <p style="margin:0;color:rgba(255,255,255,0.65);font-size:14px;line-height:1.6;">
                ${message}
              </p>
            </td>
          </tr>

          <!-- Code Label -->
          <tr>
            <td style="padding:5px 40px 8px 40px;text-align:center;">
              <p style="margin:0;color:rgba(255,255,255,0.5);font-size:12px;letter-spacing:3px;text-transform:uppercase;">
                ${codeLabel}
              </p>
            </td>
          </tr>

          <!-- Verification Code Box -->
          <tr>
            <td style="padding:0 40px 20px 40px;text-align:center;">
              <div style="background:linear-gradient(135deg,rgba(0,234,255,0.08),rgba(0,140,255,0.08));border:2px solid rgba(0,234,255,0.25);border-radius:16px;padding:20px 30px;display:inline-block;">
                <span style="font-size:36px;font-weight:900;letter-spacing:10px;color:#00eaff;font-family:'Courier New',monospace;">
                  ${code}
                </span>
              </div>
            </td>
          </tr>

          ${expiryText ? `
          <!-- Expiry Warning -->
          <tr>
            <td style="padding:0 40px 20px 40px;text-align:center;">
              <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.2);border-radius:10px;padding:10px 20px;">
                <p style="margin:0;color:#f97316;font-size:13px;font-weight:600;">
                  ⏱️ ${expiryText}
                </p>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Security Notice -->
          <tr>
            <td style="padding:0 40px 30px 40px;text-align:center;">
              <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:10px;padding:12px 20px;">
                <p style="margin:0;color:rgba(255,255,255,0.6);font-size:12px;line-height:1.5;">
                  🔒 <strong style="color:rgba(255,255,255,0.8);">Security Notice:</strong> Never share this code with anyone. MYSHOP team will never ask for your verification code.
                </p>
              </div>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 30px 40px;text-align:center;">
              ${footerNote ? `<p style="margin:0 0 10px 0;color:rgba(255,255,255,0.4);font-size:12px;">${footerNote}</p>` : ''}
              <p style="margin:0;color:rgba(255,255,255,0.3);font-size:11px;">
                © ${new Date().getFullYear()} MYSHOP Premium Store. All rights reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
};

// ─── Pre-built Email Templates ───

export const sendRegistrationEmail = async (to, code) => {
  const subject = "🔐 Verify Your MYSHOP Account";
  const plainText = `Your MYSHOP verification code is: ${code}. Please do not share this code with anyone.`;
  const html = buildEmailTemplate({
    title: "Account Verification",
    greeting: "Welcome to MYSHOP! 🎉",
    message: "Please use the following code to verify your account and start your premium shopping experience.",
    code: code,
    codeLabel: "Your Verification Code",
    expiryText: null,
    footerNote: "If you didn't create an account, please ignore this email."
  });
  return sendEmail(to, subject, plainText, html);
};

export const sendLoginVerificationEmail = async (to, code) => {
  const subject = "🛡️ Admin Login Verification - MYSHOP";
  const plainText = `Your admin login verification code is: ${code}. This code expires in 10 minutes.`;
  const html = buildEmailTemplate({
    title: "Admin Login Verification",
    greeting: "Admin login attempt detected",
    message: "A login attempt was made to your admin account. Use the code below to verify your identity.",
    code: code,
    codeLabel: "Your Login Code",
    expiryText: "This code will expire in 10 minutes",
    footerNote: "If you didn't attempt to log in, please secure your account immediately."
  });
  return sendEmail(to, subject, plainText, html);
};

export const sendForgotPasswordEmail = async (to, code) => {
  const subject = "🔑 Password Reset Code - MYSHOP";
  const plainText = `Your MYSHOP password reset code is: ${code}. This code expires in 5 minutes. Please do not share this code with anyone.`;
  const html = buildEmailTemplate({
    title: "Password Reset",
    greeting: "Password reset requested",
    message: "We received a request to reset your password. Use the code below to proceed with resetting your password.",
    code: code,
    codeLabel: "Your Reset Code",
    expiryText: "This code will expire in 5 minutes",
    footerNote: "If you didn't request a password reset, please ignore this email. Your account is safe."
  });
  return sendEmail(to, subject, plainText, html);
};
