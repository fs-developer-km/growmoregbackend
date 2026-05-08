const express = require('express');
const router = express.Router();
const { getAllParts, addPart, updatePart } = require('../controllers/partController');
const { protect, adminOnly } = require('../middleware/auth');

router.get('/', protect, getAllParts);
router.post('/', protect, adminOnly, addPart);
router.put('/:id', protect, adminOnly, updatePart);

module.exports = router;