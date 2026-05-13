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

const happyCallSchema = new mongoose.Schema({
  called: { type: Boolean, default: false },
  calledAt: Date,
  calledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  satisfied: { type: Boolean },
  remarks: String,
  followUpRequired: { type: Boolean, default: false }
});

const leadSchema = new mongoose.Schema({
  // Customer
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },

  // Product Info — Excel cols H, I, J
  applianceType: {
    type: String,
    enum: ['AC', 'Refrigerator', 'Washing Machine', 'Geyser',
           'Microwave', 'TV', 'Cooler', 'LED', 'Chimney', 'Other'],
    required: true
  },
  subProduct: {
    type: String,
    enum: ['Split', 'Window', 'Cassette', 'Tower', 'Portable',
           'Fully Automatic', 'Semi Automatic', 'Single Door',
           'Double Door', 'Side by Side', 'Front Load', 'Top Load',
           'Other', ''],
    default: ''
  },
  subProduct2: { type: String, default: '' },

  // Service Info — Excel col L
  serviceType: {
    type: String,
    enum: ['Repair', 'Installation', 'Uninstallation',
           'Re-Installation', 'Shifting', 'AMC',
           'Inspection', 'Service', 'Other'],
    required: true
  },

  // Description — Excel col M
  description: { type: String, default: '' },

  // Reference — Excel col E
  reference: { type: String, default: '' },

  // Repeat/Fresh — Excel col K
  customerType: {
    type: String,
    enum: ['Fresh', 'Repeat'],
    default: 'Fresh'
  },

  // Status
  status: {
    type: String,
    enum: ['New', 'Scheduled', 'Assigned', 'In Progress',
           'Completed', 'Cancelled', 'Pending'],
    default: 'New'
  },

  // Priority
  priority: {
    type: String,
    enum: ['High', 'Medium', 'Low'],
    default: 'Medium'
  },

  // Source
  source: {
    type: String,
    enum: ['Phone Call', 'Website', 'WhatsApp', 'Referral', 'Walk-in', 'Other'],
    default: 'Phone Call'
  },

  // Address
  address: { type: String, default: '' },
  area: { type: String, default: '' },

  // Scheduling — Excel cols P, Q
  scheduledDate: { type: Date },
  appointmentTime: { type: String, default: '' }, // "08 AM", "10-11 AM" etc

  // Estimate — Excel col R
  estimateAmount: { type: Number, default: 0 },

  // Assignment
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Dates
  completedDate: { type: Date },
  callCloseDate: { type: Date }, // Excel col S

  // Work Done Remark — Excel col U
  workRemark: { type: String, default: '' },

  // Financial — Excel cols V, W, X, Y, Z
  totalAmount: { type: Number, default: 0 },
  partsLpCost: { type: Number, default: 0 },   // Parts purchase cost
  finalAmount: { type: Number, default: 0 },    // Final amount received
  companyShare: { type: Number, default: 0 },   // Company profit
  engineerShare: { type: Number, default: 0 },  // Engineer commission

  // Happy Call — Excel col AB
  happyCall: { type: happyCallSchema, default: () => ({}) },

  // General
  remarks: { type: String, default: '' },
  tags: [String],
  isPinned: { type: Boolean, default: false },
  notes: [noteSchema],
  timeline: [timelineSchema]
}, { timestamps: true });

leadSchema.index({ 'address': 'text', 'description': 'text' });

module.exports = mongoose.model('Lead', leadSchema);