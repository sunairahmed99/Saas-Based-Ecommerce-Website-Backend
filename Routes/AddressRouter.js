import express from "express";
import {
  createAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress
} from "../Controllers/AddressController.js";
import verifyuser from "../Middleware/VerifyUser.js";

const AddressRouter = express.Router();

AddressRouter.post("/", verifyuser, createAddress);
AddressRouter.get("/", verifyuser, getAddresses);
AddressRouter.put("/:id", verifyuser, updateAddress);
AddressRouter.delete("/:id", verifyuser, deleteAddress);
AddressRouter.patch("/:id/default", verifyuser, setDefaultAddress);

export default AddressRouter;

