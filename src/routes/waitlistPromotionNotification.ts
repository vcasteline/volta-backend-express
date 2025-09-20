import { Request, Response } from 'express';
import { supabase } from '../index';
import { sendWaitlistPromotionEmail } from '../utils/email';

interface WaitlistPromotionRequest {
  userId: string;
  classId: string;
  reservationId: string;
}

export const waitlistPromotionNotification = async (req: Request, res: Response) => {
    try {
      console.log('🔍 Waitlist promotion notification endpoint reached');
      console.log('📝 Request body:', JSON.stringify(req.body, null, 2));
      
      const body: WaitlistPromotionRequest = req.body;
      const { userId, classId, reservationId } = body;

      if (!userId || !classId || !reservationId) {
        console.log('❌ Missing required parameters');
        return res.status(400).json({
          success: false,
          error: 'userId, classId and reservationId are required'
        });
      }

      console.log(`🎯 Procesando notificación de promoción de waitlist para usuario: ${userId}, clase: ${classId}`);

      // 1. Obtener información del usuario
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, name')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('❌ Error obteniendo usuario:', userError);
        throw new Error(`Error obteniendo información del usuario: ${userError.message}`);
      }

      // 2. Obtener información de la clase
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          date,
          start_time,
          end_time,
          instructor:instructors(name)
        `)
        .eq('id', classId)
        .single();

      if (classError) {
        console.error('❌ Error obteniendo clase:', classError);
        throw new Error(`Error obteniendo información de la clase: ${classError.message}`);
      }

      // 3. Obtener números de bicicletas asignadas
      const { data: bikeData, error: bikeError } = await supabase
        .from('reservation_bikes')
        .select(`
          bike:bikes(
            static_bike:static_bikes(number)
          )
        `)
        .eq('reservation_id', reservationId);

      let bikeNumbers: string[] = [];
      if (!bikeError && bikeData) {
        bikeNumbers = bikeData
          .map((rb: any) => rb.bike?.static_bike?.number?.toString())
          .filter(Boolean);
      }

      // 4. Formatear datos para notificación y email
      const classInfo = {
        className: classData.name || `Rueda con ${(classData.instructor as any)?.name || 'instructor'}`,
        classDate: new Date(classData.date).toLocaleDateString('es-EC', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        classTime: `${classData.start_time.substring(0, 5)} - ${classData.end_time.substring(0, 5)}`,
        instructorName: (classData.instructor as any)?.name || 'Instructor'
      };

      // 5. Enviar notificación push
      console.log('📱 Enviando notificación push...');
      
      const notificationPayload = {
        userIds: [userId],
        title: "¡Reserva Confirmada! 🎉",
        body: `Tu lugar en ${classInfo.className || `Rueda con ${classInfo.instructorName}`} - ${classInfo.classTime}${classInfo.instructorName ? ` con ${classInfo.instructorName}` : ''} ha sido confirmado automáticamente`,
        data: {
          type: 'waitlist_promoted',
          classId,
          reservationId,
          className: classInfo.className,
          classTime: classInfo.classTime,
          instructorName: classInfo.instructorName,
          classDate: classInfo.classDate,
          wasPromoted: true
        },
        priority: 'high'
      };

      // Usar la URL directa de Railway
      const serverUrl = 'https://volta-backend-express-production.up.railway.app';
      
      const notificationResponse = await fetch(`${serverUrl}/api/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        },
        body: JSON.stringify(notificationPayload)
      });

      let pushNotificationResult = null;
      if (!notificationResponse.ok) {
        const errorText = await notificationResponse.text();
        console.error('❌ Error enviando notificación push:', errorText);
      } else {
        pushNotificationResult = await notificationResponse.json();
        console.log('✅ Notificación push enviada exitosamente');
      }

      // 6. Enviar email de confirmación
      console.log('📧 Enviando email de confirmación...');
      
      const emailData = {
        user: {
          email: userData.email,
          name: userData.name
        },
        className: classInfo.className,
        classDate: classInfo.classDate,
        classTime: classInfo.classTime,
        instructorName: classInfo.instructorName,
        bikeNumbers
      };

      const emailResult = await sendWaitlistPromotionEmail(emailData);
      
      if (!emailResult.success) {
        console.error('❌ Error enviando email:', emailResult.error);
      } else {
        console.log('✅ Email de promoción enviado exitosamente:', emailResult.messageId);
      }

      // 7. Marcar la notificación como enviada en la base de datos
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ sent: true })
        .eq('user_id', userId)
        .eq('title', '¡Has entrado a la clase!')
        .eq('sent', false);

      if (updateError) {
        console.error('❌ Error actualizando estado de notificación:', updateError);
      } else {
        console.log('✅ Estado de notificación actualizado');
      }

      return res.status(200).json({
        success: true,
        message: 'Waitlist promotion notifications sent successfully',
        userId,
        classId,
        reservationId,
        className: classInfo.className,
        pushNotificationSent: !!pushNotificationResult,
        emailSent: emailResult.success,
        emailMessageId: emailResult.messageId,
        pushMessagesSent: (pushNotificationResult as any)?.messagesSent || 0
      });

    } catch (error: any) {
      console.error('❌ Error en notificación de promoción de waitlist:', error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Error desconocido'
      });
    }
};
