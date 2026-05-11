const AMC = require('../models/AMC');
const Customer = require('../models/Customer');
const PDFDocument = require('pdfkit');

// Plan config
const PLAN_CONFIG = {
  Basic: { visits: 2, label: 'Basic Plan', color: '#6366F1' },
  Standard: { visits: 4, label: 'Standard Plan', color: '#10B981' },
  Premium: { visits: 6, label: 'Premium Plan', color: '#F59E0B' }
};

// @POST /api/amc/contracts
const createContract = async (req, res) => {
  try {
    const {
      customerId, plan, appliances,
      startDate, amount, paymentMethod,
      totalFreeVisits, notes, terms
    } = req.body;

    const start = new Date(startDate);
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);

    const planVisits = totalFreeVisits || PLAN_CONFIG[plan]?.visits || 4;

    const amc = new AMC({
      customer: customerId,
      plan,
      appliances: appliances || [],
      startDate: start,
      endDate: end,
      amount,
      totalFreeVisits: planVisits,
      notes,
      terms,
      createdBy: req.user._id,
      status: 'Active'
    });

    // Initial payment
    if (paymentMethod) {
      amc.paidAmount = amount;
      amc.paymentStatus = 'Paid';
      amc.paymentHistory.push({
        amount,
        method: paymentMethod,
        date: new Date(),
        receivedBy: req.user._id
      });
    }

    await amc.save();

    const populated = await AMC.findById(amc._id)
      .populate('customer', 'name phone address')
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      message: 'AMC contract ban gaya!',
      amc: populated
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/amc/contracts
const getAllContracts = async (req, res) => {
  try {
    const {
      status, plan, search,
      page = 1, limit = 20,
      sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    let query = {};
    if (status) query.status = status;
    if (plan) query.plan = plan;

    if (search) {
      const customers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.$or = [
        { customer: { $in: customers.map(c => c._id) } },
        { contractNumber: { $regex: search, $options: 'i' } }
      ];
    }

    // Auto expire contracts
    await AMC.updateMany(
      { endDate: { $lt: new Date() }, status: 'Active' },
      { status: 'Expired' }
    );

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const total = await AMC.countDocuments(query);
    const contracts = await AMC.find(query)
      .populate('customer', 'name phone address area')
      .populate('createdBy', 'name')
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    res.json({ success: true, total, contracts });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/amc/contracts/:id
const getContractById = async (req, res) => {
  try {
    const amc = await AMC.findById(req.params.id)
      .populate('customer', 'name phone address area')
      .populate('createdBy', 'name')
      .populate('visits.engineer', 'name phone')
      .populate('paymentHistory.receivedBy', 'name')
      .populate('renewedFrom', 'contractNumber');

    if (!amc) return res.status(404).json({ message: 'Contract nahi mila' });

    res.json({ success: true, amc });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/amc/contracts/:id
const updateContract = async (req, res) => {
  try {
    const amc = await AMC.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('customer', 'name phone');

    if (!amc) return res.status(404).json({ message: 'Contract nahi mila' });

    res.json({ success: true, message: 'Contract update ho gaya', amc });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/amc/contracts/:id/renew
const renewContract = async (req, res) => {
  try {
    const { amount, paymentMethod, plan } = req.body;
    const oldAmc = await AMC.findById(req.params.id)
      .populate('customer', 'name phone');

    if (!oldAmc) return res.status(404).json({ message: 'Contract nahi mila' });

    const newPlan = plan || oldAmc.plan;
    const newStart = new Date();
    const newEnd = new Date(newStart);
    newEnd.setFullYear(newEnd.getFullYear() + 1);

    const newAmc = new AMC({
      customer: oldAmc.customer._id,
      plan: newPlan,
      appliances: oldAmc.appliances,
      startDate: newStart,
      endDate: newEnd,
      amount: amount || oldAmc.amount,
      totalFreeVisits: PLAN_CONFIG[newPlan]?.visits || 4,
      notes: oldAmc.notes,
      terms: oldAmc.terms,
      createdBy: req.user._id,
      status: 'Active',
      renewedFrom: oldAmc._id,
      paidAmount: amount || oldAmc.amount,
      paymentStatus: 'Paid',
      paymentHistory: [{
        amount: amount || oldAmc.amount,
        method: paymentMethod || 'Cash',
        date: new Date(),
        receivedBy: req.user._id
      }]
    });

    await newAmc.save();

    // Old contract status update
    oldAmc.status = 'Expired';
    await oldAmc.save();

    const populated = await AMC.findById(newAmc._id)
      .populate('customer', 'name phone address');

    res.json({
      success: true,
      message: 'Contract renew ho gaya!',
      amc: populated
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/amc/contracts/:id/cancel
const cancelContract = async (req, res) => {
  try {
    const amc = await AMC.findByIdAndUpdate(
      req.params.id,
      { status: 'Cancelled' },
      { new: true }
    );

    if (!amc) return res.status(404).json({ message: 'Contract nahi mila' });

    res.json({ success: true, message: 'Contract cancel ho gaya', amc });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/amc/contracts/:id/visits
const addVisit = async (req, res) => {
  try {
    const { engineerId, workDone, partsUsed, notes, nextVisitDate, status } = req.body;
    const amc = await AMC.findById(req.params.id);

    if (!amc) return res.status(404).json({ message: 'Contract nahi mila' });

    const visit = {
      visitDate: new Date(),
      engineer: engineerId,
      workDone,
      partsUsed: partsUsed || [],
      status: status || 'Completed',
      notes,
      nextVisitDate: nextVisitDate ? new Date(nextVisitDate) : null
    };

    amc.visits.push(visit);
    if (status === 'Completed') amc.usedVisits += 1;

    await amc.save();

    const updated = await AMC.findById(amc._id)
      .populate('visits.engineer', 'name phone');

    res.json({
      success: true,
      message: 'Visit record ho gayi!',
      visits: updated.visits,
      remainingVisits: amc.totalFreeVisits - amc.usedVisits
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/amc/contracts/:id/payment
const addPayment = async (req, res) => {
  try {
    const { amount, method, notes } = req.body;
    const amc = await AMC.findById(req.params.id);

    if (!amc) return res.status(404).json({ message: 'Contract nahi mila' });

    amc.paymentHistory.push({
      amount,
      method,
      notes,
      date: new Date(),
      receivedBy: req.user._id
    });

    amc.paidAmount += amount;

    if (amc.paidAmount >= amc.amount) {
      amc.paymentStatus = 'Paid';
    } else if (amc.paidAmount > 0) {
      amc.paymentStatus = 'Partial';
    }

    await amc.save();

    res.json({ success: true, message: 'Payment record ho gaya!', amc });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/amc/expiring
const getExpiringContracts = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const contracts = await AMC.find({
      status: 'Active',
      endDate: { $gte: now, $lte: thirtyDays }
    })
      .populate('customer', 'name phone address')
      .sort({ endDate: 1 });

    const grouped = {
      sevenDays: contracts.filter(c => {
        const days = Math.ceil((c.endDate - now) / (1000 * 60 * 60 * 24));
        return days <= 7;
      }),
      fifteenDays: contracts.filter(c => {
        const days = Math.ceil((c.endDate - now) / (1000 * 60 * 60 * 24));
        return days > 7 && days <= 15;
      }),
      thirtyDays: contracts.filter(c => {
        const days = Math.ceil((c.endDate - now) / (1000 * 60 * 60 * 24));
        return days > 15 && days <= 30;
      })
    };

    res.json({ success: true, contracts, grouped, total: contracts.length });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/amc/stats
const getStats = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      totalActive, totalExpired, totalCancelled,
      expiringCount, allActive
    ] = await Promise.all([
      AMC.countDocuments({ status: 'Active' }),
      AMC.countDocuments({ status: 'Expired' }),
      AMC.countDocuments({ status: 'Cancelled' }),
      AMC.countDocuments({ status: 'Active', endDate: { $gte: now, $lte: thirtyDays } }),
      AMC.find({ status: 'Active' }).select('amount paidAmount plan')
    ]);

    const totalMRR = allActive.reduce((s, a) => s + (a.amount / 12), 0);
    const totalRevenue = allActive.reduce((s, a) => s + a.paidAmount, 0);
    const pendingRevenue = allActive.reduce((s, a) => s + (a.amount - a.paidAmount), 0);

    const planBreakdown = {
      Basic: allActive.filter(a => a.plan === 'Basic').length,
      Standard: allActive.filter(a => a.plan === 'Standard').length,
      Premium: allActive.filter(a => a.plan === 'Premium').length
    };

    res.json({
      success: true,
      stats: {
        totalActive, totalExpired, totalCancelled,
        expiringCount, totalMRR: Math.round(totalMRR),
        totalRevenue, pendingRevenue, planBreakdown
      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/amc/contracts/:id/pdf
const generatePDF = async (req, res) => {
  try {
    const amc = await AMC.findById(req.params.id)
      .populate('customer', 'name phone address')
      .populate('createdBy', 'name');

    if (!amc) return res.status(404).json({ message: 'Contract nahi mila' });

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${amc.contractNumber}.pdf`);
    doc.pipe(res);

    const planColors = { Basic: '#6366F1', Standard: '#10B981', Premium: '#F59E0B' };
    const planColor = planColors[amc.plan] || '#6366F1';

    // Header
    doc.rect(0, 0, 612, 110).fill(planColor);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
      .text('GrowMore Appliances', 50, 28);
    doc.fontSize(11).font('Helvetica')
      .text('Annual Maintenance Contract (AMC)', 50, 55);
    doc.fontSize(10)
      .text(`Contract: ${amc.contractNumber}`, 400, 35, { align: 'right', width: 162 })
      .text(`Plan: ${amc.plan}`, 400, 52, { align: 'right', width: 162 })
      .text(`Date: ${new Date(amc.createdAt).toLocaleDateString('en-IN')}`, 400, 69, { align: 'right', width: 162 });

    // Customer
    doc.rect(50, 125, 512, 70).fill('#F8FAFF').stroke('#E0E7FF');
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica-Bold')
      .text('CUSTOMER DETAILS', 65, 135);
    doc.fillColor('#1E1B4B').fontSize(13).font('Helvetica-Bold')
      .text(amc.customer.name, 65, 148);
    doc.fillColor('#64748B').fontSize(10).font('Helvetica')
      .text(`📞 ${amc.customer.phone}`, 65, 165)
      .text(`📍 ${amc.customer.address || ''}`, 65, 180);

    // Contract Details
    doc.rect(50, 210, 240, 80).fill('#EEF2FF').stroke('#C7D2FE');
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica-Bold').text('CONTRACT PERIOD', 65, 220);
    doc.fillColor('#4F46E5').fontSize(12).font('Helvetica-Bold')
      .text(`${new Date(amc.startDate).toLocaleDateString('en-IN')}`, 65, 234);
    doc.fillColor('#64748B').fontSize(9).text('to', 65, 252);
    doc.fillColor('#4F46E5').fontSize(12).font('Helvetica-Bold')
      .text(`${new Date(amc.endDate).toLocaleDateString('en-IN')}`, 65, 265);

    doc.rect(320, 210, 242, 80).fill('#F0FDF4').stroke('#BBF7D0');
    doc.fillColor('#94A3B8').fontSize(9).font('Helvetica-Bold').text('SERVICE VISITS', 335, 220);
    doc.fillColor('#16A34A').fontSize(28).font('Helvetica-Bold')
      .text(`${amc.totalFreeVisits}`, 335, 230);
    doc.fillColor('#64748B').fontSize(9).font('Helvetica').text('Free visits included', 335, 263);

    // Amount
    doc.rect(50, 305, 512, 50).fill(planColor);
    doc.fillColor('rgba(255,255,255,0.8)').fontSize(10).font('Helvetica')
      .text('TOTAL AMOUNT', 65, 315);
    doc.fillColor('white').fontSize(22).font('Helvetica-Bold')
      .text(`Rs. ${amc.amount}`, 65, 328);
    doc.fillColor('rgba(255,255,255,0.8)').fontSize(10).font('Helvetica')
      .text(`Payment: ${amc.paymentStatus}`, 400, 322, { align: 'right', width: 148 });

    // Appliances
    let y = 375;
    doc.fillColor('#1E1B4B').fontSize(12).font('Helvetica-Bold').text('Covered Appliances:', 50, y);
    y += 20;

    if (amc.appliances && amc.appliances.length > 0) {
      amc.appliances.forEach((ap, i) => {
        doc.rect(50, y, 512, 30).fill(i % 2 === 0 ? '#F8FAFF' : 'white').stroke('#F0F4FF');
        doc.fillColor('#374151').fontSize(10).font('Helvetica')
          .text(`${i + 1}. ${ap.type}${ap.brand ? ' — ' + ap.brand : ''}${ap.model ? ' ' + ap.model : ''}`, 65, y + 9);
        if (ap.serialNumber) {
          doc.fillColor('#94A3B8').text(`S/N: ${ap.serialNumber}`, 400, y + 9, { align: 'right', width: 148 });
        }
        y += 32;
      });
    }

    // Terms
    y += 10;
    if (amc.terms) {
      doc.fillColor('#1E1B4B').fontSize(11).font('Helvetica-Bold').text('Terms & Conditions:', 50, y);
      y += 15;
      doc.fillColor('#64748B').fontSize(9).font('Helvetica').text(amc.terms, 50, y, { width: 512 });
    }

    // Footer
    doc.rect(0, 770, 612, 71).fill(planColor);
    doc.fillColor('white').fontSize(10).font('Helvetica')
      .text('Thank you for choosing GrowMore Appliances!', 50, 790, { align: 'center', width: 512 });
    doc.fontSize(9)
      .text(`This is a computer generated document. Contract: ${amc.contractNumber}`, 50, 808, { align: 'center', width: 512 });

    doc.end();

  } catch (err) {
    res.status(500).json({ message: 'PDF generate nahi hua', error: err.message });
  }
};

// @GET /api/amc/contracts/:id/whatsapp
const getWhatsappLink = async (req, res) => {
  try {
    const amc = await AMC.findById(req.params.id)
      .populate('customer', 'name phone');

    if (!amc) return res.status(404).json({ message: 'Contract nahi mila' });

    const remaining = amc.totalFreeVisits - amc.usedVisits;
    const endDate = new Date(amc.endDate).toLocaleDateString('en-IN');

    const message =
`🔧 *GrowMore Appliances*
━━━━━━━━━━━━━━━━━━
✅ *AMC Contract Confirmed!*

📋 *Contract:* ${amc.contractNumber}
👤 *Customer:* ${amc.customer.name}
⭐ *Plan:* ${amc.plan}
📅 *Valid Till:* ${endDate}
🔧 *Free Visits:* ${remaining} remaining
💰 *Amount:* Rs.${amc.amount}
━━━━━━━━━━━━━━━━━━
Koi bhi service ke liye call karein.
Shukriya! 🙏`;

    const phone = amc.customer.phone.replace(/\D/g, '');
    const waLink = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;

    res.json({ success: true, waLink, message });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/amc/export
const exportExcel = async (req, res) => {
  try {
    const { status } = req.query;
    let query = {};
    if (status) query.status = status;

    const contracts = await AMC.find(query)
      .populate('customer', 'name phone address')
      .sort({ createdAt: -1 });

    let csv = '\uFEFF';
    csv += 'Contract No,Customer,Phone,Plan,Start Date,End Date,Amount,Paid,Status,Visits Used,Visits Total\n';

    contracts.forEach(c => {
      csv += [
        c.contractNumber,
        `"${c.customer?.name || ''}"`,
        c.customer?.phone || '',
        c.plan,
        new Date(c.startDate).toLocaleDateString('en-IN'),
        new Date(c.endDate).toLocaleDateString('en-IN'),
        c.amount,
        c.paidAmount,
        c.status,
        c.usedVisits,
        c.totalFreeVisits
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=amc-contracts-${Date.now()}.csv`);
    res.send(csv);

  } catch (err) {
    res.status(500).json({ message: 'Export nahi hua', error: err.message });
  }
};

module.exports = {
  createContract, getAllContracts, getContractById,
  updateContract, renewContract, cancelContract,
  addVisit, addPayment, getExpiringContracts,
  getStats, generatePDF, getWhatsappLink, exportExcel
};