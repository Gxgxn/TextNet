import type { Request, Response } from 'express';
import { processSmsAsync } from '../services/smsOrchestrator.js';

interface TwilioWebhookBody {
  From: string;
  Body: string;
  To?: string;
  MessageSid?: string;
}

/**
 * Handles incoming SMS from Twilio webhook.
 * Returns immediately with empty TwiML to prevent 5-second timeout.
 * Processing happens asynchronously in the background.
 */
export function smsController(req: Request<object, string, TwilioWebhookBody>, res: Response): void {
  const { From: from, Body: body } = req.body;

  console.log(`📩 Received SMS from: ${from}`);
  console.log(`📝 Message: ${body}`);

  // Fire-and-forget: Process in background
  // DO NOT await - we must return immediately for Twilio's 5-second timeout
  processSmsAsync(from, body);

  // Return empty TwiML immediately
  res.type('text/xml');
  res.send('<Response></Response>');
}
