import { Router } from 'express';
import { verifyToken, requireRole } from '../middleware/auth.middleware.js';
import { db } from '../config/firebase.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';

const router = Router();

// Генерация 6-значного кода
const generateCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ========== ЛОББИ ==========

// Создать лобби (преподаватель)
router.post('/', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const { testId } = req.body;

    const testDoc = await db.collection('tests').doc(testId).get();
    if (!testDoc.exists) return res.status(404).json({ error: 'Тест не найден' });

    const code = generateCode();
    const lobbyRef = db.collection('lobbies').doc();

    const lobbyData = {
      id: lobbyRef.id,
      testId,
      testTitle: testDoc.data()!.title,
      questionsCount: testDoc.data()!.questions.length,
      code,
      status: 'waiting',
      authorId: req.user!.uid,
      participants: {},
      createdAt: new Date()
    };

    await lobbyRef.set(lobbyData);
    res.status(201).json(lobbyData);
  } catch (error) {
    console.error('Ошибка создания лобби:', error);
    res.status(500).json({ error: 'Ошибка создания лобби' });
  }
});

// Получить лобби по коду (для присоединения) - ПУБЛИЧНЫЙ
router.get('/code/:code', async (req, res) => {
  try {
    const snapshot = await db.collection('lobbies')
      .where('code', '==', req.params.code.toUpperCase())
      .limit(1)
      .get();

    if (snapshot.empty) return res.status(404).json({ error: 'Лобби не найдено' });

    const lobby = snapshot.docs[0].data();

    // Не отдаём ответы
    res.json({
      id: lobby.id,
      testId: lobby.testId,
      testTitle: lobby.testTitle,
      code: lobby.code,
      status: lobby.status,
      participantCount: Object.keys(lobby.participants || {}).length
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка поиска лобби' });
  }
});

// Получить мои лобби (преподаватель)
router.get('/', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const snapshot = await db.collection('lobbies')
      .where('authorId', '==', req.user!.uid)
      .orderBy('createdAt', 'desc')
      .get();

    const lobbies = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.json(lobbies);
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения лобби' });
  }
});

// Получить лобби по ID (для ведущего/участника) - ИСПРАВЛЕНО: ТЕПЕРЬ ПУБЛИЧНЫЙ
router.get('/:id', async (req, res) => {
  try {
    const lobbyDoc = await db.collection('lobbies').doc(req.params.id as string).get();
    if (!lobbyDoc.exists) return res.status(404).json({ error: 'Лобби не найдено' });

    res.json({ id: lobbyDoc.id, ...lobbyDoc.data() });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения лобби' });
  }
});

// Присоединиться к лобби - ПУБЛИЧНЫЙ
router.post('/:id/join', async (req, res) => {
  try {
    const lobbyId = req.params.id as string;
    const { displayName, uid, isAnonymous } = req.body;

    const lobbyRef = db.collection('lobbies').doc(lobbyId);
    const lobbyDoc = await lobbyRef.get();

    if (!lobbyDoc.exists) return res.status(404).json({ error: 'Лобби не найдено' });

    const lobby = lobbyDoc.data()!;
    if (lobby.status !== 'waiting') return res.status(400).json({ error: 'Лобби уже начато или завершено' });

    const participantId = uid || `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Проверяем, не присоединился ли уже
    if (lobby.participants?.[participantId]) {
      return res.json({ participantId, lobbyId });
    }

    await lobbyRef.update({
      [`participants.${participantId}`]: {
        uid: uid || null,
        displayName,
        isAnonymous: isAnonymous || false,
        joinedAt: new Date(),
        answers: {},
        score: 0
      }
    });

    res.json({ participantId, lobbyId });
  } catch (error) {
    console.error('Ошибка присоединения:', error);
    res.status(500).json({ error: 'Ошибка присоединения' });
  }
});

// Начать тест (преподаватель)
router.post('/:id/start', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const lobbyId = req.params.id as string;
    const lobbyRef = db.collection('lobbies').doc(lobbyId);
    const lobbyDoc = await lobbyRef.get();

    if (!lobbyDoc.exists) return res.status(404).json({ error: 'Лобби не найдено' });
    if (lobbyDoc.data()?.authorId !== req.user!.uid) return res.status(403).json({ error: 'Нет доступа' });

    await lobbyRef.update({
      status: 'active',
      startedAt: new Date()
    });

    res.json({ message: 'Тест начат' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка запуска теста' });
  }
});

// Отправить ответ (участник) - ПУБЛИЧНЫЙ
router.post('/:id/answer', async (req, res) => {
  try {
    const lobbyId = req.params.id as string;
    const { participantId, questionId, selectedOptionIndex, selectedOptionIndexes, textAnswer } = req.body;

    const lobbyRef = db.collection('lobbies').doc(lobbyId);
    const lobbyDoc = await lobbyRef.get();

    if (!lobbyDoc.exists) return res.status(404).json({ error: 'Лобби не найдено' });

    const lobby = lobbyDoc.data()!;
    if (lobby.status !== 'active') return res.status(400).json({ error: 'Тест не активен' });

    const testDoc = await db.collection('tests').doc(lobby.testId).get();
    const test = testDoc.data()!;
    const question = test.questions.find((q: any) => q.id === questionId);

    if (!question) return res.status(404).json({ error: 'Вопрос не найден' });

    let isCorrect = false;
    let answerData: any = {};

    if (question.type === 'single') {
      isCorrect = question.correctOptionIndex === selectedOptionIndex;
      answerData = { selectedOptionIndex };
    }

    if (question.type === 'multiple') {
      const correctSet = new Set(question.correctOptionIndexes || []);
      const selectedSet = new Set(selectedOptionIndexes || []);
      isCorrect = correctSet.size === selectedSet.size &&
        [...correctSet].every(x => selectedSet.has(x));
      answerData = { selectedOptionIndexes };
    }

    if (question.type === 'text') {
      const userAnswer = (textAnswer || '').toLowerCase().trim();
      const correctAnswers = question.correctText.toLowerCase().split('|').map((a: string) => a.trim());
      isCorrect = correctAnswers.some((a: string) => a === userAnswer);
      answerData = { textAnswer };
    }

    const participant = lobby.participants[participantId];
    const newScore = (participant?.score || 0) + (isCorrect ? 1 : 0);

    await lobbyRef.update({
      [`participants.${participantId}.answers.${questionId}`]: answerData,
      [`participants.${participantId}.score`]: newScore
    });

    res.json({ correct: isCorrect, score: newScore });
  } catch (error) {
    console.error('Ошибка отправки ответа:', error);
    res.status(500).json({ error: 'Ошибка отправки ответа' });
  }
});

// Завершить тест (преподаватель)
router.post('/:id/finish', verifyToken, requireRole('teacher'), async (req: AuthRequest, res) => {
  try {
    const lobbyId = req.params.id as string;
    const lobbyRef = db.collection('lobbies').doc(lobbyId);
    const lobbyDoc = await lobbyRef.get();

    if (!lobbyDoc.exists) return res.status(404).json({ error: 'Лобби не найдено' });
    if (lobbyDoc.data()?.authorId !== req.user!.uid) return res.status(403).json({ error: 'Нет доступа' });

    await lobbyRef.update({
      status: 'finished',
      finishedAt: new Date()
    });

    res.json({ message: 'Тест завершён' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка завершения теста' });
  }
});

// Получить тест лобби (для участников, без правильных ответов) - ПУБЛИЧНЫЙ
router.get('/:id/test', async (req, res) => {
  try {
    const lobbyId = req.params.id as string;
    const lobbyDoc = await db.collection('lobbies').doc(lobbyId).get();

    if (!lobbyDoc.exists) return res.status(404).json({ error: 'Лобби не найдено' });

    const lobby = lobbyDoc.data()!;
    if (lobby.status !== 'active') return res.status(400).json({ error: 'Тест ещё не начат' });

    const testDoc = await db.collection('tests').doc(lobby.testId).get();
    if (!testDoc.exists) return res.status(404).json({ error: 'Тест не найден' });

    const testData = testDoc.data()!;

    // Убираем правильные ответы, но оставляем картинки и тип вопроса
    const questions = testData.questions.map((q: any) => ({
      id: q.id,
      type: q.type,
      text: q.text,
      options: q.options,
      imageUrl: q.imageUrl || null,
      optionImages: q.optionImages || []
    }));

    res.json({
      id: testDoc.id,
      title: testData.title,
      description: testData.description,
      questions
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка получения теста' });
  }
});

// Личное завершение теста (участник сам завершил) - ПУБЛИЧНЫЙ
router.post('/:id/finish-personal', async (req, res) => {
  try {
    const lobbyId = req.params.id as string;
    const { participantId } = req.body;

    const lobbyRef = db.collection('lobbies').doc(lobbyId);
    const lobbyDoc = await lobbyRef.get();

    if (!lobbyDoc.exists) return res.status(404).json({ error: 'Лобби не найдено' });

    const lobby = lobbyDoc.data()!;
    if (lobby.status !== 'active') return res.status(400).json({ error: 'Тест не активен' });

    await lobbyRef.update({
      [`participants.${participantId}.finishedAt`]: new Date()
    });

    res.json({ message: 'Тест завершён' });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка завершения теста' });
  }
});

export default router;
