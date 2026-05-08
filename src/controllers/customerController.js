const Customer = require('../models/Customer');
const Lead = require('../models/Lead');

// @POST /api/customers
const addCustomer = async (req, res) => {
  try {
    const { name, phone, alternatePhone, address, area, city, notes } = req.body;

    const existing = await Customer.findOne({ phone });
    if (existing) {
      return res.status(400).json({ message: 'Yeh phone number already registered hai' });
    }

    const customer = await Customer.create({
      name, phone, alternatePhone, address, area, city, notes
    });

    res.status(201).json({ success: true, message: 'Customer add ho gaya', customer });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/customers
const getAllCustomers = async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;

    let query = {};
    if (search) {
      query = {
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Customer.countDocuments(query);

    res.json({ success: true, total, page, customers });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/customers/:id
const getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer nahi mila' });
    }

    // Customer ki poori lead history
    const leads = await Lead.find({ customer: req.params.id })
      .populate('assignedTo', 'name phone')
      .sort({ createdAt: -1 });

    res.json({ success: true, customer, leads });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/customers/:id
const updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!customer) {
      return res.status(404).json({ message: 'Customer nahi mila' });
    }

    res.json({ success: true, message: 'Customer update ho gaya', customer });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { addCustomer, getAllCustomers, getCustomerById, updateCustomer };