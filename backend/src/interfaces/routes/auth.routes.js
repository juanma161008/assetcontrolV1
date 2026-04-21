import express from 'express';
import {
  login,
  registro,
  me,
  updateProfile,
  resetPassword,
  changePassword,
  requestForgotUsername,
  verifyForgotUsername
} from '../controllers/auth.controller.js';
import jwtAuth from '../middleware/jwtAuth.js';
import permisosAuth from '../middleware/permisosAuth.js';
import { createRateLimiter } from '../middleware/rateLimiter.js';
import env from '../../config/env.js';

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  message: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.',
  keyPrefix: 'auth',
  keyGenerator: (req) => {
    const ip = req.ip || req.connection?.remoteAddress || "unknown";
    const email = String(req.body?.email || "").trim().toLowerCase();
    return `auth:${ip}:${email}`;
  }
});

router.post('/login', authLimiter, login);
router.post('/registro', authLimiter, registro);
router.post('/forgot-username/request', authLimiter, requestForgotUsername);
router.post('/forgot-username/verify', authLimiter, verifyForgotUsername);
router.get('/me', jwtAuth, me);
router.put('/me', jwtAuth, updateProfile);
router.post('/reset-password', jwtAuth, permisosAuth(['ADMIN_TOTAL']), authLimiter, resetPassword);
router.post('/change-password', jwtAuth, authLimiter, changePassword);

export default router;
