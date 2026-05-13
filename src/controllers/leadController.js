const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const User = require('../models/User');

const addTimeline = (lead, action, description, userId) => {
  lead.timeline.push({ action, description, doneBy: userId, doneAt: new Date() });
};

// @POST /api/leads
const createLead = async (req, res) => {
  try {
    const {
      customerPhone, customerName, customerAddress,
      applianceType, subProduct, subProduct2,
      serviceType, description, reference,
      customerType, scheduledDate, appointmentTime,
      estimateAmount, area, priority, source, tags
    } = req.body;

    let customer = await Customer.findOne({ phone: customerPhone });
    if (!customer) {
      customer = await Customer.create({
        name: customerName, phone: customerPhone,
        address: customerAddress, area
      });
    }

    // Auto detect repeat
    const existingLeads = await Lead.countDocuments({ customer: customer._id });
    const autoCustomerType = existingLeads > 0 ? 'Repeat' : 'Fresh';

    const lead = new Lead({
      customer: customer._id,
      applianceType, subProduct: subProduct || '',
      subProduct2: subProduct2 || '',
      serviceType, description: description || '',
      reference: reference || '',
      customerType: customerType || autoCustomerType,
      scheduledDate, appointmentTime: appointmentTime || '',
      estimateAmount: estimateAmount || 0,
      address: customerAddress || customer.address,
      area: area || customer.area,
      priority: priority || 'Medium',
      source: source || 'Phone Call',
      tags: tags || [],
      assignedBy: req.user._id,
      status: 'New'
    });

    addTimeline(lead, 'created', `Lead created by ${req.user.name}`, req.user._id);
    await lead.save();

    const populated = await Lead.findById(lead._id)
      .populate('customer', 'name phone address area')
      .populate('assignedBy', 'name');

    res.status(201).json({ success: true, message: 'Lead created successfully', lead: populated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads
const getAllLeads = async (req, res) => {
  try {
    const {
      status, assignedTo, search, applianceType,
      serviceType, source, priority, customerType,
      area, isPinned, startDate, endDate,
      page = 1, limit = 100,
      sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    let query = {};
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
    if (applianceType) query.applianceType = applianceType;
    if (serviceType) query.serviceType = serviceType;
    if (source) query.source = source;
    if (priority) query.priority = priority;
    if (customerType) query.customerType = customerType;
    if (area) query.area = { $regex: area, $options: 'i' };
    if (isPinned === 'true') query.isPinned = true;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      const customers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      query.$or = [
        { customer: { $in: customers.map(c => c._id) } },
        { description: { $regex: search, $options: 'i' } },
        { area: { $regex: search, $options: 'i' } },
        { reference: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    if (sortBy !== 'isPinned') sort.isPinned = -1;

    const total = await Lead.countDocuments(query);
    const leads = await Lead.find(query)
      .populate('customer', 'name phone address area')
      .populate('assignedTo', 'name phone')
      .populate('assignedBy', 'name')
      .sort(sort)
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const counts = await Lead.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statusCounts = {};
    counts.forEach(c => { statusCounts[c._id] = c.count; });

    res.json({ success: true, total, page: Number(page), leads, statusCounts });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/search
const searchLeads = async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ success: true, leads: [], customer: null });

    const customers = await Customer.find({
      $or: [
        { phone: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } },
        { address: { $regex: q, $options: 'i' } }
      ]
    });

    let customerMatch = null;
    if (customers.length > 0) {
      const c = customers[0];
      const leadCount = await Lead.countDocuments({ customer: c._id });
      const completedCount = await Lead.countDocuments({ customer: c._id, status: 'Completed' });
      const bills = await require('../models/Bill').find({ customer: c._id });
      const totalPaid = bills.reduce((s, b) => s + (b.finalAmountReceived || b.grandTotal || 0), 0);
      customerMatch = { ...c.toObject(), leadCount, completedCount, totalPaid, isExisting: leadCount > 0 };
    }

    const leads = await Lead.find({ customer: { $in: customers.map(c => c._id) } })
      .populate('customer', 'name phone address')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, leads, customer: customerMatch });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/stats
const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [total, todayCount, fresh, repeat, newL, scheduled,
           assigned, inProgress, completed, cancelled, pending,
           unattended, highPriority] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ createdAt: { $gte: today } }),
      Lead.countDocuments({ customerType: 'Fresh' }),
      Lead.countDocuments({ customerType: 'Repeat' }),
      Lead.countDocuments({ status: 'New' }),
      Lead.countDocuments({ status: 'Scheduled' }),
      Lead.countDocuments({ status: 'Assigned' }),
      Lead.countDocuments({ status: 'In Progress' }),
      Lead.countDocuments({ status: 'Completed' }),
      Lead.countDocuments({ status: 'Cancelled' }),
      Lead.countDocuments({ status: 'Pending' }),
      Lead.countDocuments({
        status: { $in: ['New', 'Assigned', 'Pending'] },
        createdAt: { $lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
      }),
      Lead.countDocuments({ priority: 'High', status: { $nin: ['Completed', 'Cancelled'] } })
    ]);

    res.json({
      success: true,
      stats: {
        total, todayCount, fresh, repeat,
        new: newL, scheduled, assigned, inProgress,
        completed, cancelled, pending,
        unattended, highPriority
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/:id
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('customer', 'name phone address area alternatePhone')
      .populate('assignedTo', 'name phone')
      .populate('assignedBy', 'name')
      .populate('notes.addedBy', 'name')
      .populate('timeline.doneBy', 'name')
      .populate('happyCall.calledBy', 'name');

    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ success: true, lead });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/mine
const getMyLeads = async (req, res) => {
  try {
    const leads = await Lead.find({
      assignedTo: req.user._id,
      status: { $in: ['Assigned', 'Scheduled', 'In Progress', 'Pending'] }
    })
      .populate('customer', 'name phone address')
      .sort({ scheduledDate: 1 });

    res.json({ success: true, count: leads.length, leads });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/leads/:id
const updateLead = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const fields = [
      'applianceType', 'subProduct', 'subProduct2',
      'serviceType', 'description', 'reference',
      'customerType', 'scheduledDate', 'appointmentTime',
      'estimateAmount', 'address', 'area', 'priority',
      'source', 'tags', 'remarks', 'isPinned',
      'workRemark', 'totalAmount', 'partsLpCost',
      'finalAmount', 'companyShare', 'engineerShare'
    ];

    fields.forEach(f => { if (req.body[f] !== undefined) lead[f] = req.body[f]; });

    addTimeline(lead, 'updated', `Lead updated by ${req.user.name}`, req.user._id);
    await lead.save();

    const updated = await Lead.findById(lead._id)
      .populate('customer', 'name phone address')
      .populate('assignedTo', 'name phone');

    res.json({ success: true, message: 'Lead updated', lead: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/assign
const assignLead = async (req, res) => {
  try {
    const { engineerId } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const engineer = await User.findById(engineerId);
    lead.assignedTo = engineerId;
    lead.status = 'Assigned';
    lead.assignedBy = req.user._id;
    addTimeline(lead, 'assigned', `Assigned to ${engineer?.name} by ${req.user.name}`, req.user._id);
    await lead.save();

    const updated = await Lead.findById(lead._id)
      .populate('customer', 'name phone')
      .populate('assignedTo', 'name phone');

    res.json({ success: true, message: 'Lead assigned', lead: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/status
const updateStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const oldStatus = lead.status;
    lead.status = status;
    if (remarks) lead.remarks = remarks;
    if (status === 'Completed') {
      lead.completedDate = new Date();
      lead.callCloseDate = new Date();
    }
    addTimeline(lead, 'status_changed',
      `Status: ${oldStatus} → ${status}${remarks ? ' — ' + remarks : ''}`,
      req.user._id);
    await lead.save();

    res.json({ success: true, message: 'Status updated', lead });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/happy-call
const updateHappyCall = async (req, res) => {
  try {
    const { called, satisfied, remarks, followUpRequired } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.happyCall = {
      called: called || false,
      calledAt: called ? new Date() : null,
      calledBy: called ? req.user._id : null,
      satisfied,
      remarks,
      followUpRequired: followUpRequired || false
    };
    addTimeline(lead, 'happy_call', `Happy call recorded by ${req.user.name}`, req.user._id);
    await lead.save();

    res.json({ success: true, message: 'Happy call updated', happyCall: lead.happyCall });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/financials
const updateFinancials = async (req, res) => {
  try {
    const { totalAmount, partsLpCost, finalAmount, companyShare, engineerShare, workRemark } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    if (totalAmount !== undefined) lead.totalAmount = totalAmount;
    if (partsLpCost !== undefined) lead.partsLpCost = partsLpCost;
    if (finalAmount !== undefined) lead.finalAmount = finalAmount;
    if (companyShare !== undefined) lead.companyShare = companyShare;
    if (engineerShare !== undefined) lead.engineerShare = engineerShare;
    if (workRemark !== undefined) lead.workRemark = workRemark;

    await lead.save();
    res.json({ success: true, message: 'Financials updated', lead });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/leads/bulk-assign
const bulkAssign = async (req, res) => {
  try {
    const { leadIds, engineerId } = req.body;
    const engineer = await User.findById(engineerId);
    await Lead.updateMany(
      { _id: { $in: leadIds } },
      { assignedTo: engineerId, status: 'Assigned', assignedBy: req.user._id }
    );
    res.json({ success: true, message: `${leadIds.length} leads assigned to ${engineer?.name}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/leads/bulk-status
const bulkStatus = async (req, res) => {
  try {
    const { leadIds, status } = req.body;
    await Lead.updateMany({ _id: { $in: leadIds } }, { status });
    res.json({ success: true, message: `${leadIds.length} leads status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/leads/:id/notes
const addNote = async (req, res) => {
  try {
    const { text } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    lead.notes.push({ text, addedBy: req.user._id });
    addTimeline(lead, 'note_added', `Note added by ${req.user.name}`, req.user._id);
    await lead.save();

    const updated = await Lead.findById(lead._id).populate('notes.addedBy', 'name');
    res.json({ success: true, notes: updated.notes });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/pin
const togglePin = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    lead.isPinned = !lead.isPinned;
    await lead.save();
    res.json({ success: true, isPinned: lead.isPinned });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/export/excel
const exportExcel = async (req, res) => {
  try {
    const { ids, status, startDate, endDate } = req.query;
    let query = {};
    if (ids) query._id = { $in: ids.split(',') };
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) { const e = new Date(endDate); e.setHours(23,59,59); query.createdAt.$lte = e; }
    }

    const leads = await Lead.find(query)
      .populate('customer', 'name phone address area alternatePhone')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 });

    let csv = '\uFEFF';
    csv += 'Registered Date,Cust Name,Ph No.,Alternate No.,Reference,Address,Area,Product,Sub Product,Sub Product 2,Repeat/Fresh,Type of Work,Problem,Engineer,App Date,App Time,Estimate,Call Close Date,Status,Remark,Total Amount,Part LP Cost,Final Amount,Company Share,Eng Share\n';

    leads.forEach(l => {
      csv += [
        new Date(l.createdAt).toLocaleDateString('en-IN'),
        `"${l.customer?.name || ''}"`,
        l.customer?.phone || '',
        l.customer?.alternatePhone || '',
        `"${l.reference || ''}"`,
        `"${l.address || l.customer?.address || ''}"`,
        l.area || l.customer?.area || '',
        l.applianceType || '',
        l.subProduct || '',
        l.subProduct2 || '',
        l.customerType || 'Fresh',
        l.serviceType || '',
        `"${l.description || ''}"`,
        `"${l.assignedTo?.name || 'Unassigned'}"`,
        l.scheduledDate ? new Date(l.scheduledDate).toLocaleDateString('en-IN') : '',
        l.appointmentTime || '',
        l.estimateAmount || 0,
        l.callCloseDate ? new Date(l.callCloseDate).toLocaleDateString('en-IN') : '',
        l.status || '',
        `"${l.workRemark || l.remarks || ''}"`,
        l.totalAmount || 0,
        l.partsLpCost || 0,
        l.finalAmount || 0,
        l.companyShare || 0,
        l.engineerShare || 0
      ].join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=leads-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createLead, getAllLeads, searchLeads, getStats,
  getLeadById, getMyLeads, updateLead,
  assignLead, updateStatus, updateHappyCall, updateFinancials,
  bulkAssign, bulkStatus, addNote, togglePin, exportExcel
};