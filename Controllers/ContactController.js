import Contact from "../Models/ContactSchema.js";

// Create a contact query (public)
const createContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ status: "fail", message: "name, email, and message are required" });
    }
    const contact = await Contact.create({
      name,
      email,
      subject: subject || "General",
      message,
    });
    return res.status(200).json({ status: "success", data: contact });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

// Admin: list all contact queries
const getAllContacts = async (_req, res) => {
  try {
    const contacts = await Contact.find().sort({ createdAt: -1 }).lean();
    return res.status(200).json({ status: "success", data: contacts });
  } catch (err) {
    return res.status(500).json({ status: "fail", message: "Something went wrong" });
  }
};

export { createContact, getAllContacts };

