const mongoose = require('mongoose');

const partSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['AC', 'Refrigerator', 'Washing Machine', 'Geyser', 'General', 'Other']
  },
  purchasePrice: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number,
    required: true
  },
  stock: {
    type: Number,
    default: 0
  },
  unit: {
    type: String,
    default: 'piece'
  },
  lowStockAlert: {
    type: Number,
    default: 2
  }
}, { timestamps: true });

module.exports = mongoose.model('Part', partSchema);