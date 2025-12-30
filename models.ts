/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type ModelProvider = 'gemini' | 'claude' | 'openai';

export interface AIModel {
  id: string;
  name: string;
  provider: ModelProvider;
  description: string;
  apiKeyEnv?: string;
  available: boolean;
}

export const AVAILABLE_MODELS: AIModel[] = [
  // Google Gemini 3 Models (December 2025)
  // Gemini 3 series now available in preview
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    provider: 'gemini',
    description: 'Latest Gemini, fast frontier-class performance (default)',
    apiKeyEnv: 'GEMINI_API_KEY',
    available: true
  },
  {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro',
    provider: 'gemini',
    description: 'Most capable Gemini 3, best for complex tasks',
    apiKeyEnv: 'GEMINI_API_KEY',
    available: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Stable 2.5 model, reliable and fast',
    apiKeyEnv: 'GEMINI_API_KEY',
    available: true
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Stable 2.5 Pro, great reasoning',
    apiKeyEnv: 'GEMINI_API_KEY',
    available: true
  },

  // Anthropic Claude 4.5 Models (December 2025)
  {
    id: 'claude-opus-4-5',
    name: 'Claude Opus 4.5',
    provider: 'claude',
    description: 'Flagship model, best for complex agentic tasks',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    available: true
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'claude',
    description: 'Fast and capable, great balance of speed/quality',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    available: true
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'claude',
    description: 'Fastest Claude, optimized for low latency',
    apiKeyEnv: 'ANTHROPIC_API_KEY',
    available: true
  },

  // OpenAI Models (December 2025)
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    description: 'Faster, cost-efficient version of GPT-5 for well-defined tasks',
    apiKeyEnv: 'OPENAI_API_KEY',
    available: true
  },
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'openai',
    description: 'Fastest, most cost-efficient version of GPT-5',
    apiKeyEnv: 'OPENAI_API_KEY',
    available: true
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    description: 'GPT-5.2 Thinking - primary reasoning model for professional work',
    apiKeyEnv: 'OPENAI_API_KEY',
    available: true
  }
];

export const DEFAULT_MODEL = 'gemini-3-flash-preview';

export function getModelById(id: string): AIModel | undefined {
  return AVAILABLE_MODELS.find(m => m.id === id);
}

export function getModelsByProvider(provider: ModelProvider): AIModel[] {
  return AVAILABLE_MODELS.filter(m => m.provider === provider);
}

