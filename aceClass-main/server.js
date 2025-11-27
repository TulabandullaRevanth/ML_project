import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Import API routes (without auth)
import uploadRoutes from './backend/api/upload.js';
import gradingRoutes from './backend/api/grading.js';
import dashboardRoutes from './backend/api/dashboard.js';
import configRoutes from './backend/api/config.js';
import debugRoutes from './backend/api/debug.js';
import studentsRoutes from './backend/api/students.js';
import classesRoutes from './backend/api/classes.js';
import analyticsRoutes from './backend/api/analytics.js';
import testApisRoutes from './backend/api/test-apis.js';

// Load environment variables
dotenv.config();
console.log('Loaded MONGODB_URI:', (process.env.MONGODB_URI || '').slice(0, 80) + '...');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.openai.com", "https://vision.googleapis.com", "https://cdn.jsdelivr.net"]
    }
  }
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/grading', gradingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/config', configRoutes);
app.use('/api/debug', debugRoutes);
app.use('/api/students', studentsRoutes);
app.use('/api/classes', classesRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/test-apis', testApisRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Serve frontend for all non-API routes (SPA routing)
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 aceclass server running on port ${PORT}`);
  console.log(`📱 Frontend: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api`);
});

export default app;

// Optional DB test route
import { getDb } from './backend/services/database.js';

app.get('/api/test-db', async (req, res) => {
  try {
    const db = await getDb();
    res.json({ status: 'DB connected', dbState: db ? 'OK' : 'Not connected' });
  } catch (err) {
    res.status(500).json({ status: 'DB connection failed', error: err.message });
  }
});