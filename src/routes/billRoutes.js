const express = require('express');
const router = express.Router();
const {
  createBill, getAllBills, getBillById,
  downloadBillPDF, getWhatsappLink, updatePaymentStatus
} = require('../controllers/billController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, createBill);
router.get('/', protect, adminOnly, getAllBills);
router.get('/:id', protect, getBillById);
router.get('/:id/pdf', protect, downloadBillPDF);
router.get('/:id/whatsapp', protect, getWhatsappLink);
router.patch('/:id/payment', protect, adminOnly, updatePaymentStatus);

module.exports = router;