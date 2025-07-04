import { Request, Response } from 'express';
import { supabase } from '../index';
import { createHash } from 'crypto';

interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { token, newPassword }: ResetPasswordRequest = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Token y nueva contraseña son requeridos'
      });
    }

    // Validar contraseña
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'La contraseña debe tener al menos 8 caracteres'
      });
    }

    // Crear hash del token para buscar en la base de datos
    const tokenHash = createHash('sha256').update(token).digest('hex');

    // Buscar token válido
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('user_id, expires_at, used')
      .eq('token_hash', tokenHash)
      .single();

    if (tokenError || !resetToken) {
      return res.status(400).json({
        success: false,
        error: 'Token inválido o expirado'
      });
    }

    // Verificar si el token ya fue usado
    if (resetToken.used) {
      return res.status(400).json({
        success: false,
        error: 'Este token ya ha sido usado'
      });
    }

    // Verificar si el token ha expirado
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    
    if (now > expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'El token ha expirado'
      });
    }

    // Actualizar contraseña usando Supabase Auth
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      resetToken.user_id,
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

    // Marcar token como usado
    const { error: markUsedError } = await supabase
      .from('password_reset_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('token_hash', tokenHash);

    if (markUsedError) {
      console.error('Error marcando token como usado:', markUsedError);
      // No devolver error ya que la contraseña se actualizó exitosamente
    }

    // Invalidar todos los otros tokens del usuario
    const { error: invalidateError } = await supabase
      .from('password_reset_tokens')
      .update({
        used: true,
        used_at: new Date().toISOString()
      })
      .eq('user_id', resetToken.user_id)
      .eq('used', false);

    if (invalidateError) {
      console.error('Error invalidando otros tokens:', invalidateError);
      // No devolver error ya que la contraseña se actualizó exitosamente
    }

    console.log('✅ Contraseña actualizada exitosamente:', {
      userId: resetToken.user_id,
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