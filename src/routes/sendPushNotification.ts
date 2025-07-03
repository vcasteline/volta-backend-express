import { Request, Response } from 'express';
import { supabase } from '../index';
import { serviceKeyMiddleware } from '../middleware/auth';

interface NotificationRequest {
  userIds: string[];
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  priority?: 'default' | 'normal' | 'high' | 'max';
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: string;
  priority?: string;
  channelId?: string;
}

async function sendPushNotifications(messages: ExpoPushMessage[]) {
  const EXPO_ACCESS_TOKEN = process.env.EXPO_ACCESS_TOKEN;
  
  if (!EXPO_ACCESS_TOKEN) {
    throw new Error('EXPO_ACCESS_TOKEN not configured');
  }

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${EXPO_ACCESS_TOKEN}`,
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to send push notification: ${response.status} ${errorText}`);
  }

  return await response.json();
}

export const sendPushNotification = [
  serviceKeyMiddleware,
  async (req: Request, res: Response) => {
    try {
      const body: NotificationRequest = req.body;
      const { userIds, title, body: notificationBody, data, sound = 'default', priority = 'default' } = body;

      // Validaciones
      if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'userIds array is required and cannot be empty'
        });
      }

      if (!title || !notificationBody) {
        return res.status(400).json({
          success: false,
          error: 'title and body are required'
        });
      }

      console.log(`📱 Enviando notificaciones a ${userIds.length} usuario(s):`);
      console.log(`📋 Título: ${title}`);
      console.log(`💬 Mensaje: ${notificationBody}`);

      // Obtener tokens de push de los usuarios
      const { data: pushTokens, error: tokensError } = await supabase
        .from('user_push_tokens')
        .select('push_token, user_id')
        .in('user_id', userIds)
        .eq('is_active', true);

      if (tokensError) {
        console.error('Error obteniendo push tokens:', tokensError);
        throw new Error('Error obteniendo push tokens');
      }

      if (!pushTokens || pushTokens.length === 0) {
        console.log('⚠️ No se encontraron tokens de push para los usuarios especificados');
        return res.status(200).json({
          success: true, 
          message: 'No push tokens found for specified users',
          tokensFound: 0,
          messagesSent: 0
        });
      }

      // Preparar mensajes para Expo
      const messages: ExpoPushMessage[] = pushTokens.map(tokenData => ({
        to: tokenData.push_token,
        title,
        body: notificationBody,
        data: data || {},
        sound,
        priority,
        channelId: 'default',
      }));

      console.log(`🚀 Enviando ${messages.length} notificaciones a Expo...`);

      // Enviar notificaciones
      const result = await sendPushNotifications(messages);

      console.log('✅ Notificaciones enviadas exitosamente:', result);

      return res.status(200).json({
        success: true,
        message: `Notifications sent to ${messages.length} devices`,
        tokensFound: pushTokens.length,
        messagesSent: messages.length,
        expoResponse: result,
      });

    } catch (error: any) {
      console.error('❌ Error enviando notificaciones:', error);
      
      return res.status(500).json({
        success: false,
        error: error.message || 'Error desconocido enviando notificaciones'
      });
    }
  }
]; 