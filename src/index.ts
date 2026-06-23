import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import newsRoutes from './routes/materials.routes.js';
import testsRoutes from './routes/tests.routes.js';
import lobbyRoutes from './routes/lobby.routes.js';
import textbookRoutes from './routes/textbook.routes.js';
import wheelRoutes from './routes/wheel.routes.js';
import uploadRoutes from './routes/upload.routes.js';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3010', 10);

// CORS
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3010',
  'https://astronomy-app-swart.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());

// Логи только в dev
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Роуты
app.use('/api/auth', authRoutes);
app.use('/api/news', newsRoutes);
app.use('/api/tests', testsRoutes);
app.use('/api/lobby', lobbyRoutes);
app.use('/api/textbook', textbookRoutes);
app.use('/api/wheel', wheelRoutes);
app.use('/api/upload', uploadRoutes);

// Health-check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
});
