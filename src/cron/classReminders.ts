import { Request, Response } from 'express';
import { supabase } from '../index';

export const classRemindersCron = async (req: Request, res: Response) => {
  try {
    console.log('⏰ Iniciando proceso de recordatorios de clases...');

    // Obtener la fecha/hora actual en zona horaria de Ecuador (UTC-5)
    const now = new Date();
    const ecuadorTime = new Date(now.getTime() - (5 * 60 * 60 * 1000)); // UTC-5
    
    // Calcular la hora objetivo (1 hora desde ahora)
    const targetTime = new Date(ecuadorTime.getTime() + (60 * 60 * 1000)); // +1 hora
    
    // Formatear para búsqueda (solo fecha y hora:minuto)
    const targetDate = targetTime.toISOString().split('T')[0]; // YYYY-MM-DD
    const targetHour = targetTime.getUTCHours().toString().padStart(2, '0');
    const targetMinute = targetTime.getUTCMinutes().toString().padStart(2, '0');
    const targetTimeString = `${targetHour}:${targetMinute}`; // HH:MM

    console.log(`🎯 Buscando clases para ${targetDate} a las ${targetTimeString} (hora Ecuador)`);

    // Buscar clases que empiecen en exactamente 1 hora
    const { data: upcomingClasses, error: classesError } = await supabase
      .from('classes')
      .select(`
        id,
        name,
        date,
        start_time,
        end_time,
        instructor:instructors(name)
      `)
      .eq('date', targetDate)
      .gte('start_time', `${targetTimeString}:00`) // Desde la hora objetivo
      .lt('start_time', `${targetHour}:${String(parseInt(targetMinute) + 5).padStart(2, '0')}:00`) // Hasta 5 minutos después
      .order('start_time', { ascending: true });

    if (classesError) {
      throw new Error(`Error obteniendo clases: ${classesError.message}`);
    }

    if (!upcomingClasses || upcomingClasses.length === 0) {
      console.log('ℹ️ No hay clases que empiecen en 1 hora');
      const result = {
        success: true, 
        message: 'No classes starting in 1 hour',
        classesFound: 0,
        notificationsSent: 0
      };
      
      // Solo responder si res es válido (endpoint HTTP)
      if (res && typeof res.status === 'function') {
        return res.status(200).json(result);
      }
      return result;
    }

    console.log(`📚 Encontradas ${upcomingClasses.length} clase(s) que empiezan en 1 hora`);

    let totalNotificationsSent = 0;

    // Procesar cada clase
    for (const classItem of upcomingClasses) {
      console.log(`🔄 Procesando clase: ${classItem.name} - ${classItem.start_time}`);

      // Obtener usuarios con reservas confirmadas para esta clase
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('user_id')
        .eq('class_id', classItem.id)
        .eq('status', 'confirmed');

      if (reservationsError) {
        console.error(`Error obteniendo reservas para clase ${classItem.id}:`, reservationsError);
        continue;
      }

      if (!reservations || reservations.length === 0) {
        console.log(`⚠️ No hay reservas para la clase: ${classItem.name}`);
        continue;
      }

      const userIds = reservations.map((res: any) => res.user_id);
      const startTime = classItem.start_time.substring(0, 5); // HH:MM
      const endTime = classItem.end_time.substring(0, 5); // HH:MM

      console.log(`👥 Enviando recordatorios a ${userIds.length} usuario(s)`);

      // Preparar payload para notificación
      const notificationPayload = {
        userIds,
        title: "🚴‍♀️ Tu clase empieza en 1 hora",
        body: `${classItem.name || `Rueda con ${(classItem.instructor as any)?.name || 'instructor'}`} - ${startTime}. ¡Prepárate para pedalear! 💪`,
        data: {
          type: 'class_reminder',
          classId: classItem.id,
          className: classItem.name,
          classTime: `${startTime} - ${endTime}`,
          instructorName: (classItem.instructor as any)?.name,
          classDate: classItem.date
        },
        priority: 'high'
      };

      // Enviar notificaciones
      try {
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
          console.error(`Error enviando notificaciones para clase ${classItem.id}:`, errorText);
          continue;
        }

        const notificationResult = await notificationResponse.json() as any;
        const sent = notificationResult.messagesSent || 0;
        totalNotificationsSent += sent;

        console.log(`✅ Enviadas ${sent} notificaciones para: ${classItem.name}`);
        
      } catch (notificationError) {
        console.error(`Error enviando notificaciones para clase ${classItem.id}:`, notificationError);
      }
    }

    console.log(`🎉 Proceso completado. Total de notificaciones enviadas: ${totalNotificationsSent}`);

    const result = {
      success: true,
      message: `Class reminders processed successfully`,
      classesFound: upcomingClasses.length,
      notificationsSent: totalNotificationsSent,
      targetTime: `${targetDate} ${targetTimeString}`,
      processedClasses: upcomingClasses.map((c: any) => ({ 
        id: c.id, 
        name: c.name, 
        startTime: c.start_time 
      }))
    };

    // Solo responder si res es válido (endpoint HTTP)
    if (res && typeof res.status === 'function') {
      return res.status(200).json(result);
    }
    return result;

  } catch (error: any) {
    console.error('❌ Error en recordatorios de clases:', error);
    
    const errorResult = {
      success: false,
      error: error.message || 'Error desconocido'
    };

    // Solo responder si res es válido (endpoint HTTP)
    if (res && typeof res.status === 'function') {
      return res.status(500).json(errorResult);
    }
    throw error; // Re-lanzar el error para cron jobs
  }
}; 