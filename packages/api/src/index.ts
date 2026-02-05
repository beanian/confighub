import express from 'express';
import cors from 'cors';
import path from 'path';
import { initializeDatabase } from './db';
import { initializeRepo } from './services/git';
import { authMiddleware } from './middleware/auth';
import configRoutes from './routes/config';
import authRoutes from './routes/auth';
import changesRoutes from './routes/changes';
import promotionsRoutes from './routes/promotions';
import auditRoutes from './routes/audit';
import driftRoutes from './routes/drift';

const app = express();
const PORT = process.env.PORT || 4000;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(authMiddleware); // Parse JWT tokens and set userId/userRole on request

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/config', configRoutes);
app.use('/api/changes', changesRoutes);
app.use('/api/promotions', promotionsRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/drift', driftRoutes);

// Serve static UI in production
if (isProduction) {
  const publicPath = path.join(__dirname, '..', 'public');
  app.use(express.static(publicPath));

  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(publicPath, 'index.html'));
    }
  });
}

// Initialize and start
async function start() {
  try {
    // Initialize database
    initializeDatabase();
    console.log('Database initialized');

    // Initialize git repo
    await initializeRepo();
    console.log('Git repository ready');

    app.listen(PORT, () => {
      console.log(`ConfigHub API running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
