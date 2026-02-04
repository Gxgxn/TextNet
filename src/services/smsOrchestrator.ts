import twilio from 'twilio';
import { generateResponse } from './llmService.js';
import { getContext, addMessage, checkRateLimit, checkAndIncrementUsage } from './redisClient.js';

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
    // Check rate limit first
    const rateLimit = await checkRateLimit(from);
    
    if (!rateLimit.allowed) {
      console.log(`🚫 Rate limit exceeded for ${from}. Reset in ${rateLimit.resetIn}s`);
      
      await client.messages.create({
        to: from,
        from: twilioPhoneNumber,
        body: `TextNet: Rate limit reached. Try again in ${rateLimit.resetIn}s. Max 10 msgs/min.`,
      });
      return;
    }

    // Check free trial usage
    const usage = await checkAndIncrementUsage(from);
    
    if (!usage.allowed) {
      console.log(`🎫 Free trial ended for ${from}. Total: ${usage.total} messages`);
      
      await client.messages.create({
        to: from,
        from: twilioPhoneNumber,
        body: `TextNet: Free trial ended (50 msgs). Reply SUBSCRIBE for upgrade info.`,
      });
      return;
    }

    console.log(`📊 Rate: ${rateLimit.remaining}/min | Trial: ${usage.remaining}/50 remaining`);

    const history = await getContext(from);
    const llmResponse = await generateResponse(body, history);
    console.log(`🤖 LLM response generated: ${llmResponse}`);
    
    // Send outbound SMS via Twilio
    const message = await client.messages.create({
      to: from,
      from: twilioPhoneNumber,
      body: llmResponse,
    });
    // Save conversation history (user first, then assistant)
    await addMessage(from, 'user', body);
    await addMessage(from, 'assistant', llmResponse);
    // Log success
    console.log(`✅ Outbound SMS sent successfully. SID: ${message.sid}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Error processing SMS from ${from}:`, errorMessage);
  }
}


