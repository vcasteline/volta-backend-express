import { Request, Response } from 'express';
import { supabase } from '../index';
import { createHash } from 'crypto';

interface VerifyResetCodeRequest {
  email: string;
  code: string;
}

export const verifyResetCode = async (req: Request, res: Response) => {
  try {
    const { email, code }: VerifyResetCodeRequest = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email y código son requeridos'
      });
    }

    // Validar formato del código (6 dígitos)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'Código debe tener 6 dígitos'
      });
    }

    console.log('🔍 Verificando código de recuperación para:', email);

    // Buscar usuario por email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('email', email.toLowerCase())
      .single();

    if (userError || !user) {
      return res.status(400).json({
        success: false,
        error: 'Email no encontrado'
      });
    }

    // Crear hash del código para comparar
    const codeHash = createHash('sha256').update(code).digest('hex');

    // Buscar código válido en la base de datos
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('id, token_hash, expires_at, used_at')
      .eq('user_id', user.id)
      .eq('token_hash', codeHash)
      .is('used_at', null)
      .single();

    if (tokenError || !resetToken) {
      console.log('❌ Código inválido o no encontrado:', { email, code: code.substring(0, 2) + '****' });
      return res.status(400).json({
        success: false,
        error: 'Código inválido o expirado'
      });
    }

    // Verificar si el código ha expirado
    const now = new Date();
    const expiresAt = new Date(resetToken.expires_at);
    
    if (now > expiresAt) {
      console.log('❌ Código expirado:', { email, expiresAt });
      return res.status(400).json({
        success: false,
        error: 'Código expirado'
      });
    }

    // Marcar el código como usado
    const { error: updateError } = await supabase
      .from('password_reset_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', resetToken.id);

    if (updateError) {
      console.error('Error marcando código como usado:', updateError);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }

    console.log('✅ Código verificado exitosamente:', {
      userId: user.id,
      email: user.email
    });

    return res.status(200).json({
      success: true,
      message: 'Código verificado exitosamente',
      userId: user.id // Necesario para el siguiente paso
    });

  } catch (error: any) {
    console.error('❌ Error en verify-reset-code:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 