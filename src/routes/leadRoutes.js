
const express = require('express');
const router = express.Router();
const {
  createLead, getAllLeads, getMyLeads,
  getLeadById, assignLead, updateLeadStatus
} = require('../controllers/leadController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, adminOnly, createLead);
router.get('/', protect, adminOnly, getAllLeads);
router.get('/mine', protect, getMyLeads);
router.get('/:id', protect, getLeadById);
router.patch('/:id/assign', protect, adminOnly, assignLead);
router.patch('/:id/status', protect, updateLeadStatus);

module.exports = router;