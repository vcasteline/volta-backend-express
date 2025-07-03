import { Request, Response, NextFunction } from 'express';
import { supabase } from '../index';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user?: any;
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ 
        success: false, 
        error: 'No authorization header' 
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid user token' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Authentication error' 
    });
  }
};

export const serviceKeyMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const serviceKey = req.headers['x-service-key'] || req.headers['service-key'];
  const expectedServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!serviceKey || serviceKey !== expectedServiceKey) {
    return res.status(403).json({ 
      success: false, 
      error: 'Invalid service key' 
    });
  }
  
  next();
}; 