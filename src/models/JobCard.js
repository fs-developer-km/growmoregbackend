const mongoose = require('mongoose');

const jobCardSchema = new mongoose.Schema({
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead',
    required: true
  },
  engineer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  applianceType: {
    type: String
  },
  serviceType: {
    type: String
  },
  problemDescription: {
    type: String
  },
  workDone: {
    type: String
  },
  partsUsed: [
    {
      part: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Part'
      },
      partName: String,
      quantity: Number,
      salePrice: Number,
      totalPrice: Number
    }
  ],
  serviceCharge: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Completed'],
    default: 'Open'
  },
  photos: [String],
  remarks: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('JobCard', jobCardSchema);