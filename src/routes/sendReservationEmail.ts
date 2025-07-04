import { Request, Response } from 'express';
import { supabase } from '../index';
import { sendReservationConfirmationEmail } from '../utils/email';

interface ReservationEmailRequest {
  userId: string;
  classId: string;
  reservationId: string;
}

export const sendReservationEmail = async (req: Request, res: Response) => {
  console.log('🎯 [RESERVATION EMAIL] Iniciando proceso...');
  console.log('📦 [RESERVATION EMAIL] Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { userId, classId, reservationId }: ReservationEmailRequest = req.body;

    if (!userId || !classId || !reservationId) {
      console.log('❌ [RESERVATION EMAIL] Faltan parámetros requeridos:', {
        userId: !!userId,
        classId: !!classId, 
        reservationId: !!reservationId
      });
      return res.status(400).json({
        success: false,
        error: 'userId, classId y reservationId son requeridos'
      });
    }

    console.log('✅ [RESERVATION EMAIL] Parámetros válidos, buscando usuario...');

    // Obtener información del usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    console.log('👤 [RESERVATION EMAIL] Usuario obtenido:', user);
    if (userError) console.log('❌ [RESERVATION EMAIL] Error usuario:', userError);

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    console.log('✅ [RESERVATION EMAIL] Usuario encontrado, buscando clase...');

    // Obtener información de la clase
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

    console.log('🏃‍♀️ [RESERVATION EMAIL] Clase obtenida:', classData);
    if (classError) console.log('❌ [RESERVATION EMAIL] Error clase:', classError);

    if (classError || !classData) {
      return res.status(404).json({
        success: false,
        error: 'Clase no encontrada'
      });
    }

    console.log('✅ [RESERVATION EMAIL] Clase encontrada, buscando reserva...');

    // Obtener información de la reserva y bicicletas
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        id,
        created_at,
        reservation_bikes(
          bike:bikes(
            static_bike_id,
            static_bikes(number)
          )
        )
      `)
      .eq('id', reservationId)
      .single();

    console.log('🚴‍♀️ [RESERVATION EMAIL] Reserva obtenida:', JSON.stringify(reservation, null, 2));
    if (reservationError) console.log('❌ [RESERVATION EMAIL] Error reserva:', reservationError);

    if (reservationError || !reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada'
      });
    }

    console.log('✅ [RESERVATION EMAIL] Reserva encontrada, formateando datos...');

    // Formatear fecha y hora
    const classDate = new Date(classData.date).toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const classTime = `${classData.start_time.substring(0, 5)} - ${classData.end_time.substring(0, 5)}`;

    const reservationDate = new Date(reservation.created_at).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Obtener números de bicicletas (actualizado para nueva estructura)
    const bikeNumbers = reservation.reservation_bikes?.map((rb: any) => {
      console.log('🚲 [RESERVATION EMAIL] Procesando bike:', JSON.stringify(rb, null, 2));
      return rb.bike?.static_bikes?.number?.toString();
    }).filter(Boolean) || [];

    console.log('🚲 [RESERVATION EMAIL] Números de bicis obtenidos:', bikeNumbers);

    const emailData = {
      user: {
        email: user.email,
        name: user.name
      },
      className: classData.name,
      classDate,
      classTime,
      instructorName: (classData.instructor as any)?.name || 'Instructor',
      reservationDate,
      bikeNumbers
    };

    console.log('📧 [RESERVATION EMAIL] Datos para email:', JSON.stringify(emailData, null, 2));

    // Enviar email de confirmación
    console.log('📤 [RESERVATION EMAIL] Enviando email...');
    const emailResult = await sendReservationConfirmationEmail(emailData);

    console.log('📧 [RESERVATION EMAIL] Resultado email:', emailResult);

    if (!emailResult.success) {
      console.error('❌ [RESERVATION EMAIL] Error enviando email:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Error enviando email de confirmación'
      });
    }

    console.log('✅ [RESERVATION EMAIL] Email enviado exitosamente:', {
      userId,
      classId,
      reservationId,
      email: user.email,
      messageId: emailResult.messageId
    });

    return res.status(200).json({
      success: true,
      message: 'Email de confirmación enviado exitosamente',
      messageId: emailResult.messageId
    });

  } catch (error: any) {
    console.error('❌ [RESERVATION EMAIL] Error general:', error);
    console.error('❌ [RESERVATION EMAIL] Stack trace:', error.stack);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 