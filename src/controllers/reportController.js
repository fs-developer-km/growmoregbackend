const Lead = require('../models/Lead');
const Bill = require('../models/Bill');
const User = require('../models/User');
const JobCard = require('../models/JobCard');

// @GET /api/reports/overview
const getOverview = async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const now = new Date();
    let startDate;

    if (period === 'today') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'week') {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // Total leads
    const totalLeads = await Lead.countDocuments({ createdAt: { $gte: startDate } });
    const completedLeads = await Lead.countDocuments({ status: 'Completed', createdAt: { $gte: startDate } });
    const pendingLeads = await Lead.countDocuments({ status: { $in: ['New', 'Assigned', 'In Progress'] }, createdAt: { $gte: startDate } });
    const cancelledLeads = await Lead.countDocuments({ status: 'Cancelled', createdAt: { $gte: startDate } });

    // Revenue
    const bills = await Bill.find({ createdAt: { $gte: startDate } });
    const totalRevenue = bills.reduce((sum, b) => sum + b.grandTotal, 0);
    const paidRevenue = bills.filter(b => b.paymentStatus === 'Paid').reduce((sum, b) => sum + b.grandTotal, 0);
    const pendingRevenue = bills.filter(b => b.paymentStatus === 'Pending').reduce((sum, b) => sum + b.grandTotal, 0);
    const totalBills = bills.length;

    // Engineers
    const totalEngineers = await User.countDocuments({ role: 'engineer', isActive: true });

    res.json({
      success: true,
      data: {
        totalLeads, completedLeads, pendingLeads, cancelledLeads,
        totalRevenue, paidRevenue, pendingRevenue,
        totalBills, totalEngineers,
        completionRate: totalLeads > 0 ? Math.round((completedLeads / totalLeads) * 100) : 0
      }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/reports/revenue-chart
const getRevenueChart = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();

    let groupBy, startDate, dateFormat;

    if (period === 'week') {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      groupBy = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
    } else if (period === 'year') {
      startDate = new Date(now.getFullYear(), 0, 1);
      groupBy = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
    }

    const revenueData = await Bill.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: '$grandTotal' },
          bills: { $sum: 1 },
          paid: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$grandTotal', 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    const leadsData = await Lead.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({ success: true, revenueData, leadsData });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/reports/engineer-performance
const getEngineerPerformance = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'week') startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);

    const performance = await Lead.aggregate([
      { $match: { assignedTo: { $ne: null }, createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$assignedTo',
          totalLeads: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'In Progress'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'Cancelled'] }, 1, 0] } }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'engineer'
        }
      },
      { $unwind: '$engineer' },
      {
        $project: {
          name: '$engineer.name',
          phone: '$engineer.phone',
          totalLeads: 1,
          completed: 1,
          inProgress: 1,
          cancelled: 1,
          completionRate: {
            $round: [{ $multiply: [{ $divide: ['$completed', { $max: ['$totalLeads', 1] }] }, 100] }, 0]
          }
        }
      },
      { $sort: { completed: -1 } }
    ]);

    res.json({ success: true, performance });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/reports/service-breakdown
const getServiceBreakdown = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'week') startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);

    const byAppliance = await Lead.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$applianceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byService = await Lead.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      { $group: { _id: '$serviceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const byPayment = await Bill.aggregate([
      { $match: { createdAt: { $gte: startDate } } },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          amount: { $sum: '$grandTotal' }
        }
      }
    ]);

    res.json({ success: true, byAppliance, byService, byPayment });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/reports/export
const exportReport = async (req, res) => {
  try {
    const { type = 'leads', period = 'month' } = req.query;
    const now = new Date();
    let startDate;

    if (period === 'week') startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    else if (period === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    else if (period === 'year') startDate = new Date(now.getFullYear(), 0, 1);
    else startDate = new Date(0);

    let csvData = '';
    let filename = '';

    if (type === 'leads') {
      const leads = await Lead.find({ createdAt: { $gte: startDate } })
        .populate('customer', 'name phone address')
        .populate('assignedTo', 'name')
        .sort({ createdAt: -1 });

      filename = `leads-report-${period}.csv`;
      csvData = 'Lead ID,Customer Name,Phone,Address,Appliance,Service,Status,Engineer,Date\n';
      leads.forEach(l => {
        csvData += `${l._id},${l.customer?.name || ''},${l.customer?.phone || ''},${l.address || ''},${l.applianceType},${l.serviceType},${l.status},${l.assignedTo?.name || 'Unassigned'},${new Date(l.createdAt).toLocaleDateString('en-IN')}\n`;
      });
    } else if (type === 'bills') {
      const bills = await Bill.find({ createdAt: { $gte: startDate } })
        .populate('customer', 'name phone')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 });

      filename = `bills-report-${period}.csv`;
      csvData = 'Bill No,Customer,Phone,Subtotal,GST,Discount,Grand Total,Payment Method,Payment Status,Date\n';
      bills.forEach(b => {
        csvData += `${b.billNumber},${b.customer?.name || ''},${b.customer?.phone || ''},${b.subtotal},${b.gstAmount},${b.discount},${b.grandTotal},${b.paymentMethod},${b.paymentStatus},${new Date(b.createdAt).toLocaleDateString('en-IN')}\n`;
      });
    } else if (type === 'engineers') {
      const engineers = await User.find({ role: 'engineer' });
      const leadsData = await Lead.aggregate([
        { $match: { assignedTo: { $ne: null }, createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: '$assignedTo',
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] } }
          }
        }
      ]);

      filename = `engineer-report-${period}.csv`;
      csvData = 'Engineer Name,Phone,Total Leads,Completed,Completion Rate\n';
      engineers.forEach(eng => {
        const ld = leadsData.find(l => l._id.toString() === eng._id.toString());
        const total = ld?.total || 0;
        const completed = ld?.completed || 0;
        const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
        csvData += `${eng.name},${eng.phone},${total},${completed},${rate}%\n`;
      });
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
    res.send(csvData);

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = { getOverview, getRevenueChart, getEngineerPerformance, getServiceBreakdown, exportReport };