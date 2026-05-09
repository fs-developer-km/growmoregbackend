const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

// ✅ App init (sabse pehle)
const app = express();

// ================== CORS ==================
app.use(cors({
  origin: [
    'https://growmorecrm.netlify.app',
    'http://localhost:4200'
  ],
  credentials: true
}));


// ================== Middleware ==================
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));



// ================== Models ==================
require('./src/models/User');
require('./src/models/Customer');
require('./src/models/Lead');
require('./src/models/Part');
require('./src/models/JobCard');
require('./src/models/Bill');

// ================== Routes ==================
const authRoutes = require('./src/routes/authRoutes');
const engineerRoutes = require('./src/routes/engineerRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const leadRoutes = require('./src/routes/leadRoutes');
const jobRoutes = require('./src/routes/jobRoutes');
const billRoutes = require('./src/routes/billRoutes');
const partRoutes = require('./src/routes/partRoutes');
const reportRoutes = require('./src/routes/reportRoutes');

// ✅ Routes use (import ke baad hi use karo)
app.use('/api/auth', authRoutes);
app.use('/api/engineers', engineerRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/bills', billRoutes);
app.use('/api/parts', partRoutes);


app.use('/api/reports', reportRoutes);

// ================== Test Route ==================
app.get('/', (req, res) => {
  res.json({ message: 'GrowMore Backend is running!' });
});

// ================== PORT ==================
const PORT = process.env.PORT || 5000;

// ================== MongoDB Connection ==================
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => console.log('❌ DB Error:', err));