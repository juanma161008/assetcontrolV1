import express from 'express';
import { getAuditoriaLogs, registrarErrorSoftware } from '../controllers/auditoria.controller.js';
import jwtAuth from '../middleware/jwtAuth.js';

const router = express.Router();

router.get('/', jwtAuth, getAuditoriaLogs);
router.post('/errores', jwtAuth, registrarErrorSoftware);

export default router;
