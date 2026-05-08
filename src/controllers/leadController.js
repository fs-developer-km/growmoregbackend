const Lead = require('../models/Lead');
const Customer = require('../models/Customer');

// @POST /api/leads
const createLead = async (req, res) => {
  try {
    const {
      customerPhone, customerName, customerAddress,
      applianceType, serviceType, description,
      scheduledDate, area
    } = req.body;

    // Customer dhundo ya naya banao
    let customer = await Customer.findOne({ phone: customerPhone });
    if (!customer) {
      customer = await Customer.create({
        name: customerName,
        phone: customerPhone,
        address: customerAddress,
        area
      });
    }

    const lead = await Lead.create({
      customer: customer._id,
      applianceType,
      serviceType,
      description,
      scheduledDate,
      address: customerAddress || customer.address,
      assignedBy: req.user._id
    });

    const populatedLead = await Lead.findById(lead._id)
      .populate('customer', 'name phone address')
      .populate('assignedBy', 'name');

    res.status(201).json({ success: true, message: 'Lead create ho gayi', lead: populatedLead });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads
const getAllLeads = async (req, res) => {
  try {
    const { status, assignedTo, search, page = 1, limit = 20 } = req.query;

    let query = {};
    if (status) query.status = status;
    if (assignedTo) query.assignedTo = assignedTo;

    const leads = await Lead.find(query)
      .populate('customer', 'name phone address')
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Lead.countDocuments(query);

    res.json({ success: true, total, page, leads });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/leads/mine — Engineer ke apne leads
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

// @GET /api/leads/:id
const getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('customer', 'name phone address area')
      .populate('assignedTo', 'name phone')
      .populate('assignedBy', 'name');

    if (!lead) {
      return res.status(404).json({ message: 'Lead nahi mili' });
    }

    res.json({ success: true, lead });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/assign
const assignLead = async (req, res) => {
  try {
    const { engineerId } = req.body;

    const lead = await Lead.findByIdAndUpdate(
      req.params.id,
      {
        assignedTo: engineerId,
        status: 'Assigned',
        assignedBy: req.user._id
      },
      { new: true }
    )
      .populate('customer', 'name phone')
      .populate('assignedTo', 'name phone');

    if (!lead) {
      return res.status(404).json({ message: 'Lead nahi mili' });
    }

    res.json({ success: true, message: 'Lead assign ho gayi', lead });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/leads/:id/status
const updateLeadStatus = async (req, res) => {
  try {
    const { status, remarks } = req.body;

    const lead = await Lead.findById(req.params.id);
    if (!lead) {
      return res.status(404).json({ message: 'Lead nahi mili' });
    }

    lead.status = status;
    if (remarks) lead.remarks = remarks;
    if (status === 'Completed') lead.completedDate = new Date();

    await lead.save();

    res.json({ success: true, message: 'Status update ho gaya', lead });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { createLead, getAllLeads, getMyLeads, getLeadById, assignLead, updateLeadStatus };