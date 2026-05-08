const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  alternatePhone: {
    type: String
  },
  address: {
    type: String,
    required: true
  },
  area: {
    type: String
  },
  city: {
    type: String,
    default: 'Haridwar'
  },
  notes: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);