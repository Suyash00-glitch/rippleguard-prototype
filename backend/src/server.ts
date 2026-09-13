import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { projectsRouter } from './api/projects.js';
import { analysesRouter } from './api/analyses.js';
import { githubRouter } from './api/github.js';
import { demoRouter } from './api/demo.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-github-event'],
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'RippleGuard Security Gate & Risk Engine',
    timestamp: new Date().toISOString(),
    version: '1.0.0-prototype',
  });
});

// Mount modular API routes
app.use('/api/projects', projectsRouter);
app.use('/api/analyses', analysesRouter);
app.use('/api/github', githubRouter);
app.use('/api/demo', demoRouter);

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
});

app.listen(PORT, () => {
  console.log(`🛡️  RippleGuard Backend running on http://localhost:${PORT}`);
  console.log(`📊  Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔒  Risk Gate Threshold: ${process.env.RIPPLEGUARD_RISK_THRESHOLD || 70}/100`);
});

export default app;
