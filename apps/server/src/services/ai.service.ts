import { GoogleGenAI, Type, Schema } from '@google/genai';
import { env } from '../config/env';
import { Importance, Category } from '@deltaora/shared-types';

// ── 2026 Standard: New @google/genai SDK ──
const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

export interface AISummaryResult {
  summary: string;
  importance: Importance;
  category: Category;
}

// ── 2026 Standard: Native Structured Outputs ──
// We define the exact JSON Schema we want the model to return.
// The API enforces this mathematically at generation time, removing
// the need for regex parsing, JSON.parse hacks, or prompt engineering.
const summarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description: "A concise, human-readable summary of the changes between the old and new text. Focus only on what actually matters to a user (e.g., price changes, deadline updates).",
    },
    importance: {
      type: Type.STRING,
      enum: Object.values(Importance),
      description: "The importance level of the change.",
    },
    category: {
      type: Type.STRING,
      enum: Object.values(Category),
      description: "The category that best fits the change.",
    },
  },
  required: ["summary", "importance", "category"],
};

const SYSTEM_INSTRUCTION = `You are an AI assistant for a website change monitoring tool.
Analyze the following additions and removals to a webpage's text content.
Your job is to provide a concise, human-readable summary of what actually changed.
Determine the importance level (low, medium, high, critical) and the most relevant category.`;

/**
 * Utility function to sleep for exponential backoff
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Generate a summary of text changes using Gemini.
 * 
 * 2026 Standards implemented:
 * - Uses gemini-2.5-flash for high-speed, cost-effective processing
 * - Native Structured Outputs via responseSchema
 * - System Instructions for persona isolation
 * - Exponential backoff retry logic for resilience
 */
export const generateSummary = async (addedText: string, removedText: string, retries = 3): Promise<AISummaryResult> => {
  const prompt = `Added Text:\n${addedText || "(None)"}\n\nRemoved Text:\n${removedText || "(None)"}`;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: summarySchema,
          temperature: 0.2, // Low temperature for deterministic classification
        },
      });

      if (!response.text) {
        throw new Error("Model returned empty response text");
      }

      // 2026 Standard: No regex parsing needed. The SDK handles JSON when responseMimeType is set, 
      // but response.text is still a stringified JSON. We just JSON.parse it directly.
      const parsed = JSON.parse(response.text) as AISummaryResult;

      // Fallback validations just in case (though API enforces the schema)
      if (!Object.values(Importance).includes(parsed.importance)) parsed.importance = Importance.LOW;
      if (!Object.values(Category).includes(parsed.category)) parsed.category = Category.GENERAL;

      return parsed;

    } catch (error: any) {
      lastError = error;
      console.warn(`AI Summary attempt ${attempt}/${retries} failed:`, error.message);

      // If it's a 429 Rate Limit or 503 Service Unavailable, apply exponential backoff
      if (error.status === 429 || error.status === 503) {
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 1000;
          await sleep(delay);
        }
      } else {
        // For other errors (e.g. auth error, schema validation failure), don't retry, just break
        break;
      }
    }
  }

  console.error('Failed to generate AI summary after retries:', lastError);
  
  // Graceful fallback
  return {
    summary: 'Changes were detected but AI summarization failed.',
    importance: Importance.LOW,
    category: Category.GENERAL,
  };
};
