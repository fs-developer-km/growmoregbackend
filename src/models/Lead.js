const mongoose = require('mongoose');

const leadSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  applianceType: {
    type: String,
    enum: ['AC', 'Refrigerator', 'Washing Machine', 'Geyser', 'Microwave', 'TV', 'Cooler', 'Other'],
    required: true
  },
  serviceType: {
    type: String,
    enum: ['Repair', 'Installation', 'Uninstallation', 'Shifting', 'AMC', 'Inspection', 'Other'],
    required: true
  },
  description: {
    type: String
  },
  status: {
    type: String,
    enum: ['New', 'Assigned', 'In Progress', 'Completed', 'Cancelled'],
    default: 'New'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  scheduledDate: {
    type: Date
  },
  completedDate: {
    type: Date
  },
  address: {
    type: String
  },
  remarks: {
    type: String
  }
}, { timestamps: true });

module.exports = mongoose.model('Lead', leadSchema);