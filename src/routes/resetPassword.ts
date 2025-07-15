import { Request, Response } from 'express';
import { supabase } from '../index';

interface ResetPasswordRequest {
  userId: string;
  newPassword: string;
}

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { userId, newPassword }: ResetPasswordRequest = req.body;

    if (!userId || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'ID de usuario y nueva contraseña son requeridos'
      });
    }

    // Validar contraseña
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    // Verificar que el usuario existe
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(400).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Actualizar contraseña usando Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      {
        password: newPassword
      }
    );

    if (updateError) {
      console.error('Error actualizando contraseña:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Error actualizando contraseña'
      });
    }

    // Invalidar todos los tokens de reset existentes del usuario
    const { error: invalidateError } = await supabase
      .from('password_reset_tokens')
      .update({
        used_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .is('used_at', null);

    if (invalidateError) {
      console.error('Error invalidando tokens de reset:', invalidateError);
      // No devolver error ya que la contraseña se actualizó exitosamente
    }

    console.log('✅ Contraseña actualizada exitosamente:', {
      userId: userId,
      email: user.email,
      timestamp: new Date().toISOString()
    });

    return res.status(200).json({
      success: true,
      message: 'Contraseña actualizada exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error en reset-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 