import { Request, Response } from 'express';
import fetch from 'node-fetch';
import { supabase } from '../index';
import { createNuveiAuthToken, NuveiResponse } from '../utils/nuvei';

export const getUserCards = async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;

    // Obtener la cédula del usuario desde la base de datos
    const { data: userData, error: dbError } = await supabase
      .from('users')
      .select('cedula')
      .eq('id', user.id)
      .single();

    if (dbError || !userData?.cedula) {
      throw new Error('User cedula not found');
    }

    const userCedula = userData.cedula;

    // Crear token de autenticación para Nuvei
    const authToken = createNuveiAuthToken();
    
    // URL de la API de Nuvei
    const nuveiBaseUrl = process.env.NUVEI_BASE_URL || 'https://ccapi-stg.paymentez.com';
    const apiUrl = `${nuveiBaseUrl}/v2/card/list?uid=${encodeURIComponent(userCedula)}`;
    
    console.log('📞 Llamando a Nuvei API:', {
      url: apiUrl,
      userCedula,
      hasAuthToken: !!authToken
    });

    // Llamar a la API de Nuvei
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Auth-Token': authToken,
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No response body');
      
      console.error('❌ Error de Nuvei API:', {
        status: response.status,
        statusText: response.statusText,
        body: errorText,
        url: apiUrl
      });
      
      if (response.status === 401) {
        throw new Error('Nuvei authentication failed - Credenciales inválidas');
      } else if (response.status === 404) {
        throw new Error('Usuario no encontrado en Nuvei');
      } else if (response.status >= 500) {
        throw new Error('Servicio de Nuvei temporalmente no disponible');
      } else {
        throw new Error(`Nuvei API error: ${response.status} - ${response.statusText}`);
      }
    }

    const nuveiData: NuveiResponse = await response.json() as NuveiResponse;
    
    console.log('✅ Respuesta de Nuvei:', {
      cardCount: nuveiData.cards?.length || 0,
      resultSize: nuveiData.result_size
    });

    return res.status(200).json({
      success: true,
      cards: nuveiData.cards || [],
      result_size: nuveiData.result_size || 0
    });

  } catch (error: any) {
    console.error('❌ Error en get-user-cards:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido en la función'
    });
  }
}; 