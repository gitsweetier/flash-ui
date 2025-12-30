import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getModelById, DEFAULT_MODEL } from '../models';

// Helper to parse provider-specific errors
function parseProviderError(error: any, provider: string): { status: number; message: string } {
  const errorMessage = error?.message || error?.error?.message || String(error);
  const statusCode = error?.status || error?.statusCode || 500;

  // Common error patterns
  if (errorMessage.includes('API key') || errorMessage.includes('api_key') || errorMessage.includes('unauthorized') || statusCode === 401) {
    return { status: 401, message: `Invalid or missing ${provider} API key. Check your ${provider.toUpperCase()}_API_KEY environment variable.` };
  }
  if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('Rate limit') || statusCode === 429) {
    return { status: 429, message: `${provider} rate limit exceeded. Please wait a moment and try again.` };
  }
  if (errorMessage.includes('not found') || errorMessage.includes('does not exist') || errorMessage.includes('Could not find model') || statusCode === 404) {
    return { status: 404, message: `Model not found. The model ID may be incorrect or the model may not be available in your region.` };
  }
  if (errorMessage.includes('context length') || errorMessage.includes('too long') || errorMessage.includes('maximum')) {
    return { status: 400, message: `Request too large. Try a shorter prompt or reduce the content.` };
  }
  if (errorMessage.includes('billing') || errorMessage.includes('payment') || errorMessage.includes('insufficient')) {
    return { status: 402, message: `${provider} billing issue. Check your account billing settings.` };
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET')) {
    return { status: 504, message: `Request timed out. The ${provider} API is slow or unreachable. Try again.` };
  }

  return { status: statusCode >= 400 ? statusCode : 500, message: `${provider} error: ${errorMessage}` };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, model = DEFAULT_MODEL, stream = false, temperature } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const modelConfig = getModelById(model);
  if (!modelConfig) {
    return res.status(400).json({ error: `Unknown model: "${model}". Available models can be found in the model selector.` });
  }

  try {
    if (modelConfig.provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const responseStream = await ai.models.generateContentStream({
          model: modelConfig.id,
          contents: [{ parts: [{ text: prompt }], role: 'user' }],
          config: temperature ? { temperature } : undefined
        });

        for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text === 'string') {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await ai.models.generateContent({
          model: modelConfig.id,
          contents: [{ parts: [{ text: prompt }], role: 'user' }]
        });

        return res.status(200).json({ text: response.text || '' });
      }
    } else if (modelConfig.provider === 'claude') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
      }

      const client = new Anthropic({ apiKey });

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await client.messages.stream({
          model: modelConfig.id,
          max_tokens: 8192,
          temperature: temperature || 1.0,
          messages: [{ role: 'user', content: prompt }]
        });

        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await client.messages.create({
          model: modelConfig.id,
          max_tokens: 8192,
          temperature: temperature || 1.0,
          messages: [{ role: 'user', content: prompt }]
        });

        const text = response.content.find(c => c.type === 'text') as { type: 'text'; text: string } | undefined;
        return res.status(200).json({ text: text?.text || '' });
      }
    } else if (modelConfig.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
      }

      const client = new OpenAI({ apiKey });

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const stream = await client.chat.completions.create({
          model: modelConfig.id,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature || 1.0,
          stream: true
        });

        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
        }

        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const response = await client.chat.completions.create({
          model: modelConfig.id,
          messages: [{ role: 'user', content: prompt }],
          temperature: temperature || 1.0
        });

        const text = response.choices[0]?.message?.content || '';
        return res.status(200).json({ text });
      }
    } else {
      return res.status(400).json({ error: `Unsupported provider: ${modelConfig.provider}` });
    }
  } catch (error: any) {
    console.error('API Error:', error);
    const { status, message } = parseProviderError(error, modelConfig.provider);
    return res.status(status).json({ error: message });
  }
}
