import { Router } from 'express';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/image', upload.single('image'), async (req: any, res: any) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'Максимальный размер 5MB' });
    }

    if (!req.file.mimetype.startsWith('image/')) {
      return res.status(400).json({ error: 'Только изображения' });
    }

    if (!process.env.IMAGEKIT_PRIVATE_KEY) {
      return res.status(500).json({ error: 'IMAGEKIT_PRIVATE_KEY не задан' });
    }

    // Создаём FormData
    const formData = new FormData();
    formData.append('file', req.file.buffer, req.file.originalname);
    formData.append('fileName', `${Date.now()}_${req.file.originalname}`);
    formData.append('folder', '/astronomy-app');

    // Отправляем через axios
    const response = await axios.post('https://upload.imagekit.io/api/v1/files/upload', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': 'Basic ' + Buffer.from(`${process.env.IMAGEKIT_PRIVATE_KEY}:`).toString('base64'),
      },
    });

    res.json({ url: response.data.url });
  } catch (error: any) {
    console.error('Ошибка загрузки:', error.response?.data || error.message);
    res.status(500).json({ 
      error: 'Ошибка загрузки изображения',
      details: error.response?.data?.message || error.message 
    });
  }
});

export default router;