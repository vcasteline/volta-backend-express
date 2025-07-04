import { Request, Response } from 'express';
import { supabase } from '../index';
import { sendReservationConfirmationEmail } from '../utils/email';

interface ReservationEmailRequest {
  userId: string;
  classId: string;
  reservationId: string;
}

export const sendReservationEmail = async (req: Request, res: Response) => {
  try {
    const { userId, classId, reservationId }: ReservationEmailRequest = req.body;

    if (!userId || !classId || !reservationId) {
      return res.status(400).json({
        success: false,
        error: 'userId, classId y reservationId son requeridos'
      });
    }

    // Obtener información del usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

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

    if (classError || !classData) {
      return res.status(404).json({
        success: false,
        error: 'Clase no encontrada'
      });
    }

    // Obtener información de la reserva y bicicletas
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select(`
        id,
        created_at,
        reservation_bikes(
          bike:bikes(number)
        )
      `)
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      return res.status(404).json({
        success: false,
        error: 'Reserva no encontrada'
      });
    }

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

    // Obtener números de bicicletas
    const bikeNumbers = reservation.reservation_bikes?.map((rb: any) => rb.bike?.number?.toString()).filter(Boolean) || [];

    // Enviar email de confirmación
    const emailResult = await sendReservationConfirmationEmail({
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
    });

    if (!emailResult.success) {
      console.error('Error enviando email de reserva:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Error enviando email de confirmación'
      });
    }

    console.log('✅ Email de reserva enviado exitosamente:', {
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
    console.error('❌ Error en send-reservation-email:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 