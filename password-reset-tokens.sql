-- Crear tabla para tokens de reset de contraseña
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    used_at TIMESTAMP WITH TIME ZONE NULL
);

-- Crear índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash ON password_reset_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at ON password_reset_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_used ON password_reset_tokens(used);

-- Crear función para limpiar tokens expirados automáticamente
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM password_reset_tokens 
    WHERE expires_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para ejecutar la limpieza automáticamente
-- (opcional: esto se puede ejecutar como un cron job)
/*
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_tokens()
RETURNS trigger AS $$
BEGIN
    PERFORM cleanup_expired_reset_tokens();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cleanup_expired_tokens_trigger
    AFTER INSERT ON password_reset_tokens
    EXECUTE FUNCTION trigger_cleanup_expired_tokens();
*/

-- Comentarios para la tabla
COMMENT ON TABLE password_reset_tokens IS 'Tabla para almacenar tokens de reset de contraseña';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'Hash SHA256 del token de reset';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Fecha y hora de expiración del token';
COMMENT ON COLUMN password_reset_tokens.used IS 'Indica si el token ya fue utilizado';
COMMENT ON COLUMN password_reset_tokens.used_at IS 'Fecha y hora en que se utilizó el token'; 