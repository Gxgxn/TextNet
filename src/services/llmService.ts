import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const SYSTEM_INSTRUCTION_TEXT = `You are TextNet, an offline SMS assistant.
STRICT CONSTRAINTS:
1. Response length: MAX 150 characters.
2. Style: Telegraphic. Drop "the", "is", "are".
3. No Markdown, No Emojis.
4. If complex, end with "Reply MORE".`;

// Gemini requires systemInstruction as Content object
const SYSTEM_INSTRUCTION: Content = {
  role: 'user',
  parts: [{ text: SYSTEM_INSTRUCTION_TEXT }]
};

// Helper to map Redis history format to Gemini format
interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

export const generateResponse = async (userMessage: string, history: HistoryMessage[]): Promise<string> => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // Map generic history to Gemini's specific "Content" type
        let chatHistory: Content[] = history.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: msg.content } as Part]
        }));

        // Gemini requires history to start with 'user' role - filter if needed
        while (chatHistory.length > 0 && chatHistory[0].role === 'model') {
            chatHistory.shift();
        }

        const chat = model.startChat({
            history: chatHistory,
            systemInstruction: SYSTEM_INSTRUCTION, 
            generationConfig: {
                maxOutputTokens: 256, // Allow full responses (150 chars ≈ 50 tokens + headroom)
            },
        });

        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        // Validate response - never return empty
        if (!responseText || responseText.trim().length === 0) {
            console.warn("⚠️ Gemini returned empty response");
            return "TextNet: No response generated. Try rephrasing.";
        }

        return responseText.trim();

    } catch (error) {
        console.error("Gemini Error:", error);
        return "System error. Try again.";
    }
};