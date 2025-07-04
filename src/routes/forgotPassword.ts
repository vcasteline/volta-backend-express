import { Request, Response } from 'express';
import { supabase } from '../index';
import { sendPasswordResetEmail } from '../utils/email';
import { createHash, randomBytes } from 'crypto';

interface ForgotPasswordRequest {
  email: string;
}

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email }: ForgotPasswordRequest = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Buscar usuario por email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single();

    // Siempre responder con éxito para evitar enumeración de usuarios
    if (userError || !user) {
      console.log('🔍 Usuario no encontrado para reset:', email);
      return res.status(200).json({
        success: true,
        message: 'Si el email existe, se ha enviado un enlace de recuperación'
      });
    }

    // Generar token de recuperación
    const resetToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    // Guardar token en la base de datos
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error guardando token de reset:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }

    // Crear URL de reset
    const frontendUrl = process.env.FRONTEND_URL || 'https://giro-app.com';
    const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`;

    // Enviar email de recuperación
    const emailResult = await sendPasswordResetEmail({
      user: {
        email: user.email,
        name: user.name
      },
      resetToken,
      resetUrl
    });

    if (!emailResult.success) {
      console.error('Error enviando email de recuperación:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Error enviando email de recuperación'
      });
    }

    console.log('✅ Email de recuperación enviado exitosamente:', {
      userId: user.id,
      email: user.email,
      messageId: emailResult.messageId
    });

    return res.status(200).json({
      success: true,
      message: 'Email de recuperación enviado exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error en forgot-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 