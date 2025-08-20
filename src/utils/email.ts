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
const FROM_EMAIL = 'no-reply@transactional.voltaec.com';

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

export interface MenuPurchaseItem {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface MenuPurchaseEmailData {
  user: EmailUser;
  items: MenuPurchaseItem[];
  totalAmount: number;
  purchaseDate: string;
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
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Confirmación de Compra</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
      </style>
    </head>
    <body style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #e9e9e9; color: #333333; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #e9e9e9;">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom: 30px;">
                  <img src="https://mt5159g3si.ufs.sh/f/yBjaix5tW5pfBPQURnKdJoRQbl2LZmCtSih9E6FaWHqkPp5U" alt="Volta Logo" width="60" style="display: block;">
                </td>
              </tr>
              
              <!-- Título -->
              <tr>
                <td align="center" style="padding-bottom: 50px;">
                  <h1 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 28px; font-weight: 600; margin: 0;">¡Gracias por tu compra!</h1>
                </td>
              </tr>
              
              <!-- Información de la compra en bloques -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #f8f9fa; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">Detalles de tu compra</h2>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Nombre:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${data.user.name || 'Cliente'}</span>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Paquete:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${data.credits} clases</span>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Fecha de compra:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${data.purchaseDate}</span>
                        </div>
                        
                        ${data.expirationDate ? `
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Fecha de expiración:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${data.expirationDate}</span>
                        </div>
                        ` : ''}
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Código de autorización:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${data.authorizationCode}</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Cómo usar en un bloque -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #e8f4ff; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">¿Cómo usar tus clases?</h2>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; margin-bottom: 15px;">
                          Tus ${data.credits} clases ya están disponibles en tu cuenta. Para reservar:
                        </p>
                        
                        <ol style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; margin-top: 10px; padding-left: 25px;">
                          <li style="margin-bottom: 8px;">Ingresa a la app de Volta</li>
                          <li style="margin-bottom: 8px;">Selecciona la fecha y hora que prefieras</li>
                          <li style="margin-bottom: 8px;">Elige tu bicicleta favorita</li>
                          <li style="margin-bottom: 8px;">¡Listo! Te esperamos en clase</li>
                        </ol>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="text-align: center; padding-top: 20px;">
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                    Si tienes alguna pregunta, contáctanos por WhatsApp al <a href="https://wa.me/593964193931" style="color: #3D4AF5; text-decoration: none;">+593 96 419 3931</a>
                  </p>
                  
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px; color: #777777;">
                    &copy; ${new Date().getFullYear()} Volta. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const createReservationEmailTemplate = (data: ReservationEmailData): string => {
  const bicyclesList = data.bikeNumbers || [];
  const fechaReserva = data.classDate;
  const horaReserva = data.classTime;
  const instructorName = data.instructorName;

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Confirmación de Reserva</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
      </style>
    </head>
    <body style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #e9e9e9; color: #333333; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #e9e9e9;">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom: 30px;">
                  <img src="https://mt5159g3si.ufs.sh/f/yBjaix5tW5pfBPQURnKdJoRQbl2LZmCtSih9E6FaWHqkPp5U" alt="Volta Logo" width="60" style="display: block;">
                </td>
              </tr>
              
              <!-- Título -->
              <tr>
                <td align="center" style="padding-bottom: 50px;">
                  <h1 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 28px; font-weight: 600; margin: 0;">Lista para dar una Volta</h1>
                </td>
              </tr>
              
              <!-- Información de reserva -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #f8f9fa; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">Detalles de tu reserva</h2>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Bici${bicyclesList.length > 1 ? 's' : ''}:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${bicyclesList.length > 0 ? bicyclesList.join(', ') : '?'}</span>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Día:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${fechaReserva}</span>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Hora:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${horaReserva}</span>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Instructor:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${instructorName}</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Políticas en bloques -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #e8f4ff; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">Políticas importantes</h2>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                          Recuerda que puedes cancelar tu clase hasta 12 horas antes de la clase reservada, caso contrario perderás el crédito de ese booking.
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                          Por respeto a nuestros coaches y a nuestros riders pedimos puntualidad ya que no podemos interrumpir la sesión en curso. Ten presente que <span style="font-weight: 700; font-style: italic;">tu bici será liberada 4 minutos antes de que inicie la clase.</span>
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                          Para que todos disfrutemos de la sesión no se permite el uso de teléfonos celulares dentro del estudio.
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                          Por seguridad, los créditos no son transferibles. Asegúrate de reservar tu bici desde tu perfil creado en nuestra app.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="text-align: center; padding-top: 20px;">
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                    Si tienes alguna pregunta, contáctanos por WhatsApp al <a href="https://wa.me/593964193931" style="color: #3D4AF5; text-decoration: none;">+593 96 419 3931</a>
                  </p>
                  
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px; color: #777777;">
                    &copy; ${new Date().getFullYear()} Volta. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Recuperar Contraseña</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
      </style>
    </head>
    <body style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #e9e9e9; color: #333333; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #e9e9e9;">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom: 30px;">
                  <img src="https://mt5159g3si.ufs.sh/f/yBjaix5tW5pfBPQURnKdJoRQbl2LZmCtSih9E6FaWHqkPp5U" alt="Volta Logo" width="60" style="display: block;">
                </td>
              </tr>
              
              <!-- Título -->
              <tr>
                <td align="center" style="padding-bottom: 50px;">
                  <h1 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 28px; font-weight: 600; margin: 0;">Recuperar contraseña</h1>
                </td>
              </tr>
              
              <!-- Contenido principal -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #f8f9fa; border-radius: 12px; padding: 25px;">
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; margin-bottom: 20px; margin-top: 0;">
                          Hola <strong>${data.user.name || 'Cliente'}</strong>,
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                          Recibimos una solicitud para restablecer la contraseña de tu cuenta en Volta.
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
                          Haz clic en el botón de abajo para crear una nueva contraseña:
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                          <a href="${data.resetUrl}" style="display: inline-block; background-color: #3D4AF5; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-family: 'Work Sans', Arial, sans-serif; font-size: 16px; font-weight: 600;">Cambiar Contraseña</a>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Información importante -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #e8f4ff; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">⚠️ Información importante</h2>
                        
                        <ul style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                          <li style="margin-bottom: 8px;">Este enlace expira en 1 hora</li>
                          <li style="margin-bottom: 8px;">Solo puedes usar este enlace una vez</li>
                          <li style="margin-bottom: 8px;">Si no solicitaste este cambio, puedes ignorar este email</li>
                        </ul>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-top: 15px; margin-bottom: 0;">
                          Si el botón no funciona, puedes copiar y pegar este enlace en tu navegador:
                        </p>
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 12px; word-break: break-all; color: #666; margin: 10px 0 0 0;">
                          ${data.resetUrl}
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="text-align: center; padding-top: 20px;">
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                    Si tienes alguna pregunta, contáctanos por WhatsApp al <a href="https://wa.me/593964193931" style="color: #3D4AF5; text-decoration: none;">+593 96 419 3931</a>
                  </p>
                  
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px; color: #777777;">
                    &copy; ${new Date().getFullYear()} Volta. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
};

const createMenuPurchaseEmailTemplate = (data: MenuPurchaseEmailData): string => {
  const itemsHtml = data.items.map(item => `
    <div style="margin-bottom: 15px;">
      <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">${item.quantity}x ${item.name}</strong>
      <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px; float: right;">$${(item.quantity * item.unitPrice).toFixed(2)}</span>
      <div style="clear: both;"></div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Confirmación de Pedido</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
      </style>
    </head>
    <body style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #e9e9e9; color: #333333; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #e9e9e9;">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom: 30px;">
                  <img src="https://mt5159g3si.ufs.sh/f/yBjaix5tW5pfBPQURnKdJoRQbl2LZmCtSih9E6FaWHqkPp5U" alt="Volta Logo" width="60" style="display: block;">
                </td>
              </tr>
              
              <!-- Título -->
              <tr>
                <td align="center" style="padding-bottom: 50px;">
                  <h1 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 28px; font-weight: 600; margin: 0;">¡Tu pedido está confirmado!</h1>
                </td>
              </tr>
              
              <!-- Información del pedido -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #f8f9fa; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">Detalles de tu pedido</h2>
                        
                        ${itemsHtml}
                        
                        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 700; font-size: 18px;">Total:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 700; font-size: 18px; float: right;">$${data.totalAmount.toFixed(2)}</span>
                          <div style="clear: both;"></div>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Fecha:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${data.purchaseDate}</span>
                        </div>
                        
                        <div style="margin-bottom: 15px;">
                          <strong style="font-family: 'Work Sans', Arial, sans-serif; font-weight: 600; font-size: 16px;">Código de autorización:</strong> 
                          <span style="font-family: 'Work Sans', Arial, sans-serif; font-size: 16px;">${data.authorizationCode}</span>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Información de recogida -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #e8f4ff; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">Información importante</h2>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                          Tu pedido estará listo para recoger en aproximadamente <span style="font-weight: 700;">15-20 minutos</span>.
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                          Te notificaremos cuando esté listo para recoger en recepción.
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                          ¡Gracias por tu compra y por ser parte de la familia Volta! 🥤
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="text-align: center; padding-top: 20px;">
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                    Si tienes alguna pregunta, contáctanos por WhatsApp al <a href="https://wa.me/593964193931" style="color: #3D4AF5; text-decoration: none;">+593 96 419 3931</a>
                  </p>
                  
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px; color: #777777;">
                    &copy; ${new Date().getFullYear()} Volta. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
      <meta name="color-scheme" content="light">
      <meta name="supported-color-schemes" content="light">
      <title>Código de Recuperación</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Work+Sans:wght@400;500;600;700&display=swap');
      </style>
    </head>
    <body style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; margin: 0; padding: 0; background-color: #e9e9e9; color: #333333; -webkit-font-smoothing: antialiased;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td align="center" style="padding: 40px 20px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; background-color: #e9e9e9;">
              <!-- Logo -->
              <tr>
                <td align="center" style="padding-bottom: 30px;">
                  <img src="https://mt5159g3si.ufs.sh/f/yBjaix5tW5pfBPQURnKdJoRQbl2LZmCtSih9E6FaWHqkPp5U" alt="Volta Logo" width="60" style="display: block;">
                </td>
              </tr>
              
              <!-- Título -->
              <tr>
                <td align="center" style="padding-bottom: 50px;">
                  <h1 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 28px; font-weight: 600; margin: 0;">Código de recuperación</h1>
                </td>
              </tr>
              
              <!-- Contenido principal -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #f8f9fa; border-radius: 12px; padding: 25px; text-align: center;">
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; margin-bottom: 20px; margin-top: 0;">
                          Hola <strong>${data.user.name || 'Cliente'}</strong>,
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; margin-bottom: 20px;">
                          Recibimos una solicitud para restablecer la contraseña de tu cuenta en Volta.
                        </p>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.5; margin-bottom: 25px;">
                          Ingresa el siguiente código de verificación en la app:
                        </p>
                        
                        <!-- Código -->
                        <div style="background-color: #e8f4ff; border: 2px solid #3D4AF5; border-radius: 12px; padding: 30px; margin: 30px 0; text-align: center;">
                          <p style="font-family: 'Work Sans', Arial, sans-serif; font-size: 14px; color: #666; margin: 0 0 10px 0;">Tu código de verificación es:</p>
                          <div style="font-size: 36px; font-weight: 700; color: #3D4AF5; letter-spacing: 8px; margin: 10px 0; font-family: 'Courier New', monospace;">${data.resetCode}</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Información importante -->
              <tr>
                <td style="padding-bottom: 30px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="background-color: #e8f4ff; border-radius: 12px; padding: 25px;">
                        <h2 style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; color: #000000; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">⚠️ Información importante</h2>
                        
                        <ul style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6; margin: 0; padding-left: 20px;">
                          <li style="margin-bottom: 8px;">Este código expira en ${data.expiresInMinutes} minutos</li>
                          <li style="margin-bottom: 8px;">Solo puedes usar este código una vez</li>
                          <li style="margin-bottom: 8px;">Si no solicitaste este cambio, puedes ignorar este email</li>
                          <li style="margin-bottom: 8px;">No compartas este código con nadie</li>
                        </ul>
                        
                        <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-top: 15px; margin-bottom: 0;">
                          Si no solicitaste este cambio, tu cuenta permanece segura y puedes ignorar este email.
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              
              <!-- Footer -->
              <tr>
                <td style="text-align: center; padding-top: 20px;">
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px;">
                    Si tienes alguna pregunta, contáctanos por WhatsApp al <a href="https://wa.me/593964193931" style="color: #3D4AF5; text-decoration: none;">+593 96 419 3931</a>
                  </p>
                  
                  <p style="font-family: 'Work Sans', Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.5; margin-bottom: 15px; color: #777777;">
                    &copy; ${new Date().getFullYear()} Volta. Todos los derechos reservados.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
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
      subject: 'Gracias por tu compra en Volta',
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
      subject: `Reserva confirmada: ${data.className || `Rueda con ${data.instructorName}`}`,
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
      subject: 'Recuperar contraseña - Volta',
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
      subject: 'Código de recuperación - Volta',
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

export async function sendMenuPurchaseConfirmationEmail(data: MenuPurchaseEmailData): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { resend } = getResendClient();
    console.log('📧 Enviando email de confirmación de pedido de menu a:', data.user.email);
    
    const itemsDescription = data.items.map(item => `${item.quantity}x ${item.name}`).join(', ');
    
    const { data: result, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [data.user.email],
      subject: `¡Pedido confirmado! ${itemsDescription} - Volta`,
      html: createMenuPurchaseEmailTemplate(data),
    });

    if (error) {
      console.error('❌ Error enviando email de pedido de menu:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Email de pedido de menu enviado exitosamente:', result?.id);
    return { success: true, messageId: result?.id };
    
  } catch (error: any) {
    console.error('❌ Error enviando email de pedido de menu:', error);
    return { success: false, error: error.message };
  }
} 