const Lead = require('../models/Lead');
const Customer = require('../models/Customer');
const User = require('../models/User');

// Helper — timeline entry add karo
const addTimeline = (lead, action, description, userId) => {
  lead.timeline.push({
    action,
    description,
    doneBy: userId,
    doneAt: new Date()
  });
};

// @POST /api/leads — Create lead
const createLead = async (req, res) => {
  try {
    const {
      customerPhone, customerName, customerAddress,
      applianceType, serviceType, description,
      scheduledDate, area, priority, source, tags
    } = req.body;

    let customer = await Customer.findOne({ phone: customerPhone });
    if (!customer) {
      customer = await Customer.create({
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        area
      });
    }

    const lead = new Lead({
      customer: customer._id,
      applianceType,
      serviceType,
      description,
      scheduledDate,
      address: customerAddress || customer.address,
      area: area || customer.area,
      priority: priority || 'Medium',
      source: source || 'Phone Call',
      tags: tags || [],
      assignedBy: req.user._id
    });

    addTimeline(lead, 'created', `Lead created by ${req.user.name}`, req.user._id);
    await lead.save();

    const populated = await Lead.findById(lead._id)
      .populate('customer', 'name phone address area')
      .populate('assignedBy', 'name');

    res.status(201).json({ success: true, message: 'Lead create ho gayi', lead: populated });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads — All leads with advanced filters
const getAllLeads = async (req, res) => {
  try {
    const {
      status, assignedTo, search,
      applianceType, serviceType, source,
      priority, area, isPinned,
      startDate, endDate,
      page = 1, limit = 50,
      sortBy = 'createdAt', sortOrder = 'desc'
    } = req.query;

    let query = {};

    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
    if (applianceType) query.applianceType = applianceType;
    if (serviceType) query.serviceType = serviceType;
    if (source) query.source = source;
    if (priority) query.priority = priority;
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

      const customerIds = customers.map(c => c._id);
      query.$or = [
        { customer: { $in: customerIds } },
        { description: { $regex: search, $options: 'i' } },
        { area: { $regex: search, $options: 'i' } }
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

    // Status counts
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

// @GET /api/leads/search — Smart search
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
      const totalPaid = bills.filter(b => b.paymentStatus === 'Paid').reduce((s, b) => s + b.grandTotal, 0);

      customerMatch = {
        ...c.toObject(),
        leadCount,
        completedCount,
        totalPaid,
        isExisting: true
      };
    }

    const leads = await Lead.find({
      customer: { $in: customers.map(c => c._id) }
    })
      .populate('customer', 'name phone address')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.json({ success: true, leads, customer: customerMatch });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/stats — Quick stats
const getStats = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalLeads, todayLeads, newLeads,
      assignedLeads, inProgressLeads,
      completedLeads, cancelledLeads,
      unattendedLeads, highPriority
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ createdAt: { $gte: today } }),
      Lead.countDocuments({ status: 'New' }),
      Lead.countDocuments({ status: 'Assigned' }),
      Lead.countDocuments({ status: 'In Progress' }),
      Lead.countDocuments({ status: 'Completed' }),
      Lead.countDocuments({ status: 'Cancelled' }),
      Lead.countDocuments({
        status: { $in: ['New', 'Assigned'] },
        createdAt: { $lte: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
      }),
      Lead.countDocuments({ priority: 'High', status: { $ne: 'Completed' } })
    ]);

    res.json({
      success: true,
      stats: {
        totalLeads, todayLeads, newLeads,
        assignedLeads, inProgressLeads,
        completedLeads, cancelledLeads,
        unattendedLeads, highPriority
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
      .populate('customer', 'name phone address area')
      .populate('assignedTo', 'name phone')
      .populate('assignedBy', 'name')
      .populate('notes.addedBy', 'name')
      .populate('timeline.doneBy', 'name');

    if (!lead) return res.status(404).json({ message: 'Lead nahi mili' });
    res.json({ success: true, lead });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/mine — Engineer ke leads
const getMyLeads = async (req, res) => {
  try {
    const leads = await Lead.find({
      assignedTo: req.user._id,
      status: { $in: ['Assigned', 'In Progress'] }
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
    if (!lead) return res.status(404).json({ message: 'Lead nahi mili' });

    const updatableFields = [
      'applianceType', 'serviceType', 'description',
      'scheduledDate', 'followUpDate', 'address',
      'area', 'priority', 'source', 'tags',
      'remarks', 'isPinned'
    ];

    updatableFields.forEach(field => {
      if (req.body[field] !== undefined) lead[field] = req.body[field];
    });

    addTimeline(lead, 'updated', `Lead updated by ${req.user.name}`, req.user._id);
    await lead.save();

    const updated = await Lead.findById(lead._id)
      .populate('customer', 'name phone address')
      .populate('assignedTo', 'name phone');

    res.json({ success: true, message: 'Lead update ho gayi', lead: updated });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/assign
const assignLead = async (req, res) => {
  try {
    const { engineerId } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead nahi mili' });

    const engineer = await User.findById(engineerId);

    lead.assignedTo = engineerId;
    lead.status = 'Assigned';
    lead.assignedBy = req.user._id;

    addTimeline(lead, 'assigned',
      `Assigned to ${engineer?.name} by ${req.user.name}`,
      req.user._id
    );

    await lead.save();

    const updated = await Lead.findById(lead._id)
      .populate('customer', 'name phone')
      .populate('assignedTo', 'name phone');

    res.json({ success: true, message: 'Lead assign ho gayi', lead: updated });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/status
const updateStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead nahi mili' });

    const oldStatus = lead.status;
    lead.status = status;
    if (remarks) lead.remarks = remarks;
    if (status === 'Completed') lead.completedDate = new Date();

    addTimeline(lead, 'status_changed',
      `Status changed from ${oldStatus} to ${status} by ${req.user.name}${remarks ? ' — ' + remarks : ''}`,
      req.user._id
    );

    await lead.save();
    res.json({ success: true, message: 'Status update ho gaya', lead });

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
      {
        assignedTo: engineerId,
        status: 'Assigned',
        assignedBy: req.user._id
      }
    );

    res.json({
      success: true,
      message: `${leadIds.length} leads ${engineer?.name} ko assign ho gayi`
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/leads/bulk-status
const bulkStatus = async (req, res) => {
  try {
    const { leadIds, status } = req.body;

    await Lead.updateMany(
      { _id: { $in: leadIds } },
      { status }
    );

    res.json({
      success: true,
      message: `${leadIds.length} leads ka status ${status} ho gaya`
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @POST /api/leads/:id/notes
const addNote = async (req, res) => {
  try {
    const { text } = req.body;
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead nahi mili' });

    lead.notes.push({ text, addedBy: req.user._id });
    addTimeline(lead, 'note_added', `Note added by ${req.user.name}`, req.user._id);
    await lead.save();

    const updated = await Lead.findById(lead._id)
      .populate('notes.addedBy', 'name');

    res.json({ success: true, message: 'Note add ho gaya', notes: updated.notes });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/pin
const togglePin = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead nahi mili' });

    lead.isPinned = !lead.isPinned;
    await lead.save();

    res.json({
      success: true,
      message: lead.isPinned ? 'Lead pin ho gayi' : 'Lead unpin ho gayi',
      isPinned: lead.isPinned
    });

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
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59);
        query.createdAt.$lte = end;
      }
    }

    const leads = await Lead.find(query)
      .populate('customer', 'name phone address area')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 });

    let csv = '\uFEFF'; // BOM for Excel
    csv += 'Lead ID,Customer Name,Phone,Address,Area,Appliance,Service,Status,Priority,Source,Engineer,Scheduled Date,Created Date,Amount Paid\n';

    for (const lead of leads) {
      const Bill = require('../models/Bill');
      const bills = await Bill.find({ lead: lead._id, paymentStatus: 'Paid' });
      const paid = bills.reduce((s, b) => s + b.grandTotal, 0);

      csv += [
        lead._id,
        `"${lead.customer?.name || ''}"`,
        lead.customer?.phone || '',
        `"${lead.address || lead.customer?.address || ''}"`,
        lead.area || lead.customer?.area || '',
        lead.applianceType,
        lead.serviceType,
        lead.status,
        lead.priority,
        lead.source || '',
        `"${lead.assignedTo?.name || 'Unassigned'}"`,
        lead.scheduledDate ? new Date(lead.scheduledDate).toLocaleDateString('en-IN') : '',
        new Date(lead.createdAt).toLocaleDateString('en-IN'),
        paid > 0 ? `Rs.${paid}` : ''
      ].join(',') + '\n';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=leads-export-${Date.now()}.csv`);
    res.send(csv);

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  createLead, getAllLeads, searchLeads, getStats,
  getLeadById, getMyLeads, updateLead,
  assignLead, updateStatus,
  bulkAssign, bulkStatus,
  addNote, togglePin, exportExcel
};