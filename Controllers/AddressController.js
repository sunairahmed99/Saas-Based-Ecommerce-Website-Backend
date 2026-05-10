import Address from "../Models/AddressSchema.js";

const MAX_ADDRESSES = 3;

const createAddress = async (req, res) => {
  try {
    const userId = req.id;
    if (!userId) {
      return res.status(401).json({ status: "fail", message: "Login required" });
    }

    const existingCount = await Address.countDocuments({ userId });
    if (existingCount >= MAX_ADDRESSES) {
      return res.status(400).json({
        status: "fail",
        message: "You can only save up to 3 addresses"
      });
    }

    const {
      label,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault
    } = req.body;

    if (!fullName || !phone || !line1 || !city || !state || !postalCode) {
      return res.status(400).json({
        status: "fail",
        message: "Full name, phone, line1, city, state and postal code are required"
      });
    }

    const address = await Address.create({
      userId,
      label,
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      country,
      isDefault: Boolean(isDefault) || existingCount === 0
    });

    if (address.isDefault) {
      await Address.updateMany({ userId, _id: { $ne: address._id } }, { isDefault: false });
    }

    return res.status(201).json({
      status: "success",
      data: address
    });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const getAddresses = async (req, res) => {
  try {
    const userId = req.id;
    if (!userId) {
      return res.status(401).json({ status: "fail", message: "Login required" });
    }

    const addresses = await Address.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
    return res.status(200).json({ status: "success", data: addresses });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const updateAddress = async (req, res) => {
  try {
    const userId = req.id;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(401).json({ status: "fail", message: "Login required" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({ status: "fail", message: "Address not found" });
    }

    const updates = req.body || {};
    Object.assign(address, updates);
    await address.save();

    if (updates.isDefault) {
      await Address.updateMany({ userId, _id: { $ne: address._id } }, { isDefault: false });
    }

    return res.status(200).json({ status: "success", data: address });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const userId = req.id;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(401).json({ status: "fail", message: "Login required" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({ status: "fail", message: "Address not found" });
    }

    await Address.deleteOne({ _id: addressId });

    const remainingDefault = await Address.findOne({ userId, isDefault: true });
    if (!remainingDefault) {
      await Address.findOneAndUpdate({ userId }, { isDefault: true }, { sort: { createdAt: -1 } });
    }

    return res.status(200).json({ status: "success", message: "Address removed" });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.id;
    const addressId = req.params.id;

    if (!userId) {
      return res.status(401).json({ status: "fail", message: "Login required" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(404).json({ status: "fail", message: "Address not found" });
    }

    await Address.updateMany({ userId }, { isDefault: false });
    address.isDefault = true;
    await address.save();

    return res.status(200).json({ status: "success", data: address });
  } catch (error) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

export { createAddress, getAddresses, updateAddress, deleteAddress, setDefaultAddress };

