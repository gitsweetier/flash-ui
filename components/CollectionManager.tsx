/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';
import { Collection } from '../types';
import { FolderIcon, XIcon } from './Icons';

interface CollectionManagerProps {
  collections: Collection[];
  componentId: string;
  onCollectionsChange: (collectionIds: string[]) => void;
  onCreateCollection: () => void;
}

const COLLECTION_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#ef4444', '#f59e0b', '#10b981', '#06b6d4'
];

export default function CollectionManager({
  collections,
  componentId,
  onCollectionsChange,
  onCreateCollection
}: CollectionManagerProps) {
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

  React.useEffect(() => {
    // Find which collections contain this component
    const containingCollections = collections
      .filter(c => c.componentIds.includes(componentId))
      .map(c => c.id);
    setSelectedCollections(containingCollections);
  }, [collections, componentId]);

  const handleToggleCollection = (collectionId: string) => {
    const newSelected = selectedCollections.includes(collectionId)
      ? selectedCollections.filter(id => id !== collectionId)
      : [...selectedCollections, collectionId];
    
    setSelectedCollections(newSelected);
    onCollectionsChange(newSelected);
  };

  return (
    <div className="collection-manager">
      <div className="collection-manager-header">
        <h3>Collections</h3>
        <button className="create-collection-btn" onClick={onCreateCollection}>
          + New Collection
        </button>
      </div>
      <div className="collections-checkbox-list">
        {collections.length === 0 ? (
          <div className="no-collections">
            No collections yet. <button onClick={onCreateCollection}>Create one</button>
          </div>
        ) : (
          collections.map(collection => (
            <label key={collection.id} className="collection-checkbox">
              <input
                type="checkbox"
                checked={selectedCollections.includes(collection.id)}
                onChange={() => handleToggleCollection(collection.id)}
              />
              <div
                className="collection-color-dot"
                style={{ backgroundColor: collection.color || COLLECTION_COLORS[0] }}
              />
              <span>{collection.name}</span>
              {collection.componentIds.length > 0 && (
                <span className="collection-count">({collection.componentIds.length})</span>
              )}
            </label>
          ))
        )}
      </div>
    </div>
  );
}

