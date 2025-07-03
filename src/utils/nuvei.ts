import { createHash } from 'crypto';

export interface NuveiCard {
  bin: string;
  status: 'valid' | 'review' | 'pending' | 'rejected';
  token: string;
  holder_name: string;
  expiry_year: string;
  expiry_month: string;
  transaction_reference: string | null;
  type: string;
  number: string;
}

export interface NuveiResponse {
  cards: NuveiCard[];
  result_size: number;
}

export interface NuveiPaymentResponse {
  transaction: {
    id: string;
    status: string;
    message: string;
    authorization_code?: string;
    carrier_code?: string;
    dev_reference?: string;
  };
  card?: {
    bin: string;
    number: string;
    type: string;
  };
}

export interface NuveiVerifyResponse {
  status: number;
  status_detail: number;
  message: string;
}

// Función para crear hash SHA256
export function createSHA256Hash(message: string): string {
  return createHash('sha256').update(message).digest('hex');
}

// Función para crear el token de autenticación de Nuvei
export function createNuveiAuthToken(): string {
  const applicationCode = process.env.NUVEI_APPLICATION_CODE;
  const secretKey = process.env.NUVEI_SECRET_KEY;
  
  if (!applicationCode || !secretKey) {
    throw new Error('Missing Nuvei credentials');
  }
  
  // Timestamp en segundos (UTC)
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  // Crear hash SHA256 de secret_key + timestamp
  const hashString = secretKey + timestamp;
  const sha256Hash = createSHA256Hash(hashString);
  
  // Formato: APPLICATION-CODE;TIMESTAMP;SHA256_HASH
  const authString = `${applicationCode};${timestamp};${sha256Hash}`;
  
  // Codificar en base64
  const authToken = Buffer.from(authString).toString('base64');
  
  console.log('🔑 Nuvei Auth Token creado:', {
    timestamp,
    hashString: hashString.substring(0, 20) + '...',
    sha256Hash: sha256Hash.substring(0, 20) + '...',
    authString: authString.substring(0, 50) + '...',
    token: authToken.substring(0, 30) + '...'
  });
  
  return authToken;
}

// Función para generar ID de idempotencia
export function generateIdempotencyId(userId: string, packageId: string, cardToken: string, amount: number): string {
  // Timestamp redondeado a ventanas de 3 minutos (180 segundos)
  // Esto previene duplicados por 3 min, pero permite recompras después
  const now = Math.floor(Date.now() / 1000); // timestamp en segundos
  const window = Math.floor(now / 180) * 180; // redondear a múltiplos de 180s
  
  return `${userId}_${packageId}_${cardToken}_${amount.toFixed(2)}_${window}`;
}

// Función para interpretar códigos de estado de Nuvei
export function getStatusMeaning(status: number, statusDetail: number): string {
  const statusMap: { [key: number]: string } = {
    0: "Pending",
    1: "Approved", 
    2: "Cancelled",
    4: "Rejected",
    5: "Expired"
  };

  const statusDetailMap: { [key: number]: string } = {
    0: "Waiting for Payment",
    1: "Verification required",
    2: "Paid Partially", 
    3: "Paid",
    4: "In Dispute",
    5: "Overpaid",
    6: "Fraud",
    7: "Refund",
    8: "Chargeback",
    9: "Rejected by carrier",
    10: "System error",
    11: "Nuvei fraud",
    12: "Nuvei blacklist",
    13: "Time tolerance",
    14: "Expired by Nuvei",
    15: "Expired by carrier",
    16: "Rejected by Nuvei",
    17: "Abandoned by Nuvei",
    18: "Abandoned by Customer",
    19: "Invalid Authorization Code",
    20: "Authorization code expired",
    21: "Nuvei Fraud - Pending refund",
    22: "Invalid AuthCode - Pending refund",
    23: "AuthCode expired - Pending refund",
    24: "Nuvei Fraud - Refund requested",
    25: "Invalid AuthCode - Refund requested",
    26: "AuthCode expired - Refund requested",
    27: "Merchant - Pending refund",
    28: "Merchant - Refund requested",
    29: "Annulled",
    30: "Transaction seated",
    31: "Waiting for OTP",
    32: "OTP successfully validated",
    33: "OTP not validated",
    34: "Partial refund",
    35: "3DS method requested",
    36: "3DS challenge requested",
    37: "Rejected by 3DS",
    47: "Failure cpf validation",
    48: "Authenticated by 3DS"
  };

  const statusText = statusMap[status] || `Unknown status (${status})`;
  const statusDetailText = statusDetailMap[statusDetail] || `Unknown detail (${statusDetail})`;
  
  return `${statusText} - ${statusDetailText}`;
} 