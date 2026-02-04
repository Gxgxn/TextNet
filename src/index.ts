import 'dotenv/config';
import express from 'express';
import { smsController } from './controllers/smsController.js';

const app = express();
const PORT = process.env.PORT || 8080;

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
