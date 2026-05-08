const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Token generate karne ka function
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @POST /api/auth/login
const login = async (req, res) => {
  try {
    const { phone, password } = req.body;

    // Phone se user dhundo
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(401).json({ message: 'Phone number galat hai' });
    }

    // Active hai ya nahi check karo
    if (!user.isActive) {
      return res.status(401).json({ message: 'Account band kar diya gaya hai' });
    }

    // Password check karo
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Password galat hai' });
    }

    // Token do
    res.json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/auth/me — apni profile dekho
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/auth/change-password
const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    const isMatch = await user.comparePassword(oldPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Purana password galat hai' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password badal gaya' });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { login, getMe, changePassword };