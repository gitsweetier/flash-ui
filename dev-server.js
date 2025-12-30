import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { getModelById, DEFAULT_MODEL } from './models.ts';

// Load environment variables
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(express.json());

// Helper to parse provider-specific errors
function parseProviderError(error, provider) {
  const errorMessage = error?.message || error?.error?.message || String(error);
  const statusCode = error?.status || error?.statusCode || 500;

  if (errorMessage.includes('API key') || errorMessage.includes('api_key') || errorMessage.includes('unauthorized') || statusCode === 401) {
    return { status: 401, message: `Invalid or missing ${provider} API key. Check your ${provider.toUpperCase()}_API_KEY in .env.local` };
  }
  if (errorMessage.includes('quota') || errorMessage.includes('rate limit') || errorMessage.includes('Rate limit') || statusCode === 429) {
    return { status: 429, message: `${provider} rate limit exceeded. Please wait a moment and try again.` };
  }
  if (errorMessage.includes('not found') || errorMessage.includes('does not exist') || errorMessage.includes('Could not find model') || statusCode === 404) {
    return { status: 404, message: `Model not found. The model ID "${error.modelId || 'unknown'}" may be incorrect or unavailable.` };
  }
  if (errorMessage.includes('context length') || errorMessage.includes('too long') || errorMessage.includes('maximum')) {
    return { status: 400, message: `Request too large. Try a shorter prompt.` };
  }
  if (errorMessage.includes('billing') || errorMessage.includes('payment') || errorMessage.includes('insufficient')) {
    return { status: 402, message: `${provider} billing issue. Check your account at ${provider === 'gemini' ? 'console.cloud.google.com' : provider === 'openai' ? 'platform.openai.com' : 'console.anthropic.com'}` };
  }
  if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT') || errorMessage.includes('ECONNRESET')) {
    return { status: 504, message: `Request timed out. The ${provider} API is slow or unreachable.` };
  }

  return { status: statusCode >= 400 ? statusCode : 500, message: `${provider} error: ${errorMessage}` };
}

// Helper to convert Express req/res to Vercel format
function createVercelHandler(handler) {
  return async (req, res) => {
    const vercelReq = {
      method: req.method,
      body: req.body,
      query: req.query,
      headers: req.headers,
    };

    const vercelRes = {
      status: (code) => {
        res.status(code);
        return vercelRes;
      },
      json: (data) => res.json(data),
      setHeader: (name, value) => res.setHeader(name, value),
      write: (chunk) => res.write(chunk),
      end: () => res.end(),
    };

    await handler(vercelReq, vercelRes);
  };
}

// API: Generate
app.post('/api/generate', createVercelHandler(async (req, res) => {
  const { prompt, model = DEFAULT_MODEL, stream = false, temperature } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const modelConfig = getModelById(model);
  if (!modelConfig) {
    return res.status(400).json({ error: `Unknown model: ${model}` });
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

        const text = response.content.find(c => c.type === 'text')?.text || '';
        return res.status(200).json({ text });
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
  } catch (error) {
    console.error('API Error:', error);
    const { status, message } = parseProviderError(error, modelConfig.provider);
    return res.status(status).json({ error: message });
  }
}));

// API: Variations
app.post('/api/variations', createVercelHandler(async (req, res) => {
  const { prompt, model = DEFAULT_MODEL } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  const modelConfig = getModelById(model);
  if (!modelConfig) {
    return res.status(400).json({ error: `Unknown model: ${model}` });
  }

  try {
    const variationPrompt = `
You are a master UI/UX designer. Generate 3 RADICAL CONCEPTUAL VARIATIONS of: "${prompt}".

**STRICT IP SAFEGUARD:**
No names of artists. 
Instead, describe the *Physicality* and *Material Logic* of the UI.

**CREATIVE GUIDANCE (Use these as EXAMPLES of how to describe style, but INVENT YOUR OWN):**
1. Example: "Asymmetrical Primary Grid" (Heavy black strokes, rectilinear structure, flat primary pigments, high-contrast white space).
2. Example: "Suspended Kinetic Mobile" (Delicate wire-thin connections, floating organic primary shapes, slow-motion balance, white-void background).
3. Example: "Grainy Risograph Press" (Overprinted translucent inks, dithered grain textures, monochromatic color depth, raw paper substrate).
4. Example: "Volumetric Spectral Fluid" (Generative morphing gradients, soft-focus diffusion, bioluminescent light sources, spectral chromatic aberration).

**YOUR TASK:**
For EACH variation:
- Invent a unique design persona name based on a NEW physical metaphor.
- Rewrite the prompt to fully adopt that metaphor's visual language.
- Generate high-fidelity HTML/CSS.

Required JSON Output Format (stream ONE object per line):
\`{ "name": "Persona Name", "html": "..." }\`
    `.trim();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (modelConfig.provider === 'gemini') {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'GEMINI_API_KEY is not configured' });
      }

      const ai = new GoogleGenAI({ apiKey });
      const responseStream = await ai.models.generateContentStream({
        model: modelConfig.id,
        contents: [{ parts: [{ text: variationPrompt }], role: 'user' }],
        config: { temperature: 1.2 }
      });

      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (typeof text === 'string') {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }
    } else if (modelConfig.provider === 'claude') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured' });
      }

      const client = new Anthropic({ apiKey });
      const stream = await client.messages.stream({
        model: modelConfig.id,
        max_tokens: 8192,
        temperature: 1.2,
        messages: [{ role: 'user', content: variationPrompt }]
      });

      for await (const event of stream) {
        if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
        }
      }
    } else if (modelConfig.provider === 'openai') {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not configured' });
      }

      const client = new OpenAI({ apiKey });
      const stream = await client.chat.completions.create({
        model: modelConfig.id,
        messages: [{ role: 'user', content: variationPrompt }],
        temperature: 1.2,
        stream: true
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
        }
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Variations API Error:', error);
    const { status, message } = parseProviderError(error, modelConfig.provider);
    return res.status(status).json({ error: message });
  }
}));

// Create Vite server and use as middleware
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });

  app.use(vite.middlewares);

  const server = createHttpServer(app);
  
  server.listen(PORT, () => {
    console.log(`🚀 Dev server running at http://localhost:${PORT}`);
    console.log(`📡 API routes available at http://localhost:${PORT}/api/*`);
    console.log(`🔑 Make sure your .env.local file has GEMINI_API_KEY set`);
  });
}

startServer().catch(console.error);

