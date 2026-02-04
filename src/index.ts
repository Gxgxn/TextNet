import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { smsController } from './controllers/smsController.js';
import './services/redisClient.js'; // Initialize Redis connection on startup

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Serve static files from public/
app.use(express.static(path.join(__dirname, '../public')));

// Parse URL-encoded bodies (Twilio sends form data)
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// SMS webhook endpoint
app.post('/sms', smsController);

app.listen(PORT, () => {
  console.log(`🚀 TextNet AI server running on port ${PORT}`);
  console.log(`📱 SMS webhook endpoint: POST http://localhost:${PORT}/sms`);
});
