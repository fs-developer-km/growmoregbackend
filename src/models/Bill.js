const mongoose = require('mongoose');

const billSchema = new mongoose.Schema({
  billNumber: {
    type: String,
    unique: true
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Lead'
  },
  jobCard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'JobCard'
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  partsUsed: [
    {
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
  subtotal: {
    type: Number,
    default: 0
  },
  gstPercent: {
    type: Number,
    default: 0
  },
  gstAmount: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  grandTotal: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Partial'],
    default: 'Pending'
  },
  paymentMethod: {
    type: String,
    enum: ['Cash', 'UPI', 'Card', 'Bank Transfer', 'Other'],
    default: 'Cash'
  },
  notes: {
    type: String
  },
  whatsappSent: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

// Bill number auto generate
billSchema.pre('save', async function(next) {
  if (!this.billNumber) {
    const count = await mongoose.model('Bill').countDocuments();
    this.billNumber = 'GMA-' + String(count + 1).padStart(4, '0');
  }
  next();
});

module.exports = mongoose.model('Bill', billSchema);