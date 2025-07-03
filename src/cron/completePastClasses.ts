import { Request, Response } from 'express';
import { DateTime } from 'luxon';
import { supabase } from '../index';

export const completePastClassesCron = async (req: Request, res: Response) => {
  try {
    // Configurar zona horaria de Ecuador (UTC-5)
    const nowInEcuador = DateTime.now().setZone('America/Guayaquil');
    console.log(`[${nowInEcuador.toISO()}] Iniciando verificación de clases pasadas...`);

    // 1. Obtener clases que ya terminaron
    const todayDate = nowInEcuador.toISODate();
    const currentTime = nowInEcuador.toFormat('HH:mm:ss');

    const { data: pastClasses, error: classesError } = await supabase
      .from('classes')
      .select(`
        id,
        date,
        end_time,
        name
      `)
      .or(`date.lt.${todayDate},and(date.eq.${todayDate},end_time.lt.${currentTime})`);

    if (classesError) {
      throw new Error(`Error obteniendo clases: ${classesError.message}`);
    }

    let completedReservations = 0;
    let clearedWaitlist = 0;

    for (const classData of pastClasses || []) {
      console.log(`Procesando clase: ${classData.name} - ${classData.date} ${classData.end_time}`);

      // Obtener todas las reservaciones de esta clase que no están completadas o canceladas
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, status, user_id')
        .eq('class_id', classData.id)
        .in('status', ['confirmed', 'waitlist']);

      if (reservationsError) {
        console.error(`Error obteniendo reservaciones para clase ${classData.id}:`, reservationsError);
        continue;
      }

      // Separar reservaciones confirmadas de waitlist
      const confirmedReservations = reservations?.filter(r => r.status === 'confirmed') || [];
      const waitlistReservations = reservations?.filter(r => r.status === 'waitlist') || [];

      // 2. Marcar reservaciones confirmadas como "completed"
      if (confirmedReservations.length > 0) {
        const { error: updateError } = await supabase
          .from('reservations')
          .update({ status: 'completed' })
          .in('id', confirmedReservations.map(r => r.id));

        if (updateError) {
          console.error(`Error actualizando reservaciones a completed:`, updateError);
        } else {
          completedReservations += confirmedReservations.length;
          console.log(`✅ ${confirmedReservations.length} reservaciones marcadas como completadas`);
        }
      }

      // 3. Cancelar reservaciones de waitlist
      if (waitlistReservations.length > 0) {
        const { error: cancelError } = await supabase
          .from('reservations')
          .update({ status: 'cancelled' })
          .in('id', waitlistReservations.map(r => r.id));

        if (cancelError) {
          console.error(`Error cancelando waitlist:`, cancelError);
        } else {
          clearedWaitlist += waitlistReservations.length;
          console.log(`🗑️ ${waitlistReservations.length} reservaciones de waitlist canceladas`);
        }
      }
    }

    const summary = {
      timestamp: nowInEcuador.toISO(),
      processedClasses: pastClasses?.length || 0,
      completedReservations,
      clearedWaitlist,
      message: `Proceso completado: ${completedReservations} reservaciones completadas, ${clearedWaitlist} waitlist canceladas`
    };

    console.log('📊 Resumen:', summary);

    // Verificar si res es válido antes de responder
    if (res && typeof res.json === 'function') {
      return res.status(200).json(summary);
    }

    return summary;

  } catch (error: any) {
    console.error('❌ Error en complete-past-classes:', error);
    
    const errorResponse = {
      error: error.message,
      timestamp: DateTime.now().setZone('America/Guayaquil').toISO()
    };

    if (res && typeof res.status === 'function') {
      return res.status(500).json(errorResponse);
    }

    throw error;
  }
}; 