import { Router } from 'express';
import { db } from '../config/firebase.js';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// ========== ПУБЛИЧНЫЕ РОУТЫ (без авторизации) ==========

// Получить все лекции (для оглавления)
router.get('/lectures', async (req, res) => {
  try {
    const snapshot = await db.collection('textbook')
      .orderBy('order', 'asc')
      .get();
    
    const lectures = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        order: data.order,
        number: data.number,
        title: data.title,
      };
    });
    
    res.json(lectures);
  } catch (error) {
    console.error('Ошибка получения лекций:', error);
    res.status(500).json({ error: 'Ошибка получения лекций' });
  }
});

// Получить одну лекцию с содержимым
router.get('/lectures/:id', async (req, res) => {
  try {
    const doc = await db.collection('textbook').doc(req.params.id).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Лекция не найдена' });
    }
    
    res.json({ id: doc.id, ...doc.data() });
  } catch (error) {
    console.error('Ошибка получения лекции:', error);
    res.status(500).json({ error: 'Ошибка получения лекции' });
  }
});

// ========== ЗАЩИЩЁННЫЕ РОУТЫ (только преподаватель) ==========

// Создать лекцию
router.post('/lectures', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { order, number, title, content, subsections, images } = req.body;
    
    if (!order || !number || !title) {
      return res.status(400).json({ error: 'Порядок, номер и название обязательны' });
    }

    const lectureRef = db.collection('textbook').doc();
    const lectureData = {
      id: lectureRef.id,
      order,
      number,
      title,
      content: content || '',
      subsections: subsections || [],
      images: images || [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    await lectureRef.set(lectureData);
    res.status(201).json(lectureData);
  } catch (error) {
    console.error('Ошибка создания лекции:', error);
    res.status(500).json({ error: 'Ошибка создания лекции' });
  }
});

// Обновить лекцию
router.put('/lectures/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { order, number, title, content, subsections, images } = req.body;
    const lectureId = req.params.id;
    
    const lectureDoc = await db.collection('textbook').doc(lectureId).get();
    if (!lectureDoc.exists) {
      return res.status(404).json({ error: 'Лекция не найдена' });
    }
    
    await db.collection('textbook').doc(lectureId).update({
      ...(order !== undefined && { order }),
      ...(number !== undefined && { number }),
      ...(title !== undefined && { title }),
      ...(content !== undefined && { content }),
      ...(subsections !== undefined && { subsections }),
      ...(images !== undefined && { images }),
      updatedAt: new Date()
    });
    
    res.json({ message: 'Лекция обновлена' });
  } catch (error) {
    console.error('Ошибка обновления лекции:', error);
    res.status(500).json({ error: 'Ошибка обновления лекции' });
  }
});

// Удалить лекцию
router.delete('/lectures/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const lectureId = req.params.id;
    
    const lectureDoc = await db.collection('textbook').doc(lectureId).get();
    if (!lectureDoc.exists) {
      return res.status(404).json({ error: 'Лекция не найдена' });
    }
    
    await db.collection('textbook').doc(lectureId).delete();
    res.json({ message: 'Лекция удалена' });
  } catch (error) {
    console.error('Ошибка удаления лекции:', error);
    res.status(500).json({ error: 'Ошибка удаления лекции' });
  }
});

export default router;