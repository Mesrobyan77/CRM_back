require("dotenv").config();
const bcrypt = require("bcrypt");
const { User } = require("../../Models/rootModel");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const nodemailer = require("nodemailer");

const {
  getEmailVerificationTemplate,
} = require("./getEmailVerificationTemplate");
const { resetPasswordTemp } = require("./resetPasswordTemp");

const passwordRegex =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

class AuthController {
  // Refresh access token using refresh token
  async refresh(req, res) {
    try {
      const { refreshToken } = req.body;
      if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token required" });
      }

      jwt.verify(refreshToken, process.env.REFRESH_SECRET, (err, user) => {
        if (err) {
          return res.status(403).json({ error: "Invalid refresh token" });
        }

        const newAccessToken = jwt.sign(
          { id: user.id },
          process.env.JWT_SECRET,
          { expiresIn: "15m" },
        );

        res.json({ accessToken: newAccessToken });
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "Something went wrong" });
    }
  }

  // Register a new user
  async register(req, res) {
    try {
      const { userName, email, phoneNumber, password } = req.body;

      if (!userName || !email || !phoneNumber || !password) {
        return res.status(400).json({ error: "All fields are required" });
      }

      const existingUser = await User.findOne({ where: { email } });
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          error:
            "Password must be at least 8 characters, include uppercase, lowercase, number, and special character",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

      const transporter = nodemailer.createTransport({
        host: "smtp.mail.ru",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify your email",
        html: getEmailVerificationTemplate(userName, verifyCode, email),
      });

      await User.create({
        userName,
        email,
        phoneNumber,
        password: hashedPassword,
        verifyCode,
        isEmailVerified: false,
      });

      res.status(201).json({
        message:
          "Verification code sent to your email. Please check and verify to complete registration.",
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Registration failed" });
    }
  }

  // Login user
  async login(req, res) {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ error: "Invalid password" });
      }

      if (user.dataValues.isEmailVerified === false) {
        return res.status(403).json({ error: "Email not verified" });
      }

      const accessToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET || "accessSecretKey",
        { expiresIn: "15m" },
      );

      const refreshToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_REFRESH_SECRET || "refreshSecretKey",
        { expiresIn: "7d" },
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        message: "Login successful",
        accessToken,
        refreshToken,
      });
    } catch (error) {
      res.status(500).json({ error: "Login failed" });
    }
  }

  // Google login handler
  async googleLogin(req, res) {
    try {
      const { tokenId } = req.body;
      if (!tokenId) {
        return res.status(400).json({ error: "Token ID is required" });
      }

      const ticket = await client.verifyIdToken({
        idToken: tokenId,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const { email, name, picture } = payload;

      if (!email) {
        return res.status(400).json({ error: "No email returned from Google" });
      }

      let user = await User.findOne({ where: { email } });
      if (user && user.dataValues.authProvider !== "google") {
        return res
          .status(400)
          .json({ error: "User already exists with different auth provider" });
      }
      if (!user) {
        user = await User.create({
          userName: name,
          email,
          password: null,
          phoneNumber: null,
          avatar: picture,
          authProvider: "google",
        });
      }

      const accessToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "15m" },
      );

      const refreshToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: "7d" },
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Strict",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.status(200).json({
        message: "Google login successful",
        accessToken,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Google login failed" });
    }
  }

  // Verify email using verification code
  async verifyEmail(req, res) {
    try {
      const { email, code } = req.query;

      if (!email || !code) {
        return res.status(400).json({ error: "Email and code are required" });
      }

      const user = await User.findOne({ where: { email, verifyCode: code } });

      if (!user) {
        return res.status(400).json({ error: "Invalid verification link" });
      }

      if (user.isEmailVerified) {
        return res.status(400).json({ error: "Email already verified" });
      }

      user.isEmailVerified = true;
      user.verifyCode = null;
      await user.save();

      return res.redirect(`${process.env.FRONTEND_URL}/email-verified-success`);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Email verification failed" });
    }
  }

  // Get user data
  async GetMe(req, res) {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      res.send({
        massage: "User data fetched successfully",
        user: {
          id: user.id,
          userName: user.userName,
          email: user.email,
          phoneNumber: user.phoneNumber,
          avatar: user.avatar,
        },
      });
    } catch (error) {
      console.error(error);

      if (error.name === "TokenExpiredError") {
        return res.status(401).json({ error: "Access token expired" });
      }

      res
        .status(500)
        .json({ error: "An error occurred while fetching user data" });
    }
  }

  // forgot password handler
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET, {
        expiresIn: "15m",
      });

      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

      const transporter = nodemailer.createTransport({
        host: "smtp.mail.ru",
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Verify your email",
        html: resetPasswordTemp(user.userName, verifyCode, email),
      });

      User.update({ verifyCode: verifyCode }, { where: { email } });

      res.json({ message: "Password reset email sent!" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Something went wrong" });
    }
  }

  // Reset password handler
  async resetPassword(req, res) {
    try {
      const { code, newPassword, email } = req.body;

      if (!code || !newPassword || !email) {
        return res
          .status(400)
          .json({ error: "Code, new password and email are required" });
      }

      const user = await User.findOne({ where: { email, verifyCode: code } });
      if (!user) {
        return res.status(404).json({ error: "Invalid code or email" });
      }
      if (user.isEmailVerified === false) {
        return res.status(403).json({ error: "Email not verified" });
      }

      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          error:
            "Password must be at least 8 characters, include uppercase, lowercase, number, and special character",
        });
      }
      const hashed = await bcrypt.hash(newPassword, 10);
      user.password = hashed;
      await user.save();

      res.json({ message: "Password reset successful!" });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid or expired token" });
    }
  }
}

module.exports = new AuthController();
