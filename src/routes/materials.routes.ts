import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../config/firebase.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Получить все материалы (доступно всем)
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('materials')
      .orderBy('createdAt', 'desc')
      .get();
    
    const materials = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    res.json(materials);
  } catch (error) {
    console.error('Ошибка получения материалов:', error);
    res.status(500).json({ error: 'Ошибка получения материалов' });
  }
});

// Создать материал (только препод)
router.post('/', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { title, description, coverUrl, link, type } = req.body;
    
    if (!title || !link) {
      return res.status(400).json({ error: 'Название и ссылка обязательны' });
    }
    
    const materialRef = db.collection('materials').doc();
    const materialData = {
      id: materialRef.id,
      title,
      description: description || '',
      coverUrl: coverUrl || '',
      link,
      type: type || 'article',
      authorId: req.user!.uid,
      authorName: `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim(),
      createdAt: new Date()
    };
    
    await materialRef.set(materialData);
    res.status(201).json(materialData);
  } catch (error) {
    console.error('Ошибка создания материала:', error);
    res.status(500).json({ error: 'Ошибка создания материала' });
  }
});

// Обновить материал (только препод-автор)
router.put('/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const materialId = req.params.id as string;
    const { title, description, coverUrl, link, type } = req.body;
    
    const materialDoc = await db.collection('materials').doc(materialId).get();
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'Материал не найден' });
    }
    
    if (materialDoc.data()?.authorId !== req.user!.uid) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    await db.collection('materials').doc(materialId).update({
      title,
      description: description || '',
      coverUrl: coverUrl || '',
      link,
      type: type || 'article',
      updatedAt: new Date()
    });
    
    res.json({ message: 'Материал обновлён' });
  } catch (error) {
    console.error('Ошибка обновления материала:', error);
    res.status(500).json({ error: 'Ошибка обновления материала' });
  }
});

// Удалить материал (только препод-автор)
router.delete('/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const materialId = req.params.id as string;
    
    const materialDoc = await db.collection('materials').doc(materialId).get();
    if (!materialDoc.exists) {
      return res.status(404).json({ error: 'Материал не найден' });
    }
    
    if (materialDoc.data()?.authorId !== req.user!.uid) {
      return res.status(403).json({ error: 'Нет доступа' });
    }
    
    await db.collection('materials').doc(materialId).delete();
    res.json({ message: 'Материал удалён' });
  } catch (error) {
    console.error('Ошибка удаления материала:', error);
    res.status(500).json({ error: 'Ошибка удаления материала' });
  }
});

export default router;