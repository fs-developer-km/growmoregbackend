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
amcSchema.pre('save', async function () {
  if (!this.contractNumber) {
    const count = await mongoose.model('AMC').countDocuments();
    const year = new Date().getFullYear();
    this.contractNumber = `AMC-${year}-${String(count + 1).padStart(4, '0')}`;
  }

});

module.exports = mongoose.model('AMC', amcSchema);



// bro isme ek kam kro jaise tumne amc ke liye bnaya hai na to isme sidebar me aise he sabhi pages ke liye dropdown daal do dropdownn bana ke jitne bhe pages hai sabhi pages ko alag se dropdoen animation morden ke sath droppdown bana ke jitne bhe pages hai sabhi ke liye  daal do us se pata chal jayega ke hamare sidebar me all feature kya hai aise client ko ander ke featrer pata nahi chalega jab sidebar me dropdown hoge to us se ye pata chal jayega ke all feature hai ye bhe hai ye bhe hai sabhi hai

// bro ye mera angular ka code hai isme mene layout ko chota change kiya tha mene isme sidebar me kuch dropdown add kiye the lekin iska structure bilkul change ho gaya hai iska main area content wala niche chla gaya hai check kro aur isko sahi karke do pura proper aur color code bhe shai karke do dark whiye sab sahi karke do propper code ke sath mobile me apne aap sidebar close ho jaye open close sab