/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { Collection } from '../types';
import { XIcon } from './Icons';

interface CollectionEditorProps {
  collection?: Collection | null;
  onSave: (collection: Omit<Collection, 'id' | 'createdAt' | 'componentIds'>) => void;
  onCancel: () => void;
}

const COLLECTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#ef4444', '#f59e0b', '#10b981', '#06b6d4'
];

export default function CollectionEditor({ collection, onSave, onCancel }: CollectionEditorProps) {
  const [name, setName] = useState(collection?.name || '');
  const [description, setDescription] = useState(collection?.description || '');
  const [color, setColor] = useState(collection?.color || COLLECTION_COLORS[0]);

  useEffect(() => {
    if (collection) {
      setName(collection.name || '');
      setDescription(collection.description || '');
      setColor(collection.color || COLLECTION_COLORS[0]);
    } else {
      setName('');
      setDescription('');
      setColor(COLLECTION_COLORS[0]);
    }
  }, [collection]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), description: description.trim() || undefined, color });
    }
  };

  return (
    <div className="collection-editor">
      <div className="collection-editor-header">
        <h3>{collection ? 'Edit Collection' : 'New Collection'}</h3>
        <button className="close-button" onClick={onCancel}>
          <XIcon />
        </button>
      </div>
      <form onSubmit={handleSubmit} className="collection-editor-form">
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Collection"
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label>Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A collection for..."
            rows={3}
          />
        </div>
        <div className="form-group">
          <label>Color</label>
          <div className="color-picker">
            {COLLECTION_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`color-option ${color === c ? 'selected' : ''}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                aria-label={`Select color ${c}`}
              />
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit">Save</button>
        </div>
      </form>
    </div>
  );
}

