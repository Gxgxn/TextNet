import twilio from 'twilio';
import { generateResponse } from './mockLlmService.js';

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER!;

const client = twilio(accountSid, authToken);

/**
 * Processes incoming SMS asynchronously.
 * This function runs in the background to avoid blocking the webhook response.
 *
 * @param from - The sender's phone number
 * @param body - The SMS message content
 */
export async function processSmsAsync(from: string, body: string): Promise<void> {
  console.log(`⚙️  Starting async processing for message from: ${from}`);

  try {
    // Get response from LLM (currently mocked)
    const llmResponse = await generateResponse(body);
    console.log(`🤖 LLM response generated: ${llmResponse}`);

    // Send outbound SMS via Twilio
    const message = await client.messages.create({
      to: from,
      from: twilioPhoneNumber,
      body: llmResponse,
    });

    console.log(`✅ Outbound SMS sent successfully. SID: ${message.sid}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error processing SMS from ${from}:`, errorMessage);
  }
}
