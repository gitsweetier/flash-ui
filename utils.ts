/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Library storage utilities
import type { SavedComponent, Collection } from './types';

const LIBRARY_STORAGE_KEY = 'flash-ui-library';
const COLLECTIONS_STORAGE_KEY = 'flash-ui-collections';

export function getSavedComponents(): SavedComponent[] {
  try {
    const stored = localStorage.getItem(LIBRARY_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveComponent(component: SavedComponent): void {
  const components = getSavedComponents();
  const existingIndex = components.findIndex(c => c.id === component.id);
  if (existingIndex >= 0) {
    components[existingIndex] = component;
  } else {
    components.push(component);
  }
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(components));
}

export function removeComponent(componentId: string): void {
  const components = getSavedComponents();
  const filtered = components.filter(c => c.id !== componentId);
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(filtered));
}

export function getCollections(): Collection[] {
  try {
    const stored = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function saveCollection(collection: Collection): void {
  const collections = getCollections();
  const existingIndex = collections.findIndex(c => c.id === collection.id);
  if (existingIndex >= 0) {
    collections[existingIndex] = collection;
  } else {
    collections.push(collection);
  }
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(collections));
}

export function deleteCollection(collectionId: string): void {
  const collections = getCollections();
  const filtered = collections.filter(c => c.id !== collectionId);
  localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(filtered));
  
  // Remove collection from all components
  const components = getSavedComponents();
  components.forEach(comp => {
    comp.collectionIds = comp.collectionIds.filter(id => id !== collectionId);
  });
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(components));
}

// API helper functions for Vercel serverless functions
// Use current window location in dev to support any port, or empty string for production
const API_BASE = import.meta.env.DEV 
  ? `${window.location.protocol}//${window.location.hostname}:${window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}`
  : '';

export async function* streamGenerateContent(prompt: string, temperature?: number, modelId?: string) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, stream: true, temperature, model: modelId })
    });
  } catch (error: any) {
    throw new Error(`Network error: ${error.message || 'Failed to connect to API. Make sure the dev server is running on port 3001.'}`);
  }

  if (!response.ok) {
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response isn't JSON, use status text
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error('No response body received from server');

  let buffer = '';
  let hasReceivedData = false;
  const timeout = 60000; // 60 second timeout
  const startTime = Date.now();

  try {
    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Request timeout: The API took too long to respond. Please try again.');
      }

      const { done, value } = await reader.read();
      if (done) break;

      hasReceivedData = true;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              yield { text: parsed.text };
            }
            if (parsed.error) {
              throw new Error(`API error: ${parsed.error}`);
            }
          } catch (e: any) {
            if (e.message && e.message.includes('API error')) {
              throw e;
            }
            // Skip invalid JSON chunks
          }
        }
      }
    }

    if (!hasReceivedData) {
      throw new Error('No data received from API. The server may not be responding correctly.');
    }
  } catch (error: any) {
    // Re-throw with more context if it's not already a formatted error
    if (error.message && !error.message.includes('error') && !error.message.includes('timeout')) {
      throw new Error(`Stream error: ${error.message}`);
    }
    throw error;
  }
}

export async function generateContent(prompt: string, modelId?: string) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, stream: false, model: modelId })
    });
  } catch (error: any) {
    throw new Error(`Network error: ${error.message || 'Failed to connect to API. Make sure the dev server is running on port 3001.'}`);
  }

  if (!response.ok) {
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response isn't JSON, use status text
    }
    throw new Error(errorMessage);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`API error: ${data.error}`);
  }
  return { text: data.text || '' };
}

export async function* streamVariations(prompt: string, modelId?: string) {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/variations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, model: modelId })
    });
  } catch (error: any) {
    throw new Error(`Network error: ${error.message || 'Failed to connect to API. Make sure the dev server is running on port 3001.'}`);
  }

  if (!response.ok) {
    let errorMessage = `API error: ${response.status} ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.error) {
        errorMessage = errorData.error;
      }
    } catch {
      // If response isn't JSON, use status text
    }
    throw new Error(errorMessage);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) throw new Error('No response body received from server');

  let buffer = '';
  let hasReceivedData = false;
  const timeout = 60000; // 60 second timeout
  const startTime = Date.now();

  try {
    while (true) {
      if (Date.now() - startTime > timeout) {
        throw new Error('Request timeout: The API took too long to respond. Please try again.');
      }

      const { done, value } = await reader.read();
      if (done) break;

      hasReceivedData = true;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              yield { text: parsed.text };
            }
            if (parsed.error) {
              throw new Error(`API error: ${parsed.error}`);
            }
          } catch (e: any) {
            if (e.message && e.message.includes('API error')) {
              throw e;
            }
            // Skip invalid JSON chunks
          }
        }
      }
    }

    if (!hasReceivedData) {
      throw new Error('No data received from API. The server may not be responding correctly.');
    }
  } catch (error: any) {
    // Re-throw with more context if it's not already a formatted error
    if (error.message && !error.message.includes('error') && !error.message.includes('timeout')) {
      throw new Error(`Stream error: ${error.message}`);
    }
    throw error;
  }
}