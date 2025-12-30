/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export interface Artifact {
  id: string;
  styleName: string;
  html: string;
  status: 'streaming' | 'complete' | 'error';
}

export interface Session {
    id: string;
    prompt: string;
    timestamp: number;
    artifacts: Artifact[];
}

export interface ComponentVariation { name: string; html: string; }
export interface LayoutOption { name: string; css: string; previewHtml: string; }

// Library types
export interface SavedComponent {
  id: string;
  artifactId: string;
  sessionId: string;
  prompt: string;
  styleName: string;
  html: string;
  timestamp: number;
  tags: string[];
  collectionIds: string[];
  isFavorite: boolean;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  createdAt: number;
  componentIds: string[];
}