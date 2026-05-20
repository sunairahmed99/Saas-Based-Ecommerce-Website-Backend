import express from 'express';
import { Createuser,verifycode,loginuser, verifyLoginCode, verifyuserdata, forgotpassword, resetpassword, getallusers, updateProfile, changePassword, googleLogin, googleCallback, getGoogleAuthUrl, exchangeGoogleCode, updateRole, toggleUserActive} from '../Controllers/UserController.js';
import upload from '../Middleware/Uploadmiddleware.js';
import verifyuser, { verifyAdmin } from '../Middleware/VerifyUser.js';



const UserRouter = express.Router();


UserRouter.post('/create',upload.single('image'), Createuser)

UserRouter.post('/verify',verifycode)


UserRouter.get('/getall', verifyAdmin, getallusers)

UserRouter.post('/login',loginuser)

UserRouter.post('/verify-login', verifyLoginCode)

UserRouter.patch('/forgot',forgotpassword)

UserRouter.patch('/resetpass',resetpassword)

UserRouter.patch('/editprofile', verifyuser, upload.single('image'), updateProfile);

UserRouter.post('/changepassword', verifyuser, changePassword);

UserRouter.patch('/updaterole', verifyAdmin, updateRole);
UserRouter.patch('/toggleactive', verifyAdmin, toggleUserActive);

UserRouter.get('/userverify',verifyuser,verifyuserdata)

// Google OAuth Routes
UserRouter.get('/auth/google', googleLogin);
UserRouter.get('/auth/google/callback', googleCallback);
UserRouter.get('/auth/google/url', getGoogleAuthUrl);
UserRouter.post('/auth/google/exchange', exchangeGoogleCode);



export default UserRouter;
