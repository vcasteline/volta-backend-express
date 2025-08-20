import { Request, Response } from 'express';
import { supabase } from '../index';
import { createNuveiAuthToken, generateIdempotencyId, NuveiPaymentResponse } from '../utils/nuvei';
import { sendPurchaseConfirmationEmail, sendMenuPurchaseConfirmationEmail } from '../utils/email';

interface MenuPurchaseItem {
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  name: string;
}

interface PaymentRequest {
  // Para compras de packages (existente)
  packageId?: string;
  credits?: number;
  
  // Para compras de menu (nuevo)
  menuItems?: MenuPurchaseItem[];
  purchaseType: 'package' | 'menu';
  
  // Campos comunes
  cardToken: string;
  amount: number;
  description: string;
  vat?: number;
}

// Función para verificar y crear registro de transacción en progreso
async function checkAndCreateTransactionLock(
  idempotencyId: string, 
  userId: string, 
  packageId?: string,
  purchaseType: 'package' | 'menu' = 'package'
): Promise<{ canProceed: boolean; existingTransaction?: any }> {
  
  // Primero buscar cualquier transacción con este idempotency_id
  const { data: existingTransactions, error: searchError } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('idempotency_id', idempotencyId)
    .order('created_at', { ascending: false })
    .limit(1);

  if (searchError) {
    console.error('Error searching existing transactions:', searchError);
    throw new Error('Error verificando transacciones existentes');
  }

  // Si ya existe una transacción con este ID
  if (existingTransactions && existingTransactions.length > 0) {
    const existingTransaction = existingTransactions[0];
    
    console.log('🔍 Transacción existente encontrada:', {
      id: existingTransaction.id,
      status: existingTransaction.status,
      created_at: existingTransaction.created_at
    });

    // Si está completada exitosamente, retornar la información
    if (existingTransaction.status === 'completed' && 
        existingTransaction.transaction_data?.transaction?.status === 'success') {
      return {
        canProceed: false,
        existingTransaction: existingTransaction
      };
    }

    // Si está en progreso y fue creada hace menos de 5 minutos, evitar duplicado
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const transactionTime = new Date(existingTransaction.created_at);
    
    if (existingTransaction.status === 'in_progress' && transactionTime > fiveMinutesAgo) {
      return {
        canProceed: false,
        existingTransaction: null
      };
    }

    // Si está pendiente OTP y fue creada hace menos de 10 minutos
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    if (existingTransaction.status === 'pending_otp' && transactionTime > tenMinutesAgo) {
      return {
        canProceed: false,
        existingTransaction: null
      };
    }

    // Si la transacción es antigua o falló, actualizarla en lugar de crear nueva
    console.log('♻️ Reutilizando transacción existente:', existingTransaction.id);
    
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'in_progress',
        updated_at: new Date().toISOString(),
        transaction_data: null,
        error_message: null
      })
      .eq('id', existingTransaction.id);

    if (updateError) {
      console.error('Error updating existing transaction:', updateError);
      throw new Error('Error actualizando transacción existente');
    }

    return { canProceed: true };
  }

  // No existe transacción previa, crear nueva
  const insertData: any = {
    idempotency_id: idempotencyId,
    user_id: userId,
    status: 'in_progress',
    purchase_type: purchaseType,
    created_at: new Date().toISOString()
  };

  // Solo agregar package_id si es una compra de package
  if (purchaseType === 'package' && packageId) {
    insertData.package_id = packageId;
  }

  const { error: insertError } = await supabase
    .from('payment_transactions')
    .insert(insertData);

  if (insertError) {
    console.error('Error creating new transaction:', insertError);
    throw new Error('Error creando nueva transacción');
  }

  return { canProceed: true };
}

// Función para actualizar el estado de la transacción
async function updateTransactionStatus(
  idempotencyId: string,
  status: 'completed' | 'failed' | 'pending_otp',
  transactionData?: any,
  errorMessage?: string
) {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString()
  };

  if (transactionData) {
    updateData.transaction_data = transactionData;
    if (transactionData.transaction?.id) {
      updateData.transaction_id = transactionData.transaction.id;
    }
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabase
    .from('payment_transactions')
    .update(updateData)
    .eq('idempotency_id', idempotencyId);

  if (error) {
    console.error('Error updating transaction status:', error);
    throw new Error('Error actualizando estado de transacción');
  }
}

// Función ATÓMICA para crear compra y actualizar transacción
async function createPurchaseAndUpdateTransaction(
  idempotencyId: string,
  userId: string,
  packageId: string,
  packageData: any,
  credits: number,
  authorizationCode: string,
  paymentResult: any
): Promise<void> {
  // Calcular fecha de expiración
  let expirationDate: string | null = null;
  if (packageData.expiration_days && typeof packageData.expiration_days === 'number') {
    const today = new Date();
    expirationDate = new Date(today.setDate(today.getDate() + packageData.expiration_days)).toISOString();
  }

  // Ejecutar transacción atómica usando PostgreSQL
  const { error } = await supabase.rpc('create_purchase_atomic', {
    p_idempotency_id: idempotencyId,
    p_user_id: userId,
    p_package_id: packageId,
    p_credits_remaining: credits,
    p_expiration_date: expirationDate,
    p_authorization_code: authorizationCode,
    p_transaction_data: paymentResult,
    p_transaction_id: paymentResult.transaction?.id || null
  });

  if (error) {
    console.error('Error en transacción atómica:', error);
    throw new Error(`Error atómico registrando compra: ${error.message}`);
  }

  console.log('✅ Compra y transacción creadas atómicamente');
}

// Función ATÓMICA para crear compra de menu y actualizar transacción
async function createMenuPurchaseAndUpdateTransaction(
  idempotencyId: string,
  userId: string,
  menuItems: MenuPurchaseItem[],
  totalPaid: number,
  authorizationCode: string,
  paymentResult: any
): Promise<void> {
  // Convertir menuItems al formato esperado por la RPC
  const itemsForRPC = menuItems.map(item => ({
    menu_item_id: item.menuItemId,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    name: item.name
  }));

  // Ejecutar transacción atómica usando PostgreSQL
  const { error } = await supabase.rpc('create_menu_purchase_atomic', {
    p_idempotency_id: idempotencyId,
    p_user_id: userId,
    p_items: itemsForRPC,
    p_total_paid: totalPaid,
    p_authorization_code: authorizationCode,
    p_transaction_data: paymentResult,
    p_transaction_id: paymentResult.transaction?.id || null
  });

  if (error) {
    console.error('Error en transacción atómica de menu:', error);
    throw new Error(`Error atómico registrando compra de menu: ${error.message}`);
  }

  console.log('✅ Compra de menu y transacción creadas atómicamente');
}

// Función para crear registro de compra (LEGACY - mantener para compatibilidad)
async function createPurchaseRecord(
  userId: string,
  packageId: string,
  packageData: any,
  credits: number,
  authorizationCode: string
) {
  let expirationDate: string | null = null;
  if (packageData.expiration_days && typeof packageData.expiration_days === 'number') {
    const today = new Date();
    expirationDate = new Date(today.setDate(today.getDate() + packageData.expiration_days)).toISOString();
  }

  const { error } = await supabase
    .from('purchases')
    .insert({
      user_id: userId,
      package_id: packageId,
      credits_remaining: credits,
      purchase_date: new Date().toISOString(),
      expiration_date: expirationDate,
      authorization_code: authorizationCode,
    });

  if (error) {
    console.error('Error creating purchase record:', error);
    throw new Error('Error registrando la compra');
  }
}

export const processNuveiPayment = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const body: PaymentRequest = req.body;
    const { packageId, cardToken, amount, description, vat, credits, menuItems, purchaseType = 'package' } = body;

    // Validaciones básicas
    if (!cardToken || !amount || !description) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: cardToken, amount, description'
      });
    }

    // Validaciones específicas por tipo de compra
    if (purchaseType === 'package') {
      if (!packageId) {
        return res.status(400).json({
          success: false,
          error: 'packageId is required for package purchases'
        });
      }
    } else if (purchaseType === 'menu') {
      if (!menuItems || !Array.isArray(menuItems) || menuItems.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'menuItems array is required for menu purchases'
        });
      }
      
      // Validar cada item del menu
      for (const item of menuItems) {
        if (!item.menuItemId || !item.quantity || !item.unitPrice || !item.name) {
          return res.status(400).json({
            success: false,
            error: 'Each menu item must have menuItemId, quantity, unitPrice, and name'
          });
        }
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'purchaseType must be either "package" or "menu"'
      });
    }

    // Calcular VAT (IVA del 15% en Ecuador)
    // Asumiendo que 'amount' es el monto total incluyendo IVA
    const TAX_PERCENTAGE = 15;
    const taxableAmount = Math.round((amount / 1.15) * 100) / 100; // Monto sin IVA
    const calculatedVat = Math.round((amount - taxableAmount) * 100) / 100; // IVA calculado

    // Obtener la cédula del usuario
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', user.id)
      .single();

    if (userError || !userData?.username) {
      throw new Error('User username not found');
    }

    // Obtener información del paquete o menu según el tipo
    let packageData = null;
    let menuData = null;

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
    } else if (purchaseType === 'menu') {
      // Validar que todos los menu items existan
      const menuItemIds = menuItems!.map(item => item.menuItemId);
      const { data: menuItemsData, error: menuError } = await supabase
        .from('menu')
        .select('*')
        .in('id', menuItemIds);

      if (menuError || !menuItemsData || menuItemsData.length !== menuItemIds.length) {
        throw new Error('One or more menu items not found');
      }
      menuData = menuItemsData;
    }

    // Generar ID de idempotencia
    const idempotencyId = generateIdempotencyId(
      user.id, 
      packageId || menuItems?.map(i => i.menuItemId).join(',') || '', 
      cardToken, 
      amount
    );

    // Verificar y crear lock de transacción
    const transactionLock = await checkAndCreateTransactionLock(
      idempotencyId, 
      user.id, 
      packageId, 
      purchaseType
    );

    if (!transactionLock.canProceed) {
      if (transactionLock.existingTransaction) {
        // Retornar transacción exitosa existente
        return res.status(200).json({
          success: true,
          message: 'Payment already completed',
          transaction: transactionLock.existingTransaction.transaction_data
        });
      } else {
        // Transacción en progreso
        return res.status(409).json({
          success: false,
          error: 'Payment already in progress'
        });
      }
    }

    try {
      // Crear token de autenticación
      const authToken = createNuveiAuthToken();

      // Preparar datos del pago
      const paymentPayload = {
        user: {
          id: userData.username,
          email: user.email || ''
        },
        order: {
          amount: amount,
          vat: calculatedVat,
          taxable_amount: taxableAmount,
          tax_percentage: TAX_PERCENTAGE,
          description: description,
          dev_reference: idempotencyId,
          installments: 1
        },
        card: {
          token: cardToken
        }
      };

      console.log('💳 Procesando pago con Nuvei:', {
        amount,
        taxableAmount,
        calculatedVat,
        taxPercentage: TAX_PERCENTAGE,
        userId: user.id,
        packageId,
        idempotencyId
      });

      const nuveiBaseUrl = process.env.NUVEI_BASE_URL || 'https://ccapi-stg.paymentez.com';
      const paymentUrl = `${nuveiBaseUrl}/v2/transaction/debit`;

      const response = await fetch(paymentUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Auth-Token': authToken,
        },
        body: JSON.stringify(paymentPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Nuvei payment error: ${response.status} - ${errorText}`);
      }

      const paymentResult: NuveiPaymentResponse = await response.json() as NuveiPaymentResponse;

      console.log('💰 Respuesta de pago Nuvei:', {
        transactionId: paymentResult.transaction?.id,
        status: paymentResult.transaction?.status,
        message: paymentResult.transaction?.message
      });

      // Verificar si el pago fue exitoso
      if (paymentResult.transaction?.status === 'success') {
        console.log('💰 Pago exitoso - iniciando transacción atómica');
        
        try {
          // SOLUCIÓN ATÓMICA: Crear compra y actualizar estado en una sola transacción
          if (purchaseType === 'package') {
            await createPurchaseAndUpdateTransaction(
              idempotencyId,
              user.id,
              packageId!,
              packageData!,
              credits || packageData!.class_credits,
              paymentResult.transaction.authorization_code || '',
              paymentResult
            );
          } else if (purchaseType === 'menu') {
            await createMenuPurchaseAndUpdateTransaction(
              idempotencyId,
              user.id,
              menuItems!,
              amount,
              paymentResult.transaction.authorization_code || '',
              paymentResult
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
              amount: amount,
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
              authorizationCode: paymentResult.transaction.authorization_code || ''
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
                unitPrice: item.unitPrice
              })),
              totalAmount: amount,
              purchaseDate: new Date().toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }),
              authorizationCode: paymentResult.transaction.authorization_code || ''
            });
          }

          if (!emailResult.success) {
            console.error('⚠️ Error enviando email de compra (no afecta la transacción):', emailResult.error);
          } else {
            console.log('✅ Email de compra enviado exitosamente:', emailResult.messageId);
          }

          return res.status(200).json({
            success: true,
            transaction: paymentResult,
            emailSent: emailResult.success
          });

        } catch (atomicError: any) {
          console.error('❌ Error en transacción atómica:', atomicError);
          
          // Si falla la transacción atómica, marcar como fallida
          await updateTransactionStatus(
            idempotencyId, 
            'failed', 
            paymentResult, 
            `Atomic transaction failed: ${atomicError.message}`
          );

          return res.status(500).json({
            success: false,
            error: 'Error procesando la compra después del pago exitoso. Contacte soporte.',
            transaction_id: paymentResult.transaction?.id
          });
        }

      } else if (paymentResult.transaction?.status === 'pending' && 
                 (paymentResult.transaction?.message?.includes('OTP') || 
                  paymentResult.transaction?.carrier_code === 'WAITING_OTP')) {
        // Requiere OTP
        await updateTransactionStatus(idempotencyId, 'pending_otp', paymentResult);

        return res.status(200).json({
          success: false,
          otp_required: true,
          transaction_id: paymentResult.transaction.id,
          message: paymentResult.transaction.message || 'OTP requerido',
          carrier_code: paymentResult.transaction.carrier_code
        });

      } else {
        // Pago falló
        await updateTransactionStatus(
          idempotencyId, 
          'failed', 
          paymentResult, 
          paymentResult.transaction?.message
        );

        return res.status(400).json({
          success: false,
          error: paymentResult.transaction?.message || 'Payment failed',
          transaction: paymentResult
        });
      }

    } catch (paymentError: any) {
      // Actualizar transacción como fallida
      await updateTransactionStatus(idempotencyId, 'failed', null, paymentError.message);
      throw paymentError;
    }

  } catch (error: any) {
    console.error('❌ Error en process-nuvei-payment:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error procesando el pago'
    });
  }
}; 