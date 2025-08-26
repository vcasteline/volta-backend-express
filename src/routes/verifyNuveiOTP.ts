import { Request, Response } from 'express';
import { supabase } from '../index';
import { createNuveiAuthToken, getStatusMeaning, NuveiVerifyResponse } from '../utils/nuvei';
import { sendPurchaseConfirmationEmail, sendMenuPurchaseConfirmationEmail } from '../utils/email';

interface MenuPurchaseItem {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  name: string;
  extras?: any[];
}

interface VerifyRequest {
  transactionId: string;
  otp: string;
  // Para packages
  packageId?: string;
  credits?: number;
  // Para menu
  purchaseType?: 'package' | 'menu';
  menuItems?: MenuPurchaseItem[];
  totalAmount?: number;
}

// Función ATÓMICA para crear compra y actualizar transacción después de OTP
async function createPurchaseAndUpdateTransactionOTP(
  transactionId: string,
  userId: string,
  packageId: string,
  packageData: any,
  credits: number,
  verifyResult: any
): Promise<void> {
  // Calcular fecha de expiración
  let expirationDate: string | null = null;
  if (packageData.expiration_days && typeof packageData.expiration_days === 'number') {
    const today = new Date();
    expirationDate = new Date(today.setDate(today.getDate() + packageData.expiration_days)).toISOString();
  }

  // Ejecutar transacción atómica usando PostgreSQL
  const { error } = await supabase.rpc('create_purchase_otp_atomic', {
    p_transaction_id: transactionId,
    p_user_id: userId,
    p_package_id: packageId,
    p_credits_remaining: credits,
    p_expiration_date: expirationDate,
    p_authorization_code: transactionId,
    p_verification_data: verifyResult
  });

  if (error) {
    console.error('Error en transacción atómica OTP:', error);
    throw new Error(`Error atómico registrando compra OTP: ${error.message}`);
  }

  console.log('✅ Compra y transacción OTP creadas atómicamente');
}

// Función ATÓMICA para crear compra de menu y actualizar transacción después de OTP
// Reutiliza la función create_menu_purchase_atomic existente
async function createMenuPurchaseAndUpdateTransactionOTP(
  transactionId: string,
  userId: string,
  menuItems: MenuPurchaseItem[],
  totalPaid: number,
  verifyResult: any
): Promise<void> {
  // Convertir menuItems al formato esperado por la RPC
  const itemsForRPC = menuItems.map(item => ({
    menu_item_id: item.menuItemId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    name: item.name,
    extras: item.extras || []
  }));

  // Ejecutar transacción atómica usando PostgreSQL (reutilizando la función existente)
  const { error } = await supabase.rpc('create_menu_purchase_atomic', {
    p_idempotency_id: transactionId, // Usar transaction_id como idempotency_id
    p_user_id: userId,
    p_items: itemsForRPC,
    p_total_paid: totalPaid,
    p_authorization_code: transactionId,
    p_transaction_data: verifyResult,
    p_transaction_id: transactionId
  });

  if (error) {
    console.error('Error en transacción atómica OTP de menu:', error);
    throw new Error(`Error atómico registrando compra de menu OTP: ${error.message}`);
  }

  console.log('✅ Compra de menu y transacción OTP creadas atómicamente');
}

export const verifyNuveiOTP = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body: VerifyRequest = req.body;
    const { transactionId, otp, packageId, credits, purchaseType = 'package', menuItems, totalAmount } = body;

    // Validaciones básicas
    if (!transactionId || !otp) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transactionId, otp'
      });
    }

    // Validaciones específicas por tipo
    if (purchaseType === 'package' && !packageId) {
      return res.status(400).json({
        success: false,
        error: 'packageId is required for package purchases'
      });
    }

    if (purchaseType === 'menu' && (!menuItems || !totalAmount)) {
      return res.status(400).json({
        success: false,
        error: 'menuItems and totalAmount are required for menu purchases'
      });
    }

    // Obtener datos del usuario (necesitamos el username para Nuvei)
    const { data: userData, error: userDbError } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single();

    if (userDbError || !userData?.username) {
      throw new Error('User username not found');
    }

    // Obtener datos de paquete solo si es compra de package
    let packageData = null;
    if (purchaseType === 'package') {
      const { data: pkgData, error: packageError } = await supabase
        .from('packages')
        .select('*')
        .eq('id', packageId)
        .single();

      if (packageError || !pkgData) {
        throw new Error('Package not found');
      }
      packageData = pkgData;
    }

    // Crear token de autenticación
    const authToken = createNuveiAuthToken();

    // Preparar payload para verificación OTP
    const verifyPayload = {
      user: {
        id: userData.username
      },
      transaction: {
        id: transactionId,
      },
      type: "BY_OTP",
      value: otp,
      more_info: false
    };

    console.log('🔐 Verificando OTP con Nuvei:', {
      type: "BY_OTP",
      transactionId,
      userId: user.id,
      packageId
    });

    const nuveiBaseUrl = process.env.NUVEI_BASE_URL || 'https://ccapi-stg.paymentez.com';
    const verifyUrl = `${nuveiBaseUrl}/v2/transaction/verify`;

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Auth-Token': authToken,
      },
      body: JSON.stringify(verifyPayload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nuvei verify error: ${response.status} - ${errorText}`);
    }

    const verifyResult: NuveiVerifyResponse = await response.json() as NuveiVerifyResponse;

    console.log('✅ Respuesta de verificación Nuvei:', {
      status: verifyResult.status,
      statusDetail: verifyResult.status_detail,
      message: verifyResult.message
    });

    const statusMeaning = getStatusMeaning(verifyResult.status, verifyResult.status_detail);

    // Determinar si el OTP fue exitoso basado en códigos de Nuvei
    const isApproved = (verifyResult.status === 1 && (
      verifyResult.status_detail === 3 ||   // Paid
      verifyResult.status_detail === 32     // OTP successfully validated
    ));

    // Casos específicos de rechazo OTP
    const isOtpRejected = verifyResult.status_detail === 33; // OTP not validated
    const isPending = verifyResult.status === 0; // Pending

    console.log('🔍 Analizando resultado OTP:', {
      status: verifyResult.status,
      status_detail: verifyResult.status_detail,
      isApproved,
      isOtpRejected,
      isPending,
      message: verifyResult.message
    });

    // Actualizar transacción como completada o fallida
    if (isApproved) {
      console.log('✅ OTP verificado exitosamente - iniciando transacción atómica');
      
      try {
        // SOLUCIÓN ATÓMICA: Crear compra y actualizar estado en una sola transacción
        if (purchaseType === 'package') {
          await createPurchaseAndUpdateTransactionOTP(
            transactionId,
            user.id,
            packageId!,
            packageData!,
            credits || packageData!.class_credits,
            verifyResult
          );
        } else if (purchaseType === 'menu') {
          await createMenuPurchaseAndUpdateTransactionOTP(
            transactionId,
            user.id,
            menuItems!,
            totalAmount!,
            verifyResult
          );
        }

        // Enviar email de confirmación de compra
        let emailResult;
        if (purchaseType === 'package') {
          emailResult = await sendPurchaseConfirmationEmail({
            user: {
              email: user.email || '',
              name: user.user_metadata?.name || user.email || 'Cliente'
            },
            packageName: packageData!.name,
            credits: credits || packageData!.class_credits,
            amount: packageData!.price || 0,
            purchaseDate: new Date().toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            expirationDate: packageData!.expiration_days ? 
              new Date(Date.now() + (packageData!.expiration_days * 24 * 60 * 60 * 1000)).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              }) : undefined,
            authorizationCode: transactionId
          });
        } else {
          // Para menu purchases, usar el email específico de Volta
          emailResult = await sendMenuPurchaseConfirmationEmail({
            user: {
              email: user.email || '',
              name: user.user_metadata?.name || user.email || 'Cliente'
            },
            items: menuItems!.map(item => ({
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              extras: item.extras || []
            })),
            totalAmount: totalAmount!,
            purchaseDate: new Date().toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            }),
            authorizationCode: transactionId
          });
        }

        if (!emailResult.success) {
          console.error('⚠️ Error enviando email de compra OTP (no afecta la transacción):', emailResult.error);
        } else {
          console.log('✅ Email de compra OTP enviado exitosamente:', emailResult.messageId);
        }

        return res.status(200).json({
          success: true,
          message: 'OTP verified successfully and purchase completed',
          status: statusMeaning,
          transaction_id: transactionId,
          emailSent: emailResult.success
        });

      } catch (atomicError: any) {
        console.error('❌ Error en transacción atómica OTP:', atomicError);
        
        // Si falla la transacción atómica, marcar como fallida
        const { error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            status: 'failed',
            updated_at: new Date().toISOString(),
            verification_data: verifyResult,
            error_message: `Atomic OTP transaction failed: ${atomicError.message}`
          })
          .eq('transaction_id', transactionId);

        if (updateError) {
          console.error('Error updating transaction to failed:', updateError);
        }

        return res.status(500).json({
          success: false,
          error: 'Error procesando la compra después de OTP exitoso. Contacte soporte.',
          transaction_id: transactionId
        });
      }

    } else if (isPending) {
      // Transacción aún pendiente, podría necesitar más tiempo
      console.log('⏳ Transacción aún pendiente');
      
      return res.status(202).json({
        success: false,
        error: "La verificación está en proceso. Por favor espera un momento e intenta de nuevo.",
        verification: verifyResult,
        retry_allowed: true,
        is_pending: true
      });
    } else {
      // OTP incorrecto o rechazado
      const { error: updateError } = await supabase
        .from('payment_transactions')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
          verification_data: verifyResult,
          error_message: verifyResult.message
        })
        .eq('transaction_id', transactionId);

      if (updateError) {
        console.error('Error updating transaction:', updateError);
      }

      console.log('❌ OTP rechazado:', {
        status: verifyResult.status,
        status_detail: verifyResult.status_detail,
        isOtpRejected,
        message: verifyResult.message
      });

      // Mensaje específico según el tipo de error
      let errorMessage = verifyResult.message || "Error en la verificación";
      if (isOtpRejected) {
        errorMessage = "Código OTP incorrecto. Verifica el código enviado a tu teléfono.";
      } else if (verifyResult.status === 4) {
        errorMessage = "Transacción rechazada. " + (verifyResult.message || "Por favor intenta con otra tarjeta.");
      } else if (verifyResult.status === 5) {
        errorMessage = "El código OTP ha expirado. Solicita un nuevo código.";
      }

      return res.status(400).json({
        success: false,
        error: errorMessage,
        verification: verifyResult,
        retry_allowed: verifyResult.status !== 4, // No permitir reintento si fue rechazado definitivamente
        status_info: {
          status: verifyResult.status,
          status_detail: verifyResult.status_detail,
          meaning: getStatusMeaning(verifyResult.status, verifyResult.status_detail)
        }
      });
    }

  } catch (error: any) {
    console.error('❌ Error en verify-nuvei-otp:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error verificando OTP'
    });
  }
}; 