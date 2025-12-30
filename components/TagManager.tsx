/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';
import { TagIcon, XIcon, PlusIcon } from './Icons';

interface TagManagerProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  suggestions?: string[];
}

export default function TagManager({ tags, onTagsChange, suggestions = [] }: TagManagerProps) {
  const [inputValue, setInputValue] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onTagsChange([...tags, trimmed]);
      setInputValue('');
      setShowSuggestions(false);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag(inputValue);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      inputRef.current?.blur();
    }
  };

  const filteredSuggestions = suggestions.filter(
    s => !tags.includes(s.toLowerCase()) && s.toLowerCase().includes(inputValue.toLowerCase())
  );

  return (
    <div className="tag-manager" ref={containerRef}>
      <div className="tags-list">
        {tags.map(tag => (
          <span key={tag} className="tag">
            <TagIcon /> {tag}
            <button
              className="tag-remove"
              onClick={() => handleRemoveTag(tag)}
              aria-label={`Remove tag ${tag}`}
            >
              <XIcon />
            </button>
          </span>
        ))}
      </div>
      <div className="tag-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder="Add tag..."
          className="tag-input"
        />
        {inputValue && (
          <button
            className="tag-add-button"
            onClick={() => handleAddTag(inputValue)}
            aria-label="Add tag"
          >
            <PlusIcon />
          </button>
        )}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="tag-suggestions">
            {filteredSuggestions.slice(0, 5).map(suggestion => (
              <button
                key={suggestion}
                className="tag-suggestion"
                onClick={() => handleAddTag(suggestion)}
              >
                <TagIcon /> {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

