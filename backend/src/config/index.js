import dotenv from 'dotenv';
dotenv.config();

// Critical security check for production
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV === 'production') {
  console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not defined.');
  console.error('The application cannot start in production without a secure JWT_SECRET.');
  process.exit(1);
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@postgres:5432/weavenote',
  },
  jwt: {
    // SECURITY: Removed hardcoded default for JWT_SECRET.
    // This MUST be provided in the environment (e.g., .env file) for the application to be secure.
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  admin: {
    setupPass: process.env.ADMIN_SETUP_PASS || '',
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:8080'],
  },
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10), // limit each IP to 100 requests per window
  },
};
