/**
 * Lightweight notification stub.
 * For now we simply log and return success so the FE can proceed.
 */
export const enqueueNotification = async (payload = {}) => {
  try {
  } catch (err) {
    // Swallow errors to keep the flow non-blocking.
  }
};

export const createNotification = async (req, res) => {
  try {
    const { to, type, message, orderId, sellerId } = req.body || {};

    await enqueueNotification({ to, type, message, orderId, sellerId, createdAt: new Date() });

    return res.status(202).json({ status: "accepted" });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Unable to process notification" });
  }
};

