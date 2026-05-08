const Part = require('../models/Part');

const getAllParts = async (req, res) => {
  try {
    const parts = await Part.find().sort({ name: 1 });
    res.json({ success: true, parts });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const addPart = async (req, res) => {
  try {
    const { name, category, purchasePrice, salePrice, stock, unit, lowStockAlert } = req.body;
    const part = await Part.create({
      name, category, purchasePrice,
      salePrice, stock, unit, lowStockAlert
    });
    res.status(201).json({ success: true, message: 'Part add ho gaya', part });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const updatePart = async (req, res) => {
  try {
    const part = await Part.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!part) return res.status(404).json({ message: 'Part nahi mila' });
    res.json({ success: true, message: 'Part update ho gaya', part });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getAllParts, addPart, updatePart };