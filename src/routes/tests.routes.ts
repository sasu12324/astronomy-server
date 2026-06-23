import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../config/firebase.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Валидация вопроса
const validateQuestion = (q: any) => {
  if (!q.type || !['single', 'multiple', 'text'].includes(q.type)) {
    throw new Error('Неверный тип вопроса');
  }
  if (!q.text) throw new Error('Текст вопроса обязателен');

  if (q.type === 'single') {
    if (!q.options || q.options.length < 2) throw new Error('Минимум 2 варианта');
    if (q.correctOptionIndex === undefined || q.correctOptionIndex < 0) {
      throw new Error('Укажите правильный ответ');
    }
  }

  if (q.type === 'multiple') {
    if (!q.options || q.options.length < 2) throw new Error('Минимум 2 варианта');
    if (!q.correctOptionIndexes || q.correctOptionIndexes.length === 0) {
      throw new Error('Укажите хотя бы один правильный ответ');
    }
  }

  if (q.type === 'text') {
    if (!q.correctText || q.correctText.trim().length === 0) {
      throw new Error('Укажите правильный текстовый ответ');
    }
  }
};

// ========== CRUD ТЕСТОВ ==========

// Получить все тесты преподавателя
router.get('/', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const snapshot = await db.collection('tests')
      .where('authorId', '==', req.user!.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const tests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(tests);
  } catch (error) {
    console.error('Ошибка получения тестов:', error);
    res.status(500).json({ error: 'Ошибка получения тестов' });
  }
});

// Получить один тест (для лобби)
router.get('/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const testDoc = await db.collection('tests').doc(req.params.id as string).get();

    if (!testDoc.exists) {
      return res.status(404).json({ error: 'Тест не найден' });
    }

    const testData = testDoc.data()!;

    // Если студент — не отдаём правильные ответы
    if (req.user!.role === 'student') {
      const questionsWithoutAnswers = testData.questions.map((q: any) => ({
        id: q.id,
        type: q.type,
        text: q.text,
        options: q.options,
        imageUrl: q.imageUrl,
        optionImages: q.optionImages
      }));

      res.json({
        id: testDoc.id,
        title: testData.title,
        description: testData.description,
        questions: questionsWithoutAnswers,
        authorId: testData.authorId
      });
      return;
    }

    res.json({ id: testDoc.id, ...testData });
  } catch (error) {
    console.error('Ошибка получения теста:', error);
    res.status(500).json({ error: 'Ошибка получения теста' });
  }
});

// Создать тест
router.post('/', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { title, description, questions } = req.body;

    if (!title || !questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ error: 'Название и вопросы обязательны' });
    }

    questions.forEach(validateQuestion);

    const testRef = db.collection('tests').doc();
    const testData = {
      id: testRef.id,
      title,
      description: description || '',
      questions: questions.map((q: any) => ({
        id: q.id || crypto.randomUUID(),
        type: q.type,
        text: q.text,
        options: q.options || [],
        correctOptionIndex: q.correctOptionIndex,
        correctOptionIndexes: q.correctOptionIndexes || [],
        correctText: q.correctText || '',
        imageUrl: q.imageUrl || null,
        optionImages: q.optionImages || []
      })),
      authorId: req.user!.uid,
      authorName: `${req.user!.firstName || ''} ${req.user!.lastName || ''}`.trim(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    await testRef.set(testData);
    res.status(201).json(testData);
  } catch (error: any) {
    console.error('Ошибка создания теста:', error);
    res.status(400).json({ error: error.message || 'Ошибка создания теста' });
  }
});

// Обновить тест
router.put('/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { title, description, questions } = req.body;
    const testId = req.params.id as string;

    const testDoc = await db.collection('tests').doc(testId).get();
    if (!testDoc.exists) return res.status(404).json({ error: 'Тест не найден' });
    if (testDoc.data()?.authorId !== req.user!.uid) return res.status(403).json({ error: 'Нет доступа' });

    if (questions) questions.forEach(validateQuestion);

    await db.collection('tests').doc(testId).update({
      title,
      description: description || '',
      questions,
      updatedAt: new Date()
    });

    res.json({ message: 'Тест обновлён' });
  } catch (error: any) {
    console.error('Ошибка обновления теста:', error);
    res.status(400).json({ error: error.message || 'Ошибка обновления теста' });
  }
});

// Удалить тест
router.delete('/:id', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const testId = req.params.id as string;

    const testDoc = await db.collection('tests').doc(testId).get();
    if (!testDoc.exists) return res.status(404).json({ error: 'Тест не найден' });
    if (testDoc.data()?.authorId !== req.user!.uid) return res.status(403).json({ error: 'Нет доступа' });

    await db.collection('tests').doc(testId).delete();
    res.json({ message: 'Тест удалён' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка удаления теста' });
  }
});

export default router;