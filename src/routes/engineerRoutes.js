const express = require('express');
const router = express.Router();
const {
  addEngineer,
  getAllEngineers,
  getEngineerById,
  updateEngineer,
  deactivateEngineer
} = require('../controllers/engineerController');
const { protect, adminOnly } = require('../middleware/auth');

// Saare routes protected hain — sirf admin
router.post('/', protect, adminOnly, addEngineer);
router.get('/', protect, adminOnly, getAllEngineers);
router.get('/:id', protect, adminOnly, getEngineerById);
router.put('/:id', protect, adminOnly, updateEngineer);
router.delete('/:id', protect, adminOnly, deactivateEngineer);

module.exports = router;