import { Request, Response } from 'express';
import { supabase } from '../index';

export const checkCedula = async (req: Request, res: Response) => {
  try {
    const { cedula } = req.body;
    
    // Validar que la cédula tenga 10 dígitos
    if (!cedula || cedula.length !== 10) {
      return res.status(400).json({ error: 'Cédula inválida' });
    }
    
    // Consultar en tu base de datos (sin RLS)
    const { data, error } = await supabase
      .from('users')
      .select('cedula')
      .eq('cedula', cedula)
      .limit(1);
    
    if (error) {
      console.error('Error checking cedula:', error);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    // Responder si existe o no
    res.json({ 
      exists: data && data.length > 0,
      cedula: cedula 
    });
    
  } catch (error) {
    console.error('Exception in check-cedula:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
