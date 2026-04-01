import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config/index.js';
import { prisma } from './db.js';
import notesRouter from './routes/notes.js';
import foldersRouter from './routes/folders.js';
import authRouter from './routes/auth.js';
import usersRouter from './routes/users.js';
import templatesRouter from './routes/templates.js';
import exportRouter from './routes/export.js';
import healthRouter from './routes/health.js';
import settingsRouter from './routes/settings.js';
import versionRouter from './routes/version.js';

const app = express();

// =============================================================================
// Security Middleware
// =============================================================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      // Allow Giphy and Tenor frames for GIF embeds
      frameSrc: ["'self'", 'https://giphy.com', 'https://tenor.com'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || config.cors.origins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing - 20MB limit for large document uploads
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.requestId = crypto.randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// =============================================================================
// API Routes
// =============================================================================

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/notes', notesRouter);
app.use('/api/folders', foldersRouter);
app.use('/api/users', usersRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/export', exportRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/version', versionRouter);

// =============================================================================
// Error Handling
// =============================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(`[Error] ${req.requestId}:`, err);
  
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// =============================================================================
// Server Startup
// =============================================================================

const startServer = async () => {
  try {
    // SECURITY: Fail secure - ensure JWT_SECRET is provided
    if (!config.jwt.secret) {
      console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET environment variable is missing.');
      console.error('The application cannot start without a secure JWT_SECRET.');
      process.exit(1);
    }

    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connected successfully');
    
    // Start listening
    app.listen(config.port, () => {
      console.log(`🚀 Weavenote API server running on port ${config.port}`);
      console.log(`📖 Health check: http://localhost:${config.port}/api/health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
