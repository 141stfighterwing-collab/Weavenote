import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { prisma } from '../db.js';
import { config } from '../config/index.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(50),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const guestSchema = z.object({
  guestId: z.string().optional(),
});

// Register new user
router.post('/register', async (req, res, next) => {
  try {
    const { email, username, password } = registerSchema.parse(req.body);
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    
    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        uid: uuidv4(),
        email,
        username,
        passwordHash,
      },
    });
    
    // Create session
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
    
    res.status(201).json({
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        username: user.username,
        role: user.role,
        permission: user.permission,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });
    
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Check if user is active
    if (user.status !== 'active') {
      return res.status(403).json({ error: `Account is ${user.status}` });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    // Create session
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);
    
    await prisma.session.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });
    
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });
    
    res.json({
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        username: user.username,
        role: user.role,
        permission: user.permission,
      },
      token,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    next(error);
  }
});

// Guest session
router.post('/guest', async (req, res, next) => {
  try {
    const { guestId } = guestSchema.parse(req.body);
    
    const uid = guestId || `guest_${uuidv4()}`;
    
    res.json({
      user: {
        uid,
        username: 'Guest',
        email: '',
        role: 'user',
        permission: 'read',
        isGuest: true,
      },
      token: null,
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await prisma.session.delete({
      where: { id: req.session.id },
    });
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Get current user
router.get('/me', authenticate, async (req, res, next) => {
  try {
    res.json({
      user: {
        id: req.user.id,
        uid: req.user.uid,
        email: req.user.email,
        username: req.user.username,
        role: req.user.role,
        permission: req.user.permission,
        status: req.user.status,
        aiUsageCount: req.user.aiUsageCount,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Validate token
router.get('/validate', optionalAuth, async (req, res) => {
  res.json({
    valid: !!req.user,
    user: req.user ? {
      id: req.user.id,
      uid: req.user.uid,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
    } : null,
  });
});

export default router;
