import express from "express";
import { createContact, getAllContacts } from "../Controllers/ContactController.js";
import { verifyAdmin } from "../Middleware/VerifyUser.js";

const ContactRouter = express.Router();

// Public: create contact message
ContactRouter.post("/create", createContact);

// Admin: list all messages
ContactRouter.get("/getall", verifyAdmin, getAllContacts);

export default ContactRouter;

