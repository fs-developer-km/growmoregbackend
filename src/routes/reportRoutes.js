const express = require('express');
const router = express.Router();
const {
  getOverview,
  getRevenueChart,
  getEngineerPerformance,
  getServiceBreakdown,
  exportReport
} = require('../controllers/reportController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/overview', protect, adminOnly, getOverview);
router.get('/revenue-chart', protect, adminOnly, getRevenueChart);
router.get('/engineer-performance', protect, adminOnly, getEngineerPerformance);
router.get('/service-breakdown', protect, adminOnly, getServiceBreakdown);
router.get('/export', protect, adminOnly, exportReport);

module.exports = router;