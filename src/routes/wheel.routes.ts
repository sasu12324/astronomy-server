import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../config/firebase.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Получить все колёса преподавателя
router.get('/', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const snapshot = await db.collection('wheels')
      .where('authorId', '==', req.user!.uid)
      .orderBy('createdAt', 'desc')
      .get();
    
    const wheels = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(wheels);
  } catch (error) {
    console.error('Ошибка получения колёс:', error);
    res.status(500).json({ error: 'Ошибка получения колёс' });
  }
});

// Создать колесо
router.post('/', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { name, items } = req.body;
    
    if (!name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Название и список студентов обязательны' });
    }
    
    const wheelRef = db.collection('wheels').doc();
    const wheelData = {
      id: wheelRef.id,
      name,
      items,
      authorId: req.user!.uid,
      authorName: `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim(),
      createdAt: new Date()
    };
    
    await wheelRef.set(wheelData);
    res.status(201).json(wheelData);
  } catch (error) {
    console.error('Ошибка создания колеса:', error);
    res.status(500).json({ error: 'Ошибка создания колеса' });
  }
});

// Обновить колесо
router.put('/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { name, items } = req.body;
    const wheelId = req.params.id as string; // <-- ИСПРАВЛЕНО
    
    const wheelDoc = await db.collection('wheels').doc(wheelId).get();
    
    if (!wheelDoc.exists) {
      return res.status(404).json({ error: 'Колесо не найдено' });
    }
    
    if (wheelDoc.data()?.authorId !== req.user!.uid) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    await db.collection('wheels').doc(wheelId).update({
      name,
      items,
      updatedAt: new Date()
    });
    
    res.json({ message: 'Колесо обновлено' });
  } catch (error) {
    console.error('Ошибка обновления колеса:', error);
    res.status(500).json({ error: 'Ошибка обновления колеса' });
  }
});

// Удалить колесо
router.delete('/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const wheelId = req.params.id as string; // <-- ИСПРАВЛЕНО
    
    const wheelDoc = await db.collection('wheels').doc(wheelId).get();
    
    if (!wheelDoc.exists) {
      return res.status(404).json({ error: 'Колесо не найдено' });
    }
    
    if (wheelDoc.data()?.authorId !== req.user!.uid) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    await db.collection('wheels').doc(wheelId).delete();
    res.json({ message: 'Колесо удалено' });
  } catch (error) {
    console.error('Ошибка удаления колеса:', error);
    res.status(500).json({ error: 'Ошибка удаления колеса' });
  }
});

export default router;