import { Request, Response } from 'express';
import { deleteCard } from '../utils/nuvei';

export async function deleteCardHandler(req: Request, res: Response) {
  try {
    const { cardToken, userId } = req.body;
    // userId viene del frontend (cédula), no usar req.user.id

    console.log('🗑️ Solicitud para eliminar tarjeta:', {
      userId, // Cédula del usuario (para Nuvei)
      userIdType: typeof userId,
      cardToken: cardToken?.substring(0, 10) + '...',
      supabaseUserId: req.user?.id // UUID de Supabase (solo para verificar auth)
    });

    // Validación de parámetros
    if (!cardToken) {
      return res.status(400).json({
        success: false,
        error: 'El token de la tarjeta es requerido'
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'El userId (cédula) es requerido'
      });
    }

    // Verificar que el usuario esté autenticado
    if (!req.user?.id) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    // Eliminar la tarjeta usando el API de Nuvei
    const result = await deleteCard(cardToken, userId);

    console.log('✅ Tarjeta eliminada exitosamente para usuario:', userId);

    res.json({
      success: true,
      message: result.message || 'Tarjeta eliminada exitosamente',
      data: result
    });

  } catch (error) {
    console.error('❌ Error al eliminar tarjeta:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    });
  }
} 