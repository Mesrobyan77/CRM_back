require("dotenv").config();
const bcrypt = require("bcrypt");
const { User } = require("../../Models/rootModel");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
      const refreshToken = req.body.refreshToken || req.cookies.refreshToken;
      if (!refreshToken)
        return res.status(401).json({ error: "Refresh token required" });
      jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, (err, user) => {
        if (err)
          return res.status(403).json({ error: "Invalid refresh token" });

        const newAccessToken = jwt.sign(
          { id: user.id, email: user.email },
          process.env.JWT_SECRET,
          { expiresIn: process.env.JWT_ACCESS_EXPIRES },
        );

        return res.json({ accessToken: newAccessToken });
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Could not refresh token" });
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
      if (existingUser)
        return res.status(400).json({ error: "Email already exists" });
      if (!passwordRegex.test(password)) {
        return res.status(400).json({
          error:
            "Password must be at least 8 characters, include uppercase, lowercase, number, and special character",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

      const newUser = await User.create({
        userName,
        email,
        phoneNumber,
        password: hashedPassword,
        verifyCode,
        isEmailVerified: false,
      });

      // Auto-delete unverified user after 2 minutes
      setTimeout(
        async () => {
          try {
            const user = await User.findByPk(newUser.id);
            if (user && !user.isEmailVerified) {
              await user.destroy();
              console.log(`Unverified user ${user.email} deleted`);
            }
          } catch (err) {
            console.error("Auto-delete error:", err);
          }
        },
        2 * 60 * 1000,
      ); // 2 minutes

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

      return res.status(201).json({
        success: true,
        message:
          "Registration successful! Check your email to verify your account.",
        userId: newUser.id,
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
      if (!email || !password)
        return res.status(400).json({ error: "Email and password required" });

      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword)
        return res.status(401).json({ error: "Invalid password" });

      if (!user.isEmailVerified)
        return res.status(403).json({ error: "Email not verified" });

      const accessToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_ACCESS_EXPIRES },
      );

      const refreshToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES },
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.json({ accessToken, refreshToken });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Login failed" });
    }
  }

  // Google login handler
  async googleLogin(req, res) {
    try {
      const { tokenId } = req.body;
      if (!tokenId)
        return res.status(400).json({ error: "Token ID is required" });

      const ticket = await client.verifyIdToken({
        idToken: tokenId,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const { email, name, picture } = payload;

      if (!email)
        return res.status(400).json({ error: "No email returned from Google" });

      let user = await User.findOne({ where: { email } });
      if (user && user.authProvider !== "google")
        return res
          .status(400)
          .json({ error: "User exists with different provider" });

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
        { expiresIn: process.env.JWT_ACCESS_EXPIRES },
      );

      const refreshToken = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_REFRESH_SECRET,
        { expiresIn: process.env.JWT_REFRESH_EXPIRES },
      );

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res
        .status(200)
        .json({ message: "Google login successful", accessToken });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Google login failed" });
    }
  }

  // Verify email
  async verifyEmail(req, res) {
    try {
      const { email, code } = req.query;
      if (!email || !code)
        return res.status(400).json({ error: "Email and code required" });

      const user = await User.findOne({ where: { email, verifyCode: code } });
      if (!user)
        return res.status(400).json({ error: "Invalid verification link" });
      if (user.isEmailVerified)
        return res.status(400).json({ error: "Email already verified" });

      user.isEmailVerified = true;
      user.verifyCode = null;
      await user.save();

      return res.redirect(`${process.env.FRONTEND_URL}/login`);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Email verification failed" });
    }
  }

  // Get user data
  async GetMe(req, res) {
    try {
      const user = req.user;

      return res.json({
        message: "User data fetched successfully",
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
      if (error.name === "TokenExpiredError")
        return res.status(401).json({ error: "Access token expired" });

      return res.status(500).json({ error: "An error occurred" });
    }
  }

  // Forgot password
  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const user = await User.findOne({ where: { email } });
      if (!user) return res.status(404).json({ error: "User not found" });

      const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

      const transporter = nodemailer.createTransport({
        host: "smtp.mail.ru",
        port: 465,
        secure: true,
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Password reset code",
        html: resetPasswordTemp(user.userName, verifyCode, email),
      });

      await User.update({ verifyCode }, { where: { email } });

      return res.json({ message: "Password reset email sent!" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Something went wrong" });
    }
  }

  // Reset password
  async resetPassword(req, res) {
    try {
      const { code, newPassword, email } = req.body;
      if (!code || !newPassword || !email)
        return res
          .status(400)
          .json({ error: "Code, new password and email required" });

      const user = await User.findOne({ where: { email, verifyCode: code } });
      if (!user)
        return res.status(404).json({ error: "Invalid code or email" });
      if (!user.isEmailVerified)
        return res.status(403).json({ error: "Email not verified" });

      if (!passwordRegex.test(newPassword)) {
        return res.status(400).json({
          error:
            "Password must be at least 8 characters, include uppercase, lowercase, number, and special character",
        });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.verifyCode = null;
      await user.save();

      return res.json({ message: "Password reset successful!" });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Invalid or expired token" });
    }
  }
}

module.exports = new AuthController();
