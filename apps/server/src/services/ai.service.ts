import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env';
import { Importance, Category } from '@deltaora/shared-types';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export interface AISummaryResult {
  summary: string;
  importance: Importance;
  category: Category;
}

export const generateSummary = async (addedText: string, removedText: string): Promise<AISummaryResult> => {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
  You are an AI assistant for a website change monitoring tool.
  Analyze the following changes to a webpage and provide a concise, human-readable summary.
  Also, determine the importance level (low, medium, high, critical) and the most relevant category (general, pricing, policy, product, careers).
  
  Format your response as a strict JSON object:
  {
    "summary": "The application deadline has been extended from August 20 to September 10. No other significant requirements changed.",
    "importance": "high",
    "category": "policy"
  }

  Added Text:
  ${addedText}

  Removed Text:
  ${removedText}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from potential markdown block
    const jsonStr = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(jsonStr) as AISummaryResult;

    // Validate enums just in case
    if (!Object.values(Importance).includes(parsed.importance)) parsed.importance = Importance.LOW;
    if (!Object.values(Category).includes(parsed.category)) parsed.category = Category.GENERAL;

    return parsed;
  } catch (error) {
    console.error('Failed to generate AI summary:', error);
    // Fallback
    return {
      summary: 'Changes were detected but AI summarization failed.',
      importance: Importance.LOW,
      category: Category.GENERAL
    };
  }
};
