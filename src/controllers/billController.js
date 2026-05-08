const Bill = require('../models/Bill');
const JobCard = require('../models/JobCard');
const PDFDocument = require('pdfkit');

// @POST /api/bills
const createBill = async (req, res) => {
  try {
    const {
      customerId,
      jobCardId,
      leadId,
      partsUsed,
      serviceCharge,
      gstPercent,
      discount,
      grandTotal,
      paymentMethod,
      paymentStatus,
      notes
    } = req.body;

    // Validation
    if (!customerId) {
      return res.status(400).json({ message: 'Customer ID zaroori hai' });
    }

    // Subtotal calculate karo
    let partsTotal = 0;
    let processedParts = [];

    if (partsUsed && partsUsed.length > 0) {
      processedParts = partsUsed.map(p => ({
        partName: p.partName || 'Part',
        quantity: Number(p.quantity) || 1,
        salePrice: Number(p.salePrice) || 0,
        totalPrice: Number(p.totalPrice) || (Number(p.quantity) * Number(p.salePrice)) || 0
      }));
      partsTotal = processedParts.reduce((sum, p) => sum + p.totalPrice, 0);
    }

    const serviceChargeNum = Number(serviceCharge) || 0;
    const subtotal = partsTotal + serviceChargeNum;
    const gstPercentNum = Number(gstPercent) || 0;
    const gstAmount = Math.round((subtotal * gstPercentNum) / 100);
    const discountNum = Number(discount) || 0;
    const finalGrandTotal = grandTotal
      ? Number(grandTotal)
      : subtotal + gstAmount - discountNum;

    const bill = await Bill.create({
      customer: customerId,
      jobCard: jobCardId || undefined,
      lead: leadId || undefined,
      createdBy: req.user._id,
      partsUsed: processedParts,
      serviceCharge: serviceChargeNum,
      subtotal,
      gstPercent: gstPercentNum,
      gstAmount,
      discount: discountNum,
      grandTotal: finalGrandTotal,
      paymentMethod: paymentMethod || 'Cash',
      paymentStatus: paymentStatus || 'Pending',
      notes: notes || ''
    });

    const populated = await Bill.findById(bill._id)
      .populate('customer', 'name phone address')
      .populate('createdBy', 'name');

    res.status(201).json({
      success: true,
      message: 'Bill ban gaya',
      bill: populated
    });

  } catch (err) {
    console.error('Bill create error:', err);
    res.status(500).json({
      message: 'Server error',
      error: err.message
    });
  }
};

// @GET /api/bills
const getAllBills = async (req, res) => {
  try {
    const { page = 1, limit = 20, paymentStatus } = req.query;

    let query = {};
    if (paymentStatus) query.paymentStatus = paymentStatus;

    const bills = await Bill.find(query)
      .populate('customer', 'name phone')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Bill.countDocuments(query);

    res.json({ success: true, total, bills });

  } catch (err) {
    console.error('Get bills error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/bills/:id
const getBillById = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customer', 'name phone address')
      .populate('createdBy', 'name phone')
      .populate('jobCard');

    if (!bill) {
      return res.status(404).json({ message: 'Bill nahi mila' });
    }

    res.json({ success: true, bill });

  } catch (err) {
    console.error('Get bill error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/bills/:id/pdf
const downloadBillPDF = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customer', 'name phone address')
      .populate('createdBy', 'name');

    if (!bill) {
      return res.status(404).json({ message: 'Bill nahi mila' });
    }

    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Bill-${bill.billNumber}.pdf`);
    doc.pipe(res);

    // ===== HEADER =====
    doc.rect(0, 0, 612, 100).fill('#4F46E5');

    doc.fillColor('white')
       .fontSize(24)
       .font('Helvetica-Bold')
       .text('GrowMore Appliances', 50, 30);

    doc.fillColor('rgba(255,255,255,0.8)')
       .fontSize(10)
       .font('Helvetica')
       .text('Home Appliance Service', 50, 58);

    doc.fillColor('white')
       .fontSize(10)
       .text(`Bill No: ${bill.billNumber}`, 400, 35, { align: 'right', width: 162 });

    doc.fillColor('rgba(255,255,255,0.8)')
       .fontSize(9)
       .text(`Date: ${new Date(bill.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, 400, 55, { align: 'right', width: 162 });

    // ===== CUSTOMER INFO =====
    doc.fillColor('#1E1B4B')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('BILL TO:', 50, 120);

    doc.fillColor('#1a1a2e')
       .fontSize(13)
       .font('Helvetica-Bold')
       .text(bill.customer.name, 50, 135);

    doc.fillColor('#64748B')
       .fontSize(10)
       .font('Helvetica')
       .text(`Phone: ${bill.customer.phone}`, 50, 155);

    if (bill.customer.address) {
      doc.text(`Address: ${bill.customer.address}`, 50, 170);
    }

    // ===== ITEMS TABLE =====
    const tableTop = 210;

    // Table header background
    doc.rect(50, tableTop, 512, 28).fill('#F0F4FF');

    doc.fillColor('#4F46E5')
       .fontSize(9)
       .font('Helvetica-Bold')
       .text('ITEM', 58, tableTop + 9)
       .text('QTY', 310, tableTop + 9)
       .text('RATE', 370, tableTop + 9)
       .text('TOTAL', 460, tableTop + 9);

    // Items
    let y = tableTop + 38;
    doc.font('Helvetica').fontSize(10);

    const allItems = [...(bill.partsUsed || [])];
    if (bill.serviceCharge > 0) {
      allItems.push({
        partName: 'Service Charge',
        quantity: 1,
        salePrice: bill.serviceCharge,
        totalPrice: bill.serviceCharge
      });
    }

    allItems.forEach((item, index) => {
      if (index % 2 === 0) {
        doc.rect(50, y - 5, 512, 24).fill('#F8FAFF');
      }

      doc.fillColor('#1E1B4B')
         .text(item.partName, 58, y, { width: 240 })
         .text(String(item.quantity), 310, y)
         .text(`Rs.${item.salePrice}`, 370, y)
         .text(`Rs.${item.totalPrice}`, 460, y);

      y += 28;
    });

    // ===== TOTALS =====
    y += 10;
    doc.moveTo(50, y).lineTo(562, y).strokeColor('#E0E7FF').stroke();
    y += 14;

    const totalsX = 380;
    const amtX = 562;

    doc.fillColor('#64748B').fontSize(10).font('Helvetica');
    doc.text('Subtotal:', totalsX, y)
       .text(`Rs.${bill.subtotal}`, totalsX, y, { align: 'right', width: amtX - totalsX });

    y += 20;

    if (bill.gstAmount > 0) {
      doc.text(`GST (${bill.gstPercent}%):`, totalsX, y)
         .text(`Rs.${bill.gstAmount}`, totalsX, y, { align: 'right', width: amtX - totalsX });
      y += 20;
    }

    if (bill.discount > 0) {
      doc.fillColor('#16A34A')
         .text(`Discount:`, totalsX, y)
         .text(`-Rs.${bill.discount}`, totalsX, y, { align: 'right', width: amtX - totalsX });
      y += 20;
    }

    // Grand Total Box
    y += 6;
    doc.rect(totalsX - 10, y, amtX - totalsX + 20, 36).fill('#4F46E5');

    doc.fillColor('white')
       .fontSize(11)
       .font('Helvetica-Bold')
       .text('GRAND TOTAL', totalsX - 4, y + 11)
       .text(`Rs.${bill.grandTotal}`, totalsX - 4, y + 11, { align: 'right', width: amtX - totalsX + 8 });

    y += 55;

    // Payment Info
    doc.rect(50, y, 512, 32).fill('#F0FDF4');
    doc.fillColor('#16A34A')
       .fontSize(10)
       .font('Helvetica-Bold')
       .text(`Payment: ${bill.paymentMethod}  |  Status: ${bill.paymentStatus}`, 58, y + 10);

    // Notes
    if (bill.notes) {
      y += 45;
      doc.fillColor('#64748B')
         .fontSize(9)
         .font('Helvetica')
         .text(`Note: ${bill.notes}`, 50, y);
    }

    // Footer
    doc.rect(0, 780, 612, 61).fill('#4F46E5');
    doc.fillColor('white')
       .fontSize(10)
       .font('Helvetica')
       .text('Shukriya GrowMore Appliances choose karne ke liye!', 50, 800, { align: 'center', width: 512 });

    doc.end();

  } catch (err) {
    console.error('PDF error:', err);
    res.status(500).json({ message: 'PDF generate nahi hua', error: err.message });
  }
};

// @GET /api/bills/:id/whatsapp
const getWhatsappLink = async (req, res) => {
  try {
    const bill = await Bill.findById(req.params.id)
      .populate('customer', 'name phone');

    if (!bill) {
      return res.status(404).json({ message: 'Bill nahi mila' });
    }

    const partsText = bill.partsUsed && bill.partsUsed.length > 0
      ? bill.partsUsed.map(p => `  • ${p.partName} x${p.quantity} = Rs.${p.totalPrice}`).join('\n')
      : '  • Koi part nahi';

    const message =
`🔧 *GrowMore Appliances*
━━━━━━━━━━━━━━━━━━
📋 *Bill No:* ${bill.billNumber}
📅 *Date:* ${new Date(bill.createdAt).toLocaleDateString('en-IN')}
━━━━━━━━━━━━━━━━━━
👤 *Customer:* ${bill.customer.name}

📦 *Parts:*
${partsText}

🔧 *Service Charge:* Rs.${bill.serviceCharge}
${bill.gstAmount > 0 ? `📊 *GST (${bill.gstPercent}%):* Rs.${bill.gstAmount}\n` : ''}${bill.discount > 0 ? `🎁 *Discount:* -Rs.${bill.discount}\n` : ''}━━━━━━━━━━━━━━━━━━
💰 *Grand Total: Rs.${bill.grandTotal}*
💳 *Payment:* ${bill.paymentMethod} | ${bill.paymentStatus}
━━━━━━━━━━━━━━━━━━
Shukriya hamare saath jude rehne ke liye! 🙏`;

    const phone = bill.customer.phone.replace(/\D/g, '');
    const waLink = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;

    bill.whatsappSent = true;
    await bill.save();

    res.json({ success: true, waLink, message });

  } catch (err) {
    console.error('WhatsApp error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/bills/:id/payment
const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentStatus, paymentMethod } = req.body;

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      { paymentStatus, paymentMethod },
      { new: true }
    );

    if (!bill) {
      return res.status(404).json({ message: 'Bill nahi mila' });
    }

    res.json({ success: true, message: 'Payment update ho gaya', bill });

  } catch (err) {
    console.error('Payment update error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createBill,
  getAllBills,
  getBillById,
  downloadBillPDF,
  getWhatsappLink,
  updatePaymentStatus
};