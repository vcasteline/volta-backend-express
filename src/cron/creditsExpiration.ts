import { Request, Response } from 'express';
import { supabase } from '../index';

export const creditsExpirationCron = async (req: Request, res: Response) => {
  try {
    console.log('💳 Iniciando proceso de notificaciones de créditos por expirar...');

    // Calcular la fecha objetivo (2 días desde hoy)
    const now = new Date();
    const twoDaysFromNow = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000)); // +2 días
    const targetDate = twoDaysFromNow.toISOString().split('T')[0]; // YYYY-MM-DD

    console.log(`🎯 Buscando créditos que expiran el ${targetDate}`);

    // Buscar compras con créditos que expiran en exactamente 2 días
    const { data: expiringPurchases, error: purchasesError } = await supabase
      .from('purchases')
      .select(`
        id,
        user_id,
        credits_remaining,
        expiration_date,
        package:packages(name, class_credits)
      `)
      .eq('expiration_date', targetDate)
      .gt('credits_remaining', 0) // Solo las que tienen créditos restantes
      .order('user_id');

    if (purchasesError) {
      throw new Error(`Error obteniendo compras: ${purchasesError.message}`);
    }

    if (!expiringPurchases || expiringPurchases.length === 0) {
      console.log('ℹ️ No hay créditos que expiren en 2 días');
      const result = {
        success: true, 
        message: 'No credits expiring in 2 days',
        purchasesFound: 0,
        notificationsSent: 0
      };
      
      // Solo responder si res es válido (endpoint HTTP)
      if (res && typeof res.status === 'function') {
        return res.status(200).json(result);
      }
      return result;
    }

    console.log(`💰 Encontradas ${expiringPurchases.length} compra(s) con créditos que expiran en 2 días`);

    // Agrupar compras por usuario para enviar una sola notificación por usuario
    const userPurchases = new Map();
    
    expiringPurchases.forEach((purchase: any) => {
      const userId = purchase.user_id;
      if (!userPurchases.has(userId)) {
        userPurchases.set(userId, []);
      }
      userPurchases.get(userId).push(purchase);
    });

    console.log(`👥 Notificaciones para ${userPurchases.size} usuario(s) únicos`);

    let totalNotificationsSent = 0;

    // Procesar cada usuario
    for (const [userId, purchases] of userPurchases) {
      const totalCreditsExpiring = purchases.reduce((sum: number, p: any) => sum + p.credits_remaining, 0);
      const packageNames = [...new Set(purchases.map((p: any) => p.package?.name).filter(Boolean))];
      
      console.log(`🔄 Procesando usuario ${userId}: ${totalCreditsExpiring} créditos expirando`);

      // Crear mensaje personalizado
      let notificationBody = '';
      if (totalCreditsExpiring === 1) {
        notificationBody = `Tienes ${totalCreditsExpiring} crédito que expira en 2 días`;
      } else {
        notificationBody = `Tienes ${totalCreditsExpiring} créditos que expiran en 2 días`;
      }

      if (packageNames.length > 0) {
        notificationBody += ` de ${packageNames.join(', ')}`;
      }

      notificationBody += '. ¡Úsalos antes de que expiren! 🚴‍♀️';

      // Preparar payload para notificación
      const notificationPayload = {
        userIds: [userId],
        title: "⏰ Tus créditos expiran pronto",
        body: notificationBody,
        data: {
          type: 'credits_expiring',
          creditsExpiring: totalCreditsExpiring,
          expirationDate: targetDate,
          packages: packageNames
        },
        priority: 'high'
      };

      // Enviar notificación
      try {
        // Construir URL completa con protocolo correcto
        let serverUrl = process.env.SERVER_URL || 'http://localhost:3000';
        if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
          serverUrl = `https://${serverUrl}`;
        }
        
        const notificationResponse = await fetch(`${serverUrl}/api/send-push-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-service-key': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
          },
          body: JSON.stringify(notificationPayload)
        });

        if (!notificationResponse.ok) {
          const errorText = await notificationResponse.text();
          console.error(`Error enviando notificación para usuario ${userId}:`, errorText);
          continue;
        }

        const notificationResult = await notificationResponse.json() as any;
        const sent = notificationResult.messagesSent || 0;
        totalNotificationsSent += sent;

        console.log(`✅ Enviada notificación a usuario ${userId} (${totalCreditsExpiring} créditos)`);
        
      } catch (notificationError) {
        console.error(`Error enviando notificación para usuario ${userId}:`, notificationError);
      }
    }

    console.log(`🎉 Proceso completado. Total de notificaciones enviadas: ${totalNotificationsSent}`);

    const result = {
      success: true,
      message: `Credits expiration notifications processed successfully`,
      purchasesFound: expiringPurchases.length,
      usersNotified: userPurchases.size,
      notificationsSent: totalNotificationsSent,
      expirationDate: targetDate,
      userSummary: Array.from(userPurchases.entries()).map(([userId, purchases]: [string, any[]]) => ({
        userId,
        totalCredits: purchases.reduce((sum: number, p: any) => sum + p.credits_remaining, 0),
        purchasesCount: purchases.length
      }))
    };

    // Solo responder si res es válido (endpoint HTTP)
    if (res && typeof res.status === 'function') {
      return res.status(200).json(result);
    }
    return result;

  } catch (error: any) {
    console.error('❌ Error en notificaciones de expiración de créditos:', error);
    
    const errorResult = {
      success: false,
      error: error.message || 'Error desconocido'
    };

    // Solo responder si res es válido (endpoint HTTP)
    if (res && typeof res.status === 'function') {
      return res.status(500).json(errorResult);
    }
    throw error; // Re-lanzar el error para cron jobs
  }
}; 