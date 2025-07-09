import express from 'express';
import { supabase } from '../index';

const router = express.Router();

interface DeleteAccountRequest {
  userId: string;
  email: string;
}

router.post('/delete-account', async (req, res) => {
  try {
    const { userId, email }: DeleteAccountRequest = req.body;

    // Validar que se proporcionen los datos necesarios
    if (!userId || !email) {
      return res.status(400).json({
        success: false,
        message: 'Usuario ID y email son requeridos'
      });
    }

    // Verificar que el usuario existe y que el email coincide
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      console.error('Error al obtener usuario:', userError);
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    if (user.user.email !== email) {
      return res.status(400).json({
        success: false,
        message: 'El email no coincide con el usuario'
      });
    }

    // Comenzar proceso de eliminación de datos
    console.log(`Iniciando eliminación de cuenta para usuario: ${userId} (${email})`);

    // 1. Obtener los IDs de las reservas del usuario primero
    const { data: userReservations, error: getReservationsError } = await supabase
      .from('reservations')
      .select('id')
      .eq('user_id', userId);

    if (getReservationsError) {
      console.error('Error al obtener reservas del usuario:', getReservationsError);
    }

    const reservationIds = userReservations?.map(r => r.id) || [];

    // 2. Eliminar bikes de reservas (si existen)
    if (reservationIds.length > 0) {
      const { error: reservationBikesError } = await supabase
        .from('reservation_bikes')
        .delete()
        .in('reservation_id', reservationIds);

      if (reservationBikesError) {
        console.error('Error al eliminar bicicletas de reservas:', reservationBikesError);
      }
    }

    // 3. Eliminar reservas del usuario
    const { error: reservationsError } = await supabase
      .from('reservations')
      .delete()
      .eq('user_id', userId);

    if (reservationsError) {
      console.error('Error al eliminar reservas:', reservationsError);
      // No retornamos error aquí, continuamos con la eliminación
    }

    // 4. Eliminar compras del usuario
    const { error: purchasesError } = await supabase
      .from('purchases')
      .delete()
      .eq('user_id', userId);

    if (purchasesError) {
      console.error('Error al eliminar compras:', purchasesError);
    }

    // 5. Eliminar datos del perfil del usuario
    const { error: profileError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);

    if (profileError) {
      console.error('Error al eliminar perfil de usuario:', profileError);
    }

    // 6. Finalmente, eliminar el usuario de Auth
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteUserError) {
      console.error('Error al eliminar usuario de Auth:', deleteUserError);
      return res.status(500).json({
        success: false,
        message: 'Error al eliminar el usuario del sistema de autenticación'
      });
    }

    console.log(`Cuenta eliminada exitosamente: ${userId} (${email})`);

    return res.status(200).json({
      success: true,
      message: 'Cuenta eliminada exitosamente'
    });

  } catch (error) {
    console.error('Error inesperado al eliminar cuenta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor'
    });
  }
});

export default router; 