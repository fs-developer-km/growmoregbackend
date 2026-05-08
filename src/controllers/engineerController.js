const User = require('../models/User');

// @POST /api/engineers — Engineer add karo
const addEngineer = async (req, res) => {
  try {
    const { name, phone, password, email, address } = req.body;

    // Phone already exist karta hai?
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: 'Yeh phone number already registered hai' });
    }

    const engineer = await User.create({
      name,
      phone,
      password,
      email,
      address,
      role: 'engineer'
    });

    res.status(201).json({
      success: true,
      message: 'Engineer add ho gaya',
      engineer: {
        _id: engineer._id,
        name: engineer.name,
        phone: engineer.phone,
        role: engineer.role
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/engineers — Saare engineers ki list
const getAllEngineers = async (req, res) => {
  try {
    const engineers = await User.find({ role: 'engineer' })
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({ success: true, count: engineers.length, engineers });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/engineers/:id — Ek engineer ki detail
const getEngineerById = async (req, res) => {
  try {
    const engineer = await User.findById(req.params.id).select('-password');

    if (!engineer || engineer.role !== 'engineer') {
      return res.status(404).json({ message: 'Engineer nahi mila' });
    }

    res.json({ success: true, engineer });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/engineers/:id — Engineer update karo
const updateEngineer = async (req, res) => {
  try {
    const { name, phone, email, address, isActive } = req.body;

    const engineer = await User.findById(req.params.id);

    if (!engineer || engineer.role !== 'engineer') {
      return res.status(404).json({ message: 'Engineer nahi mila' });
    }

    engineer.name = name || engineer.name;
    engineer.phone = phone || engineer.phone;
    engineer.email = email || engineer.email;
    engineer.address = address || engineer.address;
    if (typeof isActive !== 'undefined') engineer.isActive = isActive;

    await engineer.save();

    res.json({ success: true, message: 'Engineer update ho gaya', engineer });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @DELETE /api/engineers/:id — Engineer band karo (delete nahi, sirf inactive)
const deactivateEngineer = async (req, res) => {
  try {
    const engineer = await User.findById(req.params.id);

    if (!engineer || engineer.role !== 'engineer') {
      return res.status(404).json({ message: 'Engineer nahi mila' });
    }

    engineer.isActive = false;
    await engineer.save();

    res.json({ success: true, message: 'Engineer deactivate ho gaya' });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  addEngineer,
  getAllEngineers,
  getEngineerById,
  updateEngineer,
  deactivateEngineer
};