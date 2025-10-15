import { Request, Response } from 'express';
import { supabase } from '../index';

export const checkUsername = async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    
    // Validar que el username tenga al menos 3 caracteres
    if (!username || username.length < 3) {
      return res.status(400).json({ error: 'Username debe tener al menos 3 caracteres' });
    }
    
    // Validar que no contenga espacios
    if (/\s/.test(username)) {
      return res.status(400).json({ error: 'Username no puede contener espacios' });
    }
    
    // Validar caracteres permitidos (letras, números, guiones y guiones bajos)
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return res.status(400).json({ error: 'Solo se permiten letras, números, guiones y guiones bajos' });
    }
    
    // Consultar en tu base de datos (sin RLS)
    const { data, error } = await supabase
      .from('users')
      .select('username')
      .eq('username', username.toLowerCase()) // Comparar en minúsculas
      .limit(1);
    
    if (error) {
      console.error('Error checking username:', error);
      return res.status(500).json({ error: 'Error del servidor' });
    }
    
    // Responder si existe o no
    res.json({ 
      exists: data && data.length > 0,
      username: username.toLowerCase()
    });
    
  } catch (error) {
    console.error('Exception in check-username:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};


