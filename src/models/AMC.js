const mongoose = require('mongoose');

const applianceSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['AC', 'Refrigerator', 'Washing Machine', 'Geyser', 'Microwave', 'TV', 'Cooler', 'Other'],
    required: true
  },
  brand: String,
  model: String,
  serialNumber: String,
  purchaseYear: Number
});

const visitSchema = new mongoose.Schema({
  visitDate: { type: Date, default: Date.now },
  engineer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  workDone: String,
  partsUsed: [{
    partName: String,
    quantity: Number,
    isFree: { type: Boolean, default: true },
    amount: { type: Number, default: 0 }
  }],
  status: {
    type: String,
    enum: ['Scheduled', 'Completed', 'Cancelled'],
    default: 'Scheduled'
  },
  notes: String,
  nextVisitDate: Date
});

const paymentSchema = new mongoose.Schema({
  amount: Number,
  date: { type: Date, default: Date.now },
  method: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'],
    default: 'Cash'
  },
  notes: String,
  receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const amcSchema = new mongoose.Schema({
  contractNumber: {
    type: String,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  plan: {
    type: String,
    enum: ['Basic', 'Standard', 'Premium'],
    required: true
  },
  appliances: [applianceSchema],
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  amount: { type: Number, required: true },
  paidAmount: { type: Number, default: 0 },
  paymentStatus: {
    type: String,
    enum: ['Paid', 'Partial', 'Pending'],
    default: 'Pending'
  },
  paymentHistory: [paymentSchema],
  totalFreeVisits: { type: Number, default: 4 },
  usedVisits: { type: Number, default: 0 },
  visits: [visitSchema],
  status: {
    type: String,
    enum: ['Active', 'Expired', 'Cancelled', 'Pending'],
    default: 'Active'
  },
  renewedFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AMC'
  },
  notes: String,
  terms: String,
  reminderSent: {
    thirtyDay: { type: Boolean, default: false },
    fifteenDay: { type: Boolean, default: false },
    sevenDay: { type: Boolean, default: false }
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Auto contract number
amcSchema.pre('save', async function(next) {
  if (!this.contractNumber) {
    const count = await mongoose.model('AMC').countDocuments();
    const year = new Date().getFullYear();
    this.contractNumber = `AMC-${year}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

module.exports = mongoose.model('AMC', amcSchema);