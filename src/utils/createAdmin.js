const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createAdmin = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  const existing = await User.findOne({ phone: '9999999999' });
  if (existing) {
    console.log('Admin already exists');
    process.exit();
  }

  const admin = await User.create({
    name: 'GrowMore Admin',
    phone: '9999999999',
    password: 'admin123',
    role: 'admin'
  });

  console.log('Admin created:', admin.name);
  process.exit();
};

createAdmin();