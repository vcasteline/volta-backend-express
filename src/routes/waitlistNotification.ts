import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { supabase } from '../index';
import { serviceKeyMiddleware } from '../middleware/auth';

interface WaitlistNotificationRequest {
  classId: string;
  userId?: string;
  className?: string;
  classDate?: string;
  classTime?: string;
  instructorName?: string;
}

export const waitlistNotification = [
  serviceKeyMiddleware,
  async (req: Request, res: Response) => {
    try {
      const body: WaitlistNotificationRequest = req.body;
      const { classId, userId, className, classDate, classTime, instructorName } = body;

      if (!classId) {
        return res.status(400).json({
          success: false,
          error: 'classId is required'
        });
      }

      console.log(`🎯 Procesando notificación de waitlist para clase: ${classId}`);

      // 1. Obtener información de la clase si no se proporciona
      let classInfo = { className, classDate, classTime, instructorName };
      
      if (!className || !classDate || !classTime || !instructorName) {
        const { data: classData, error: classError } = await supabase
          .from('classes')
          .select(`
            name,
            date,
            start_time,
            end_time,
            instructor:instructors(name)
          `)
          .eq('id', classId)
          .single();

        if (classError) throw new Error(`Error obteniendo información de la clase: ${classError.message}`);
        
        classInfo = {
          className: className || classData.name,
          classDate: classDate || classData.date,
          classTime: classTime || `${classData.start_time.substring(0, 5)} - ${classData.end_time.substring(0, 5)}`,
          instructorName: instructorName || (classData.instructor as any)?.name
        };
      }

      // 2. Determinar usuarios a notificar
      let userIds: string[] = [];
      
      if (userId) {
        // Caso específico: notificar solo al usuario promovido
        userIds = [userId];
        console.log(`👤 Notificando usuario específico promovido: ${userId}`);
      } else {
        // Caso general: notificar todos los usuarios en waitlist
        const { data: waitlistUsers, error: waitlistError } = await supabase
          .from('waitlist')
          .select('user_id')
          .eq('class_id', classId)
          .eq('status', 'active')
          .order('created_at', { ascending: true });

        if (waitlistError) {
          throw new Error(`Error obteniendo waitlist: ${waitlistError.message}`);
        }

        if (!waitlistUsers || waitlistUsers.length === 0) {
          console.log('ℹ️ No hay usuarios en el waitlist para esta clase');
          return res.status(200).json({
            success: true, 
            message: 'No users in waitlist',
            notificationsSent: 0
          });
        }

        userIds = waitlistUsers.map((item: any) => item.user_id);
        console.log(`👥 Enviando notificaciones a ${userIds.length} usuario(s) en waitlist`);
      }

      // 3. Enviar notificaciones
      const notificationTitle = userId ? "¡Reserva Confirmada! 🎉" : "¡Espacio Disponible! 🎉";
      const notificationBody = userId 
        ? `Tu lugar en ${classInfo.className} - ${classInfo.classTime}${classInfo.instructorName ? ` con ${classInfo.instructorName}` : ''} ha sido confirmado automáticamente`
        : `Se liberó un lugar en ${classInfo.className} - ${classInfo.classTime}${classInfo.instructorName ? ` con ${classInfo.instructorName}` : ''}`;

      const notificationPayload = {
        userIds,
        title: notificationTitle,
        body: notificationBody,
        data: {
          type: 'waitlist_opened',
          classId,
          className: classInfo.className,
          classTime: classInfo.classTime,
          instructorName: classInfo.instructorName,
          classDate: classInfo.classDate,
          wasPromoted: !!userId
        },
        priority: 'high'
      };

      const serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
      const notificationResponse = await fetch(`${serverUrl}/api/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
        body: JSON.stringify(notificationPayload)
      });

      if (!notificationResponse.ok) {
        const errorText = await notificationResponse.text();
        throw new Error(`Error enviando notificaciones: ${errorText}`);
      }

      const notificationResult = await notificationResponse.json() as any;
      
      console.log('✅ Notificaciones de waitlist enviadas exitosamente');

      return res.status(200).json({
        success: true,
        message: `Waitlist notifications sent to ${userIds.length} users`,
        classId,
        className: classInfo.className,
        notificationsSent: notificationResult.messagesSent || 0,
      });

    } catch (error: any) {
      console.error('❌ Error en notificación de waitlist:', error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Error desconocido'
      });
    }
  }
]; 