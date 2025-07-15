import { Request, Response } from 'express';
import { supabase } from '../index';
import { sendPasswordResetCodeEmail } from '../utils/email';
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
        message: 'Si el email existe, se ha enviado un código de recuperación'
      });
    }

    // Generar código de 6 dígitos
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = createHash('sha256').update(resetCode).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

    // Guardar código en la base de datos
    const { error: insertError } = await supabase
      .from('password_reset_tokens')
      .insert({
        user_id: user.id,
        token_hash: codeHash,
        expires_at: expiresAt.toISOString(),
        created_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('Error guardando código de reset:', insertError);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }

    // Enviar email con código de recuperación
    const emailResult = await sendPasswordResetCodeEmail({
      user: {
        email: user.email,
        name: user.name
      },
      resetCode,
      expiresInMinutes: 15
    });

    if (!emailResult.success) {
      console.error('Error enviando código de recuperación:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Error enviando código de recuperación'
      });
    }

    console.log('✅ Código de recuperación enviado exitosamente:', {
      userId: user.id,
      email: user.email,
      messageId: emailResult.messageId
    });

    return res.status(200).json({
      success: true,
      message: 'Código de recuperación enviado exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error en forgot-password:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 