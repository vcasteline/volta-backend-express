import { Request, Response } from 'express';
import { supabase } from '../index';
import { sendPurchaseConfirmationEmail } from '../utils/email';

interface PurchaseEmailRequest {
  packageName: string;
  credits: number;
  amount: number;
  authorizationCode: string;
  isDevelopment?: boolean;
}

export const sendPurchaseEmail = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { packageName, credits, amount, authorizationCode, isDevelopment }: PurchaseEmailRequest = req.body;

    if (!packageName || !credits || !amount || !authorizationCode) {
      return res.status(400).json({
        success: false,
        error: 'packageName, credits, amount y authorizationCode son requeridos'
      });
    }

    // Obtener información del usuario
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, name')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Formatear fechas
    const purchaseDate = new Date().toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // En desarrollo, no calcular fecha de expiración real
    let expirationDate: string | undefined;
    if (!isDevelopment) {
      // Para emails de producción, asumir 30 días de expiración por defecto
      expirationDate = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // Enviar email de confirmación
    const emailResult = await sendPurchaseConfirmationEmail({
      user: {
        email: userData.email,
        name: userData.name || userData.email || 'Cliente'
      },
      packageName: isDevelopment ? `${packageName} (DESARROLLO)` : packageName,
      credits,
      amount,
      purchaseDate,
      expirationDate,
      authorizationCode
    });

    if (!emailResult.success) {
      console.error('Error enviando email de compra:', emailResult.error);
      return res.status(500).json({
        success: false,
        error: 'Error enviando email de confirmación'
      });
    }

    console.log('✅ Email de compra enviado exitosamente:', {
      userId: user.id,
      email: userData.email,
      packageName,
      amount,
      isDevelopment,
      messageId: emailResult.messageId
    });

    return res.status(200).json({
      success: true,
      message: 'Email de confirmación enviado exitosamente',
      messageId: emailResult.messageId,
      isDevelopment
    });

  } catch (error: any) {
    console.error('❌ Error en send-purchase-email:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno del servidor'
    });
  }
}; 