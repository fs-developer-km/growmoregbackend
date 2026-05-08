const JobCard = require('../models/JobCard');
const Lead = require('../models/Lead');
const Part = require('../models/Part');

// @POST /api/jobs
const createJobCard = async (req, res) => {
  try {
    const {
      leadId, customerId, applianceType,
      serviceType, problemDescription, workDone,
      partsUsed, serviceCharge, remarks
    } = req.body;

    // Parts ka total calculate karo aur stock deduct karo
    let processedParts = [];
    if (partsUsed && partsUsed.length > 0) {
      for (let item of partsUsed) {
        const part = await Part.findById(item.partId);
        if (!part) continue;

        // Stock check
        if (part.stock < item.quantity) {
          return res.status(400).json({
            message: `${part.name} ka stock kam hai — sirf ${part.stock} bacha hai`
          });
        }

        // Stock deduct karo
        part.stock -= item.quantity;
        await part.save();

        processedParts.push({
          part: part._id,
          partName: part.name,
          quantity: item.quantity,
          salePrice: part.salePrice,
          totalPrice: part.salePrice * item.quantity
        });
      }
    }

    const jobCard = await JobCard.create({
      lead: leadId,
      engineer: req.user._id,
      customer: customerId,
      applianceType,
      serviceType,
      problemDescription,
      workDone,
      partsUsed: processedParts,
      serviceCharge: serviceCharge || 0,
      remarks,
      status: 'In Progress'
    });

    // Lead status update karo
    await Lead.findByIdAndUpdate(leadId, { status: 'In Progress' });

    const populated = await JobCard.findById(jobCard._id)
      .populate('customer', 'name phone address')
      .populate('engineer', 'name phone')
      .populate('partsUsed.part', 'name');

    res.status(201).json({ success: true, message: 'Job card ban gaya', jobCard: populated });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/jobs/:id
const getJobCard = async (req, res) => {
  try {
    const jobCard = await JobCard.findById(req.params.id)
      .populate('customer', 'name phone address')
      .populate('engineer', 'name phone')
      .populate('lead', 'applianceType serviceType status');

    if (!jobCard) {
      return res.status(404).json({ message: 'Job card nahi mila' });
    }

    res.json({ success: true, jobCard });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/jobs/:id
const updateJobCard = async (req, res) => {
  try {
    const jobCard = await JobCard.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('customer', 'name phone');

    if (!jobCard) {
      return res.status(404).json({ message: 'Job card nahi mila' });
    }

    res.json({ success: true, message: 'Job card update ho gaya', jobCard });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PATCH /api/jobs/:id/complete
const completeJob = async (req, res) => {
  try {
    const jobCard = await JobCard.findByIdAndUpdate(
      req.params.id,
      { status: 'Completed' },
      { new: true }
    );

    if (!jobCard) {
      return res.status(404).json({ message: 'Job card nahi mila' });
    }

    // Lead bhi complete karo
    await Lead.findByIdAndUpdate(jobCard.lead, {
      status: 'Completed',
      completedDate: new Date()
    });

    res.json({ success: true, message: 'Job complete ho gaya', jobCard });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { createJobCard, getJobCard, updateJobCard, completeJob };