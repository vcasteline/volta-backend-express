// Cargar variables de entorno PRIMERO
import dotenv from 'dotenv';
dotenv.config();

// Importar dependencias externas
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cron from 'node-cron';
import { createClient } from '@supabase/supabase-js';

// Importar rutas (después de cargar variables de entorno)
import { authMiddleware } from './middleware/auth';
import { getUserCards } from './routes/getUserCards';
import { processNuveiPayment } from './routes/processNuveiPayment';
import { verifyNuveiOTP } from './routes/verifyNuveiOTP';
import { sendPushNotification } from './routes/sendPushNotification';
import { waitlistNotification } from './routes/waitlistNotification';
import { forgotPassword } from './routes/forgotPassword';
import { resetPassword } from './routes/resetPassword';
import { sendReservationEmail } from './routes/sendReservationEmail';
import { sendPurchaseEmail } from './routes/sendPurchaseEmail';
import deleteAccountRouter from './routes/deleteAccount';
import { creditsExpirationCron } from './cron/creditsExpiration';
import { classRemindersCron } from './cron/classReminders';
import { completePastClassesCron } from './cron/completePastClasses';
import { generateWeeklyClassesCron } from './cron/generateWeeklyClasses';
import { cleanupDataCron } from './cron/cleanupData';

// Crear instancia de Express
const app = express();
const PORT = process.env.PORT || 3000;

// Configurar middleware
app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Crear cliente de Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Middleware de logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  next();
});

// Rutas de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'expo-supabase-express-server' 
  });
});

// Rutas principales (protegidas por autenticación)
app.get('/api/get-user-cards', authMiddleware, getUserCards);
app.post('/api/process-nuvei-payment', authMiddleware, processNuveiPayment);
app.post('/api/verify-nuvei-otp', authMiddleware, verifyNuveiOTP);
app.use('/api', authMiddleware, deleteAccountRouter);

// Rutas de sistema (sin autenticación de usuario, pero con validación de service key)
app.post('/api/send-push-notification', sendPushNotification);
app.post('/api/waitlist-notification', waitlistNotification);

// Email routes
app.post('/api/forgot-password', forgotPassword);
app.post('/api/reset-password', resetPassword);
app.post('/api/send-reservation-email', sendReservationEmail);
app.post('/api/send-purchase-email', authMiddleware, sendPurchaseEmail);

// Rutas de cron jobs (manuales, protegidas por service key)
app.post('/api/cron/credits-expiration', creditsExpirationCron);
app.post('/api/cron/class-reminders', classRemindersCron);
app.post('/api/cron/complete-past-classes', completePastClassesCron);
app.post('/api/cron/generate-weekly-classes', generateWeeklyClassesCron);
app.post('/api/cron/cleanup-data', cleanupDataCron);

// Programar cron jobs automáticos
// Ejecutar notificaciones de créditos por expirar todos los días a las 10 AM
cron.schedule('0 10 * * *', async () => {
  console.log('🔄 Ejecutando cron job de créditos por expirar...');
  try {
    await creditsExpirationCron({} as any, {} as any);
    console.log('✅ Cron job de créditos completado');
  } catch (error) {
    console.error('❌ Error en cron job de créditos:', error);
  }
});

// Ejecutar recordatorios de clase cada 10 minutos
cron.schedule('*/10 * * * *', async () => {
  console.log('🔄 Ejecutando cron job de recordatorios de clase...');
  try {
    await classRemindersCron({} as any, {} as any);
    console.log('✅ Cron job de recordatorios completado');
  } catch (error) {
    console.error('❌ Error en cron job de recordatorios:', error);
  }
});

// Ejecutar completar clases pasadas cada 30 minutos
cron.schedule('*/30 * * * *', async () => {
  console.log('🔄 Ejecutando cron job de completar clases pasadas...');
  try {
    await completePastClassesCron({} as any, {} as any);
    console.log('✅ Cron job de completar clases pasadas completado');
  } catch (error) {
    console.error('❌ Error en cron job de completar clases pasadas:', error);
  }
});

// Ejecutar generación de clases semanales todos los domingos a las 9 PM
cron.schedule('0 21 * * 0', async () => {
  console.log('🔄 Ejecutando cron job de generación de clases semanales...');
  try {
    await generateWeeklyClassesCron({} as any, {} as any);
    console.log('✅ Cron job de generación de clases semanales completado');
  } catch (error) {
    console.error('❌ Error en cron job de generación de clases semanales:', error);
  }
});

// Ejecutar limpieza de datos todos los domingos a las 2 AM
cron.schedule('0 2 * * 0', async () => {
  console.log('🔄 Ejecutando cron job de limpieza de datos...');
  try {
    await cleanupDataCron({} as any, {} as any);
    console.log('✅ Cron job de limpieza de datos completado');
  } catch (error) {
    console.error('❌ Error en cron job de limpieza de datos:', error);
  }
});

// Manejo de errores
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : err.message 
  });
});

// Ruta 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Ruta no encontrada' 
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor iniciado en puerto ${PORT}`);
  console.log(`🌍 Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app; 