/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { AIModel, AVAILABLE_MODELS, ModelProvider } from '../models';
import { XIcon } from './Icons';

interface ModelSelectorProps {
  selectedModelId: string;
  onModelChange: (modelId: string) => void;
}

export default function ModelSelector({ selectedModelId, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId) || AVAILABLE_MODELS[0];

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const groupedModels = AVAILABLE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<ModelProvider, AIModel[]>);

  const providerLabels: Record<ModelProvider, string> = {
    gemini: 'Google Gemini',
    claude: 'Anthropic Claude',
    openai: 'OpenAI'
  };

  return (
    <div className="model-selector" ref={dropdownRef}>
      <button
        className="model-selector-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Select AI model"
      >
        <span className="model-selector-label">
          <span className="model-provider-badge" data-provider={selectedModel.provider}>
            {selectedModel.provider}
          </span>
          <span className="model-name">{selectedModel.name}</span>
        </span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
          <path d={isOpen ? "M3 9l3-3 3 3" : "M9 3l-3 3-3-3"} />
        </svg>
      </button>

      {isOpen && (
        <div className="model-selector-dropdown">
          {Object.entries(groupedModels).map(([provider, models]) => (
            <div key={provider} className="model-group">
              <div className="model-group-header">
                {providerLabels[provider as ModelProvider]}
              </div>
              {models.map(model => (
                <button
                  key={model.id}
                  className={`model-option ${selectedModelId === model.id ? 'selected' : ''}`}
                  onClick={() => {
                    onModelChange(model.id);
                    setIsOpen(false);
                  }}
                  disabled={!model.available}
                >
                  <div className="model-option-header">
                    <span className="model-option-name">{model.name}</span>
                    {selectedModelId === model.id && (
                      <span className="model-option-check">✓</span>
                    )}
                  </div>
                  <div className="model-option-description">{model.description}</div>
                  {!model.available && (
                    <div className="model-option-unavailable">Not available</div>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

