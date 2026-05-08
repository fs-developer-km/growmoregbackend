const express = require('express');
const router = express.Router();
const { addCustomer, getAllCustomers, getCustomerById, updateCustomer } = require('../controllers/customerController');
const { protect, adminOnly } = require('../middleware/auth');

router.post('/', protect, adminOnly, addCustomer);
router.get('/', protect, adminOnly, getAllCustomers);
router.get('/:id', protect, adminOnly, getCustomerById);
router.put('/:id', protect, adminOnly, updateCustomer);

module.exports = router;