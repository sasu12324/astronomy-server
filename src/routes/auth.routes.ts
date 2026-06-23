import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { db } from '../config/firebase.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

router.get('/me', verifyToken, async (req: AuthRequest, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.user!.uid).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'Профиль не заполнен' });
    }
    
    res.json({ uid: userDoc.id, id: userDoc.id, ...userDoc.data() });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения профиля' });
  }
});

router.post('/register', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName, role, group } = req.body;
    
    await db.collection('users').doc(req.user!.uid).set({
      email: req.user!.email,
      firstName,
      lastName,
      role,
      group: group || null,
      createdAt: new Date()
    });
    
    res.status(201).json({ message: 'Профиль создан' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка создания профиля' });
  }
});

export default router;