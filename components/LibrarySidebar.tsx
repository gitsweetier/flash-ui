/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useMemo } from 'react';
import { SavedComponent, Collection } from '../types';
import { getCollections, deleteCollection } from '../utils';
import { LibraryIcon, FolderIcon, StarIcon, TagIcon, XIcon, PlusIcon } from './Icons';

interface LibrarySidebarProps {
  savedComponents: SavedComponent[];
  collections: Collection[];
  onComponentSelect: (component: SavedComponent) => void;
  onCollectionCreate: () => void;
  onCollectionUpdate: (collection: Collection) => void;
  onCollectionDelete: (id: string) => void;
  onClose: () => void;
}

interface LibrarySidebarPropsWithData extends LibrarySidebarProps {
  initialFilter?: 'favorites' | 'all';
}

export default function LibrarySidebar({
  savedComponents,
  collections,
  onComponentSelect,
  onCollectionCreate,
  onCollectionUpdate,
  onCollectionDelete,
  onClose,
  initialFilter
}: LibrarySidebarPropsWithData) {
  const [activeTab, setActiveTab] = useState<'all' | 'favorites' | 'collections'>(initialFilter === 'favorites' ? 'favorites' : 'all');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredComponents = useMemo(() => {
    let filtered = savedComponents;

    // Filter by tab
    if (activeTab === 'favorites') {
      filtered = filtered.filter(c => c.isFavorite);
    } else if (activeTab === 'collections' && selectedCollectionId) {
      filtered = filtered.filter(c => c.collectionIds.includes(selectedCollectionId));
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.prompt.toLowerCase().includes(query) ||
        c.styleName.toLowerCase().includes(query) ||
        c.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }, [savedComponents, activeTab, selectedCollectionId, searchQuery]);

  const selectedCollection = collections.find(c => c.id === selectedCollectionId);

  return (
    <div className="library-sidebar">
      <div className="library-header">
        <div className="library-title">
          <LibraryIcon /> Library
        </div>
        <button className="close-library-button" onClick={onClose} aria-label="Close library">
          <XIcon />
        </button>
      </div>

      <div className="library-search">
        <input
          type="text"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="library-search-input"
        />
      </div>

      <div className="library-tabs">
        <button
          className={`library-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => { setActiveTab('all'); setSelectedCollectionId(null); }}
        >
          All ({savedComponents.length})
        </button>
        <button
          className={`library-tab ${activeTab === 'favorites' ? 'active' : ''}`}
          onClick={() => { setActiveTab('favorites'); setSelectedCollectionId(null); }}
        >
          <StarIcon filled /> Favorites ({savedComponents.filter(c => c.isFavorite).length})
        </button>
        <button
          className={`library-tab ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          <FolderIcon /> Collections ({collections.length})
        </button>
      </div>

      {activeTab === 'collections' && (
        <div className="collections-list">
          <button className="create-collection-button" onClick={onCollectionCreate}>
            <PlusIcon /> New Collection
          </button>
          {collections.map(collection => (
            <div
              key={collection.id}
              className={`collection-item ${selectedCollectionId === collection.id ? 'active' : ''}`}
              onClick={() => setSelectedCollectionId(collection.id === selectedCollectionId ? null : collection.id)}
            >
              <div className="collection-color" style={{ backgroundColor: collection.color || '#6366f1' }} />
              <div className="collection-info">
                <div className="collection-name">{collection.name}</div>
                <div className="collection-count">{collection.componentIds.length} components</div>
              </div>
              {selectedCollectionId === collection.id && (
                <button
                  className="delete-collection-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${collection.name}"?`)) {
                      onCollectionDelete(collection.id);
                      if (selectedCollectionId === collection.id) {
                        setSelectedCollectionId(null);
                      }
                    }
                  }}
                >
                  <XIcon />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="library-components">
        {selectedCollection && (
          <div className="collection-header">
            <h3>{selectedCollection.name}</h3>
            {selectedCollection.description && <p>{selectedCollection.description}</p>}
          </div>
        )}
        
        {filteredComponents.length === 0 ? (
          <div className="library-empty">
            {searchQuery ? 'No components match your search' : 
             activeTab === 'favorites' ? 'No favorites yet' :
             activeTab === 'collections' && !selectedCollectionId ? 'Select a collection' :
             'No components saved'}
          </div>
        ) : (
          <div className="library-grid">
            {filteredComponents.map(component => (
              <div
                key={component.id}
                className="library-component-card"
                onClick={() => onComponentSelect(component)}
              >
                <div className="component-preview">
                  <iframe
                    srcDoc={component.html}
                    title={component.id}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
                <div className="component-info">
                  <div className="component-title">{component.styleName}</div>
                  <div className="component-prompt">{component.prompt}</div>
                  {component.tags.length > 0 && (
                    <div className="component-tags">
                      {component.tags.map(tag => (
                        <span key={tag} className="component-tag">
                          <TagIcon /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {component.isFavorite && (
                    <div className="component-favorite-badge">
                      <StarIcon filled />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

