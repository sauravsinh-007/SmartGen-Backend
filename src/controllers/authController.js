const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { generateTokens, verifyRefreshToken } = require('../middleware/auth');
const { uploadProfile, deleteFromCloudinary } = require('../config/cloudinary');
const logger = require('../utils/logger');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const sendTokenResponse = (res, user, statusCode = 200) => {
  const { accessToken, refreshToken } = generateTokens(user._id);

  res.status(statusCode).json({
    success: true,
    accessToken,
    refreshToken,
    user: user.toSafeObject(),
  });
};

exports.signup = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, password });
    logger.info(`New user registered: ${user.email}`);
    sendTokenResponse(res, user, 201);
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +passwordChangedAt');
    if (!user || !user.password) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Your account has been deactivated.' });
    }

    user.stats.lastActive = new Date();
    await user.save({ validateBeforeSave: false });

    logger.info(`User logged in: ${user.email}`);
    sendTokenResponse(res, user);
  } catch (error) {
    next(error);
  }
};

exports.googleLogin = async (req, res, next) => {
  try {
    const { idToken } = req.body;

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = await User.create({
        name,
        email,
        googleId,
        isEmailVerified: true,
        profilePhoto: picture ? { url: picture, publicId: null } : undefined,
      });
      logger.info(`New user via Google: ${email}`);
    } else if (!user.googleId) {
      user.googleId = googleId;
      if (!user.profilePhoto?.url && picture) {
        user.profilePhoto = { url: picture, publicId: null };
      }
      await user.save({ validateBeforeSave: false });
    }

    user.stats.lastActive = new Date();
    await user.save({ validateBeforeSave: false });

    sendTokenResponse(res, user);
  } catch (error) {
    if (error.message?.includes('Token used too late')) {
      return res.status(401).json({ error: 'Google token has expired. Please try again.' });
    }
    next(error);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token is required.' });
    }

    const decoded = verifyRefreshToken(refreshToken);
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Invalid refresh token.' });
    }

    sendTokenResponse(res, user);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token expired. Please login again.' });
    }
    next(error);
  }
};

exports.getMe = async (req, res) => {
  res.status(200).json({ success: true, user: req.user.toSafeObject() });
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, preferences, city, country } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (preferences) {
      updates['preferences.theme'] = preferences.theme || req.user.preferences.theme;
      updates['preferences.defaultOccasion'] = preferences.defaultOccasion || req.user.preferences.defaultOccasion;
      updates['preferences.notificationsEnabled'] =
        preferences.notificationsEnabled !== undefined
          ? preferences.notificationsEnabled
          : req.user.preferences.notificationsEnabled;
      updates['preferences.dailyReminderTime'] =
        preferences.dailyReminderTime || req.user.preferences.dailyReminderTime;
    }
    if (city) updates['preferences.city'] = city;
    if (country) updates['preferences.country'] = country;

    if (req.file) {
      if (req.user.profilePhoto?.publicId) {
        await deleteFromCloudinary(req.user.profilePhoto.publicId);
      }
      updates['profilePhoto.url'] = req.file.path;
      updates['profilePhoto.publicId'] = req.file.filename;
    }

    const user = await User.findByIdAndUpdate(req.user._id, { $set: updates }, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({ success: true, user: user.toSafeObject() });
  } catch (error) {
    next(error);
  }
};

exports.updateFcmToken = async (req, res, next) => {
  try {
    const { fcmToken } = req.body;
    await User.findByIdAndUpdate(req.user._id, { fcmToken });
    res.status(200).json({ success: true, message: 'FCM token updated.' });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    if (!user.password) {
      return res.status(400).json({ error: 'Cannot change password for Google-authenticated accounts.' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    user.password = newPassword;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    next(error);
  }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    res.status(200).json({ success: true, message: 'Account deactivated successfully.' });
  } catch (error) {
    next(error);
  }
};
