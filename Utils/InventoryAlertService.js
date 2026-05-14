import nodemailer from "nodemailer";
import InventoryAlert from "../Models/InventoryAlertSchema.js";
import Seller from "../Models/SellerSchema.js";

// Email transporter (reuse existing configuration)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: process.env.SMTP_PORT || 465,
    secure: true,
    auth: {
      user: process.env.Gmailuser,
      pass: process.env.Gmail_password,
    },
  });
};

// Send low stock alert email to seller
const sendLowStockEmailAlert = async (alert, seller) => {
  try {
    const transporter = createTransporter();

    const subject = `🚨 Low Stock Alert: ${alert.productName}`;
    const variationText = alert.variationDetails?.size || alert.variationDetails?.color
      ? ` (${alert.variationDetails.size || ''} ${alert.variationDetails.color || ''})`
      : '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">⚠️ Low Stock Alert</h1>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
          <h2 style="color: #333; margin-top: 0;">Stock Running Low</h2>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #495057;">Product Details</h3>
            <p style="margin: 5px 0;"><strong>Product:</strong> ${alert.productName}${variationText}</p>
            <p style="margin: 5px 0;"><strong>SKU:</strong> ${alert.productSku || alert.variationDetails?.variationSku || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Current Stock:</strong> <span style="color: #dc3545; font-weight: bold;">${alert.currentStock}</span></p>
            <p style="margin: 5px 0;"><strong>Minimum Alert Level:</strong> ${alert.minStockThreshold}</p>
          </div>

          <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0; color: #856404;">
              <strong>Action Required:</strong> Please restock this item soon to avoid stockouts.
            </p>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="http://localhost:5173/seller/inventory"
               style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Inventory Dashboard
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

          <p style="color: #6c757d; font-size: 12px; text-align: center;">
            This is an automated alert from your inventory management system.<br>
            Alert ID: ${alert._id}
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: seller.email,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    // Update alert to mark email as sent
    await InventoryAlert.findByIdAndUpdate(alert._id, {
      $set: { "lastNotified.email": new Date() },
      $push: { notifiedVia: "email" }
    });

  } catch (error) {
    console.error("Error sending low stock email alert:", error);
  }
};

// Send out of stock alert email
const sendOutOfStockEmailAlert = async (alert, seller) => {
  try {
    const transporter = createTransporter();

    const subject = `🚫 Out of Stock Alert: ${alert.productName}`;
    const variationText = alert.variationDetails?.size || alert.variationDetails?.color
      ? ` (${alert.variationDetails.size || ''} ${alert.variationDetails.color || ''})`
      : '';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">🚫 Out of Stock</h1>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
          <h2 style="color: #dc3545; margin-top: 0;">Product Out of Stock</h2>

          <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #f5c6cb;">
            <h3 style="margin-top: 0; color: #721c24;">Product Details</h3>
            <p style="margin: 5px 0;"><strong>Product:</strong> ${alert.productName}${variationText}</p>
            <p style="margin: 5px 0;"><strong>SKU:</strong> ${alert.productSku || alert.variationDetails?.variationSku || 'N/A'}</p>
            <p style="margin: 5px 0;"><strong>Current Stock:</strong> <span style="color: #dc3545; font-weight: bold;">0</span></p>
          </div>

          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #495057;">Immediate Actions Needed:</h4>
            <ul style="color: #495057;">
              <li>Product has been automatically hidden from storefront</li>
              <li>Restock immediately to resume sales</li>
              <li>Consider alternative suppliers if needed</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 30px;">
            <a href="http://localhost:5173/seller/inventory"
               style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              Manage Inventory
            </a>
          </div>

          <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

          <p style="color: #6c757d; font-size: 12px; text-align: center;">
            This is an automated alert from your inventory management system.<br>
            Alert ID: ${alert._id}
          </p>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: seller.email,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);

    // Update alert to mark email as sent
    await InventoryAlert.findByIdAndUpdate(alert._id, {
      $set: { "lastNotified.email": new Date() },
      $push: { notifiedVia: "email" }
    });

  } catch (error) {
    console.error("Error sending out of stock email alert:", error);
  }
};

// Process and send alerts for active inventory alerts
const processInventoryAlerts = async () => {
  try {
    // Get all active alerts that haven't been notified recently
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const alertsToProcess = await InventoryAlert.find({
      status: "active",
      $or: [
        { "lastNotified.email": { $exists: false } },
        { "lastNotified.email": { $lt: oneHourAgo } }
      ]
    })
    .populate("productId", "pname sku sellerid")
    .populate("variationId", "size color variationSku")
    .limit(50); // Process in batches

    for (const alert of alertsToProcess) {
      // Get seller information
      const seller = await Seller.findById(alert.productId?.sellerid || alert.sellerId);
      if (!seller) continue;

      // Send appropriate email based on alert type
      if (alert.alertType === "out_of_stock") {
        await sendOutOfStockEmailAlert(alert, seller);
      } else if (alert.alertType === "low_stock") {
        await sendLowStockEmailAlert(alert, seller);
      }

      // Add small delay to avoid overwhelming email server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error) {
    console.error("Error processing inventory alerts:", error);
  }
};

// Send alert summary email (weekly/monthly)
const sendInventoryAlertSummary = async (sellerId, period = "weekly") => {
  try {
    const seller = await Seller.findById(sellerId);
    if (!seller) return;

    const periodDays = period === "weekly" ? 7 : 30;
    const startDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

    const alerts = await InventoryAlert.find({
      sellerId,
      createdAt: { $gte: startDate }
    })
    .populate("productId", "pname sku")
    .populate("variationId", "size color variationSku")
    .sort({ createdAt: -1 });

    if (alerts.length === 0) return; // No alerts to summarize

    const transporter = createTransporter();

    const subject = `📊 Inventory Alert Summary - ${period.charAt(0).toUpperCase() + period.slice(1)} Report`;
    const periodText = period === "weekly" ? "week" : "month";

    // Group alerts by type
    const alertStats = {
      low_stock: alerts.filter(a => a.alertType === "low_stock").length,
      out_of_stock: alerts.filter(a => a.alertType === "out_of_stock").length,
      total: alerts.length
    };

    let alertsHtml = "";
    alerts.slice(0, 10).forEach(alert => { // Show top 10 alerts
      const variationText = alert.variationDetails?.size || alert.variationDetails?.color
        ? ` (${alert.variationDetails.size || ''} ${alert.variationDetails.color || ''})`
        : '';

      alertsHtml += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${alert.productName}${variationText}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${alert.alertType.replace('_', ' ').toUpperCase()}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${alert.currentStock}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e0e0e0;">${alert.createdAt.toLocaleDateString()}</td>
        </tr>
      `;
    });

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 24px;">📊 Inventory Summary</h1>
          <p style="margin: 5px 0 0 0;">Your ${periodText} inventory report</p>
        </div>

        <div style="background: white; padding: 30px; border: 1px solid #e0e0e0; border-radius: 0 0 10px 10px;">
          <div style="display: flex; justify-content: space-around; margin-bottom: 30px;">
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #ffc107;">${alertStats.low_stock}</div>
              <div style="color: #6c757d;">Low Stock Alerts</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #dc3545;">${alertStats.out_of_stock}</div>
              <div style="color: #6c757d;">Out of Stock</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #17a2b8;">${alertStats.total}</div>
              <div style="color: #6c757d;">Total Alerts</div>
            </div>
          </div>

          <h3>Recent Alerts</h3>
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Product</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Type</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Stock</th>
                <th style="padding: 10px; text-align: left; border-bottom: 2px solid #dee2e6;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${alertsHtml}
            </tbody>
          </table>

          <div style="text-align: center; margin-top: 30px;">
            <a href="http://localhost:5173/seller/inventory"
               style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
              View Full Inventory Dashboard
            </a>
          </div>
        </div>
      </div>
    `;

    const mailOptions = {
      from: process.env.SMTP_USER,
      to: seller.email,
      subject,
      html: htmlContent,
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error("Error sending inventory alert summary:", error);
  }
};

export {
  sendLowStockEmailAlert,
  sendOutOfStockEmailAlert,
  processInventoryAlerts,
  sendInventoryAlertSummary,
};
