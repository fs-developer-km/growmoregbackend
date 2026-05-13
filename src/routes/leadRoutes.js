const express = require('express');
const router = express.Router();
const {
  createLead, getAllLeads, searchLeads, getStats,
  getLeadById, getMyLeads, updateLead,
  assignLead, updateStatus, updateHappyCall, updateFinancials,
  bulkAssign, bulkStatus, addNote, togglePin, exportExcel
} = require('../controllers/leadController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/search', protect, searchLeads);
router.get('/stats', protect, adminOnly, getStats);
router.get('/mine', protect, getMyLeads);
router.get('/export/excel', protect, adminOnly, exportExcel);
router.post('/bulk-assign', protect, adminOnly, bulkAssign);
router.post('/bulk-status', protect, adminOnly, bulkStatus);

router.post('/', protect, adminOnly, createLead);
router.get('/', protect, adminOnly, getAllLeads);
router.get('/:id', protect, getLeadById);
router.put('/:id', protect, adminOnly, updateLead);
router.patch('/:id/assign', protect, adminOnly, assignLead);
router.patch('/:id/status', protect, updateStatus);
router.patch('/:id/happy-call', protect, updateHappyCall);
router.patch('/:id/financials', protect, adminOnly, updateFinancials);
router.post('/:id/notes', protect, addNote);
router.patch('/:id/pin', protect, adminOnly, togglePin);

module.exports = router;