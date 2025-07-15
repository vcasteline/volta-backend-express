import { Resend } from 'resend';

// Variables para inicialización lazy
let resend: Resend | null = null;
let resendApiKey: string | undefined = undefined;

// Función para inicializar Resend solo cuando se necesite
function getResendClient(): { resend: Resend; apiKey: string } {
  if (!resend || !resendApiKey) {
    resendApiKey = process.env.RESEND_API_KEY;
    
    if (!resendApiKey) {
      console.error('❌ RESEND_API_KEY no está configurada en las variables de entorno');
      console.log('📝 Variables de entorno disponibles:', Object.keys(process.env).filter(key => key.includes('RESEND')));
      throw new Error('RESEND_API_KEY no está configurada');
    }
    
    resend = new Resend(resendApiKey);
    console.log('✅ Resend inicializado correctamente');
  }
  
  return { resend, apiKey: resendApiKey };
}

// Email domain configurado
const FROM_EMAIL = 'no-reply@transactional.giroadmin.com';

export interface EmailUser {
  email: string;
  name?: string;
}

export interface PurchaseEmailData {
  user: EmailUser;
  packageName: string;
  credits: number;
  amount: number;
  purchaseDate: string;
  expirationDate?: string;
  authorizationCode: string;
}

export interface ReservationEmailData {
  user: EmailUser;
  className: string;
  classDate: string;
  classTime: string;
  instructorName: string;
  reservationDate: string;
  bikeNumbers?: string[];
}

export interface PasswordResetEmailData {
  user: EmailUser;
  resetToken: string;
  resetUrl: string;
}

export interface PasswordResetCodeEmailData {
  user: EmailUser;
  resetCode: string;
  expiresInMinutes: number;
}

// Email templates
const createPurchaseEmailTemplate = (data: PurchaseEmailData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Compra Confirmada - Giro</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #6658C1 0%, #B6FF1C 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: white;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-radius: 0 0 10px 10px;
        }
        .purchase-details {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .highlight {
          color: #6658C1;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          color: #666;
        }
        .btn {
          display: inline-block;
          background: #6658C1;
          color: white;
          padding: 12px 24px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>¡Compra Confirmada! 🎉</h1>
        <p>Gracias por tu compra en Giro</p>
      </div>
      
      <div class="content">
        <h2>Hola ${data.user.name || 'Rider'}!</h2>
        
        <p>¡Tu compra ha sido procesada exitosamente! Ya puedes empezar a reservar tus clases.</p>
        
        <div class="purchase-details">
          <h3>Detalles de tu compra:</h3>
          <p><strong>Paquete:</strong> ${data.packageName}</p>
          <p><strong>Créditos:</strong> <span class="highlight">${data.credits} clases</span></p>
          <p><strong>Valor:</strong> $${data.amount.toFixed(2)}</p>
          <p><strong>Fecha de compra:</strong> ${data.purchaseDate}</p>
          ${data.expirationDate ? `<p><strong>Expiran el:</strong> ${data.expirationDate}</p>` : ''}
          <p><strong>Código de autorización:</strong> ${data.authorizationCode}</p>
        </div>
        
        <p>Puedes usar tus créditos para reservar clases en cualquier momento. ¡Nos vemos en el estudio! 🚴‍♀️</p>
        
        <div class="footer">
          <p>¿Necesitas ayuda? Contáctanos en <strong>info@giroadmin.com</strong></p>
          <p>Giro Studio - Tu estudio de spinning favorito</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const createReservationEmailTemplate = (data: ReservationEmailData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reserva Confirmada - Giro</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #6658C1 0%, #B6FF1C 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: white;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-radius: 0 0 10px 10px;
        }
        .class-details {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
        }
        .highlight {
          color: #6658C1;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          color: #666;
        }
        .bikes {
          background: #B6FF1C;
          color: #333;
          padding: 8px 12px;
          border-radius: 6px;
          display: inline-block;
          margin: 5px 0;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>¡Reserva Confirmada! 🚴‍♀️</h1>
        <p>Te esperamos en el estudio</p>
      </div>
      
      <div class="content">
        <h2>Hola ${data.user.name || 'Rider'}!</h2>
        
        <p>Tu reserva ha sido confirmada exitosamente. ¡Prepárate para una clase increíble!</p>
        
        <div class="class-details">
          <h3>Detalles de tu clase:</h3>
          <p><strong>Clase:</strong> ${data.className || `Giro con ${data.instructorName}`}</p>
          <p><strong>Instructor:</strong> <span class="highlight">${data.instructorName}</span></p>
          <p><strong>Fecha:</strong> ${data.classDate}</p>
          <p><strong>Hora:</strong> ${data.classTime}</p>
          ${data.bikeNumbers && data.bikeNumbers.length > 0 ? 
            `<p><strong>Bicicletas:</strong> <span class="bikes">${data.bikeNumbers.join(', ')}</span></p>` : 
            ''
          }
          <p><strong>Reservado el:</strong> ${data.reservationDate}</p>
        </div>
        
        <p><strong>Recordatorio:</strong> Llega 15 minutos antes de la clase para el check-in. ¡Trae tu botella de agua y toalla!</p>
        
        <div class="footer">
          <p>¿Necesitas cancelar o modificar tu reserva? Contáctanos en <strong>info@giroadmin.com</strong></p>
          <p>Giro Studio - Tu estudio de spinning favorito</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const createPasswordResetEmailTemplate = (data: PasswordResetEmailData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recuperar Contraseña - Giro</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #6658C1 0%, #B6FF1C 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: white;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-radius: 0 0 10px 10px;
        }
        .btn {
          display: inline-block;
          background: #6658C1;
          color: white;
          padding: 15px 30px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          color: #666;
        }
        .warning {
          background: #fff3cd;
          color: #856404;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          border: 1px solid #ffeaa7;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Recuperar Contraseña</h1>
        <p>Restablecer tu contraseña de Giro</p>
      </div>
      
      <div class="content">
        <h2>Hola ${data.user.name || 'Rider'}!</h2>
        
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Giro.</p>
        
        <p>Haz clic en el botón de abajo para crear una nueva contraseña:</p>
        
        <div style="text-align: center;">
          <a href="${data.resetUrl}" class="btn">Cambiar Contraseña</a>
        </div>
        
        <div class="warning">
          <p><strong>⚠️ Importante:</strong></p>
          <ul>
            <li>Este enlace expira en 1 hora</li>
            <li>Solo puedes usar este enlace una vez</li>
            <li>Si no solicitaste este cambio, puedes ignorar este email</li>
          </ul>
        </div>
        
        <p>Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:</p>
        <p style="word-break: break-all; color: #666;"><small>${data.resetUrl}</small></p>
        
        <div class="footer">
          <p>¿Necesitas ayuda? Contáctanos en <strong>info@giroadmin.com</strong></p>
          <p>Giro Studio - Tu estudio de spinning favorito</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

const createPasswordResetCodeEmailTemplate = (data: PasswordResetCodeEmailData): string => {
  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Código de Recuperación - Giro</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #6658C1 0%, #B6FF1C 100%);
          color: white;
          padding: 30px;
          text-align: center;
          border-radius: 10px 10px 0 0;
        }
        .content {
          background: white;
          padding: 30px;
          border: 1px solid #e0e0e0;
          border-radius: 0 0 10px 10px;
          text-align: center;
        }
        .code-container {
          background: #f8f9fa;
          border: 2px solid #6658C1;
          border-radius: 12px;
          padding: 30px;
          margin: 30px 0;
          text-align: center;
        }
        .code {
          font-size: 36px;
          font-weight: bold;
          color: #6658C1;
          letter-spacing: 8px;
          margin: 10px 0;
          font-family: 'Courier New', monospace;
        }
        .warning {
          background: #fff3cd;
          color: #856404;
          padding: 15px;
          border-radius: 8px;
          margin: 20px 0;
          border: 1px solid #ffeaa7;
          text-align: left;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e0e0e0;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>Código de Recuperación</h1>
        <p>Restablecer tu contraseña de Giro</p>
      </div>
      
      <div class="content">
        <h2>Hola ${data.user.name || 'Rider'}!</h2>
        
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en Giro.</p>
        
        <p>Ingresa el siguiente código de verificación en la app:</p>
        
        <div class="code-container">
          <p style="margin: 0; font-size: 14px; color: #666;">Tu código de verificación es:</p>
          <div class="code">${data.resetCode}</div>
        </div>
        
        <div class="warning">
          <p><strong>⚠️ Importante:</strong></p>
          <ul>
            <li>Este código expira en ${data.expiresInMinutes} minutos</li>
            <li>Solo puedes usar este código una vez</li>
            <li>Si no solicitaste este cambio, puedes ignorar este email</li>
            <li>No compartas este código con nadie</li>
          </ul>
        </div>
        
        <p>Si no solicitaste este cambio, tu cuenta permanece segura y puedes ignorar este email.</p>
        
        <div class="footer">
          <p>¿Necesitas ayuda? Contáctanos en <strong>info@giroadmin.com</strong></p>
          <p>Giro Studio - Tu estudio de spinning favorito</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Funciones para enviar emails
export async function sendPurchaseConfirmationEmail(data: PurchaseEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { resend } = getResendClient();
    console.log('📧 Enviando email de confirmación de compra a:', data.user.email);
    
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.user.email],
      subject: `¡Compra confirmada! ${data.packageName} - Giro`,
      html: createPurchaseEmailTemplate(data),
    });

    if (error) {
      console.error('❌ Error enviando email de compra:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email de compra enviado exitosamente:', result?.id);
    return { success: true, messageId: result?.id };
    
  } catch (error: any) {
    console.error('❌ Error enviando email de compra:', error);
    return { success: false, error: error.message };
  }
}

export async function sendReservationConfirmationEmail(data: ReservationEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { resend } = getResendClient();
    console.log('📧 Enviando email de confirmación de reserva a:', data.user.email);
    
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.user.email],
      subject: `Reserva confirmada: ${data.className || `Giro con ${data.instructorName}`} - Giro`,
      html: createReservationEmailTemplate(data),
    });

    if (error) {
      console.error('❌ Error enviando email de reserva:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email de reserva enviado exitosamente:', result?.id);
    return { success: true, messageId: result?.id };
    
  } catch (error: any) {
    console.error('❌ Error enviando email de reserva:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetEmail(data: PasswordResetEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { resend } = getResendClient();
    console.log('📧 Enviando email de recuperación de contraseña a:', data.user.email);
    
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.user.email],
      subject: 'Recuperar contraseña - Giro',
      html: createPasswordResetEmailTemplate(data),
    });

    if (error) {
      console.error('❌ Error enviando email de recuperación:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email de recuperación enviado exitosamente:', result?.id);
    return { success: true, messageId: result?.id };
    
  } catch (error: any) {
    console.error('❌ Error enviando email de recuperación:', error);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetCodeEmail(data: PasswordResetCodeEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { resend } = getResendClient();
    console.log('📧 Enviando código de recuperación de contraseña a:', data.user.email);
    
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.user.email],
      subject: 'Código de recuperación - Giro',
      html: createPasswordResetCodeEmailTemplate(data),
    });

    if (error) {
      console.error('❌ Error enviando código de recuperación:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Código de recuperación enviado exitosamente:', result?.id);
    return { success: true, messageId: result?.id };
    
  } catch (error: any) {
    console.error('❌ Error enviando código de recuperación:', error);
    return { success: false, error: error.message };
  }
} 