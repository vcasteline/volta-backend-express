# Express Server - Migración desde Supabase Edge Functions

Este servidor Express contiene toda la lógica de negocio migrada desde las Edge Functions de Supabase, lo que te permitirá ahorrar significativamente en costos.

## Funcionalidades Migradas

- ✅ **get-user-cards**: Obtener tarjetas del usuario desde Nuvei
- ✅ **process-nuvei-payment**: Procesar pagos con Nuvei
- ✅ **verify-nuvei-otp**: Verificar OTP de Nuvei
- ✅ **send-push-notification**: Enviar notificaciones push
- ✅ **waitlist-notification**: Notificaciones de waitlist
- ✅ **credits-expiration-cron**: Cron job para créditos por expirar
- ✅ **class-reminders-cron**: Cron job para recordatorios de clase

## Instalación

1. **Instalar dependencias:**
```bash
cd express-server
npm install
```

2. **Configurar variables de entorno:**
Crea un archivo `.env` en la raíz del proyecto con:

```env
# Configuración del servidor
PORT=3000
NODE_ENV=development
SERVER_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:19006

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Nuvei Payment Gateway
NUVEI_APPLICATION_CODE=your_nuvei_application_code
NUVEI_SECRET_KEY=your_nuvei_secret_key
NUVEI_BASE_URL=https://ccapi-stg.paymentez.com

# Email configuration (Resend)
RESEND_API_KEY=your_resend_api_key
FRONTEND_URL=https://your-frontend-url.com

# Expo Push Notifications
EXPO_ACCESS_TOKEN=your_expo_access_token

# Service Key para rutas internas
SERVICE_KEY=your_internal_service_key
```

3. **Compilar TypeScript:**
```bash
npm run build
```

4. **Ejecutar en desarrollo:**
```bash
npm run dev
```

5. **Ejecutar en producción:**
```bash
npm start
```

## Rutas del API

### Rutas Protegidas (requieren token de usuario)
- `POST /api/get-user-cards` - Obtener tarjetas del usuario
- `POST /api/process-nuvei-payment` - Procesar pago con Nuvei
- `POST /api/verify-nuvei-otp` - Verificar OTP de Nuvei

### Rutas del Sistema (requieren service key)
- `POST /api/send-push-notification` - Enviar notificaciones push
- `POST /api/waitlist-notification` - Notificación de waitlist

### Cron Jobs Manuales
- `POST /api/cron/credits-expiration` - Ejecutar notificaciones de créditos
- `POST /api/cron/class-reminders` - Ejecutar recordatorios de clase

### Utilidad
- `GET /health` - Health check del servidor

## Migración desde Edge Functions

Para migrar desde Edge Functions:

1. **Actualizar tu app React Native/Expo** para apuntar al nuevo servidor:
```typescript
// Cambiar de:
const { data, error } = await supabase.functions.invoke('get-user-cards', {
  headers: { Authorization: `Bearer ${session.access_token}` }
});

// A:
const response = await fetch(`${SERVER_URL}/api/get-user-cards`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  }
});
```

2. **Configurar cron jobs externos** (reemplaza los cron jobs de Supabase):
- Usar servicios como Vercel Cron, GitHub Actions, o cron jobs del servidor
- Llamar a las rutas `/api/cron/*` con la frecuencia deseada

3. **Deshabilitar Edge Functions** en Supabase para evitar costos duplicados

## Cron Jobs Automáticos

El servidor incluye cron jobs automáticos:
- **Créditos por expirar**: Todos los días a las 10 AM
- **Recordatorios de clase**: Cada 10 minutos

## Autenticación

### Para rutas de usuario:
```typescript
headers: {
  'Authorization': `Bearer ${supabaseUserToken}`
}
```

### Para rutas del sistema:
```typescript
headers: {
  'x-service-key': 'your_service_key'
}
```

## Monitoreo

- Los logs se muestran en la consola
- Endpoint `/health` para verificar el estado del servidor
- Manejo de errores centralizado

## Despliegue

Este servidor puede desplegarse en:
- **Railway**: Despliegue automático desde Git
- **Render**: Plan gratuito disponible
- **Heroku**: Fácil configuración
- **DigitalOcean App Platform**: Escalable
- **VPS propio**: Máximo control

## Beneficios de la Migración

- 💰 **Reducción de costos**: Las Edge Functions pueden ser costosas con mucho tráfico
- 🚀 **Mayor control**: Control total sobre el servidor y dependencias
- 📊 **Mejor monitoreo**: Logs y métricas más detalladas
- 🔧 **Flexibilidad**: Fácil de modificar y extender
- ⚡ **Rendimiento**: Posibilidad de optimizar para tu caso de uso específico 