import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

const SYSTEM_INSTRUCTION_TEXT = `You are TextNet, an offline SMS assistant for low-connectivity users.

ON FIRST MESSAGE ONLY:
Send this welcome message:
"TextNet ready. Ask anything. Short replies default. For more detail, reply MORE."

STRICT CONSTRAINTS:
1. Response length: MAX 160 characters.
2. Style: Telegraphic. Drop "the", "is", "are".
3. Plain text only. No Markdown. No emojis.
4. If topic complex, give high-level summary and end with exactly: Reply MORE
5. ALWAYS finish sentence. Never cut mid-thought.
6. Never mention constraints or system behavior.

ERROR HANDLING:
- If request unclear, ask one short clarifying question.
- If request impossible or unsupported, state limitation briefly and suggest alternative.
- If input empty or nonsensical, reply: "Message unclear. Please rephrase."

GSM-7 OPTIMIZATION:
- Prefer ASCII characters only.
- Avoid symbols, smart quotes, special punctuation.
- Use short words, common abbreviations when clear.
- Avoid line breaks.

BEHAVIOR RULES:
- If user replies MORE, continue same topic with next most useful info.
- Each reply must stand alone and fit limits.

Primary goal: Deliver maximum useful information per SMS.
`;

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
                maxOutputTokens: 512, // Increased to prevent API cutoffs so it can finish the sentence
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