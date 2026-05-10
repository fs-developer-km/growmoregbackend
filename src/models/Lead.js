const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema({
  text: String,
  addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  addedAt: { type: Date, default: Date.now }
});

const timelineSchema = new mongoose.Schema({
  action: String,
  description: String,
  doneBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  doneAt: { type: Date, default: Date.now }
});

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
  description: String,
  status: {
    type: String,
    enum: ['New', 'Assigned', 'In Progress', 'Completed', 'Cancelled'],
    default: 'New'
  },
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },
  source: {
    type: String,
    enum: ['Phone Call', 'Website', 'WhatsApp', 'Referral', 'Walk-in', 'Other'],
    default: 'Phone Call'
  },
  tags: [String],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  scheduledDate: Date,
  completedDate: Date,
  followUpDate: Date,
  address: String,
  area: String,
  remarks: String,
  notes: [noteSchema],
  timeline: [timelineSchema],
  isPinned: { type: Boolean, default: false },
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

// Text search index
leadSchema.index({
  'address': 'text',
  'description': 'text',
  'remarks': 'text'
});

module.exports = mongoose.model('Lead', leadSchema);