const express = require('express');
const router = express.Router();
const {
  createContract, getAllContracts, getContractById,
  updateContract, renewContract, cancelContract,
  addVisit, addPayment, getExpiringContracts,
  getStats, generatePDF, getWhatsappLink, exportExcel
} = require('../controllers/amcController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/stats', protect, adminOnly, getStats);
router.get('/expiring', protect, adminOnly, getExpiringContracts);
router.get('/export', protect, adminOnly, exportExcel);

router.post('/contracts', protect, adminOnly, createContract);
router.get('/contracts', protect, getAllContracts);
router.get('/contracts/:id', protect, getContractById);
router.put('/contracts/:id', protect, adminOnly, updateContract);
router.patch('/contracts/:id/renew', protect, adminOnly, renewContract);
router.patch('/contracts/:id/cancel', protect, adminOnly, cancelContract);
router.post('/contracts/:id/visits', protect, addVisit);
router.post('/contracts/:id/payment', protect, adminOnly, addPayment);
router.get('/contracts/:id/pdf', protect, generatePDF);
router.get('/contracts/:id/whatsapp', protect, getWhatsappLink);

module.exports = router;