import type { Request, Response, NextFunction } from 'express';
import { auth, db } from '../config/firebase.js';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email: string;
    role?: string;
    firstName?: string;
    lastName?: string;
  };
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Токен не предоставлен' });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await auth.verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
    };
    
    try {
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data()!;
        req.user = {
          ...req.user,
          role: userData.role,
          firstName: userData.firstName,
          lastName: userData.lastName
        };
      }
    } catch (dbError) {
      console.log('Пользователь в Firestore не найден');
    }
    
    next();
  } catch (error) {
    console.error('Ошибка верификации токена:', error);
    res.status(401).json({ error: 'Невалидный токен' });
  }
};

// ДОБАВЬ ЭТО:
export const requireRole = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }
    
    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Недостаточно прав' });
    }
    
    next();
  };
};