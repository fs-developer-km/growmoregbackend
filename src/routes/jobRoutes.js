const express = require('express');
const router = express.Router();
const { createJobCard, getJobCard, updateJobCard, completeJob } = require('../controllers/jobCardController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createJobCard);
router.get('/:id', protect, getJobCard);
router.put('/:id', protect, updateJobCard);
router.patch('/:id/complete', protect, completeJob);

module.exports = router;