import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { supabase } from '../index';
import { createNuveiAuthToken, getStatusMeaning, NuveiVerifyResponse } from '../utils/nuvei';

interface VerifyRequest {
  transactionId: string;
  otp: string;
  packageId: string;
  credits?: number;
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

export const verifyNuveiOTP = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body: VerifyRequest = req.body;
    const { transactionId, otp, packageId, credits } = body;

    if (!transactionId || !otp || !packageId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transactionId, otp, packageId'
      });
    }

    // Obtener datos del usuario (necesitamos la cédula para Nuvei)
    const { data: userData, error: userDbError } = await supabase
      .from('users')
      .select('cedula')
      .eq('id', user.id)
      .single();

    if (userDbError || !userData?.cedula) {
      throw new Error('User cedula not found');
    }

    // Obtener datos de paquete
    const { data: packageData, error: packageError } = await supabase
      .from('packages')
      .select('*')
      .eq('id', packageId)
      .single();

    if (packageError || !packageData) {
      throw new Error('Package not found');
    }

    // Crear token de autenticación
    const authToken = createNuveiAuthToken();

    // Preparar payload para verificación OTP
    const verifyPayload = {
      user: {
        id: userData.cedula
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
        await createPurchaseAndUpdateTransactionOTP(
          transactionId,
          user.id,
          packageId,
          packageData,
          credits || packageData.class_credits,
          verifyResult
        );

        return res.status(200).json({
          success: true,
          message: 'OTP verified successfully and purchase completed',
          status: statusMeaning,
          transaction_id: transactionId
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