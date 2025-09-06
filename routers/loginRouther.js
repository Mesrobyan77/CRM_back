const express = require("express");
const AuthController = require("../Controllers/AuthContreoller/AuthController");
const authMiddleware = require("../middleware/authMiddleware/authMiddleware");
const loginRouter = express.Router();

loginRouter.post("/api/refresh", AuthController.refresh);
loginRouter.post("/api/auth/register", AuthController.register);
loginRouter.post("/api/auth/login", AuthController.login);
loginRouter.post("/api/auth/google", AuthController.googleLogin);
loginRouter.post("/api/auth/forgot-password", AuthController.forgotPassword);
loginRouter.post("/api/auth/reset-password", AuthController.resetPassword);
loginRouter.get("/api/auth/verify-email", AuthController.verifyEmail);
loginRouter.get("/api/auth/me", authMiddleware, AuthController.GetMe);
loginRouter.get("/api/users/search", authMiddleware, AuthController.search);
module.exports = loginRouter;
