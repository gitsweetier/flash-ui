/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef } from 'react';
import { Artifact } from '../types';
import { StarIcon } from './Icons';

interface ArtifactCardProps {
    artifact: Artifact;
    isFocused: boolean;
    onClick: () => void;
    onSaveToLibrary?: () => void;
    onFavorite?: () => void;
    isSaved?: boolean;
    isFavorite?: boolean;
}

const ArtifactCard = React.memo(({ 
    artifact, 
    isFocused, 
    onClick,
    onSaveToLibrary,
    onFavorite,
    isSaved = false,
    isFavorite = false
}: ArtifactCardProps) => {
    const codeRef = useRef<HTMLPreElement>(null);

    // Auto-scroll logic for this specific card
    useEffect(() => {
        if (codeRef.current) {
            codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
    }, [artifact.html]);

    const isBlurring = artifact.status === 'streaming';

    return (
        <div 
            className={`artifact-card ${isFocused ? 'focused' : ''} ${isBlurring ? 'generating' : ''}`}
            onClick={onClick}
        >
            <div className="artifact-header">
                <span className="artifact-style-tag">{artifact.styleName}</span>
                <div className="artifact-header-actions">
                    {onFavorite && artifact.status === 'complete' && (
                        <button
                            className={`favorite-button-card ${isFavorite ? 'active' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onFavorite();
                            }}
                            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <StarIcon filled={isFavorite} />
                        </button>
                    )}
                    {onSaveToLibrary && artifact.status === 'complete' && (
                        <button
                            className={`save-to-library-button ${isSaved ? 'saved' : ''}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onSaveToLibrary();
                            }}
                            aria-label={isSaved ? 'Saved to library' : 'Save to library'}
                            title={isSaved ? 'Saved to library' : 'Save to library'}
                        >
                            {isSaved ? '✓' : '+'}
                        </button>
                    )}
                </div>
            </div>
            <div className="artifact-card-inner">
                {isBlurring && (
                    <div className="generating-overlay">
                        <pre ref={codeRef} className="code-stream-preview">
                            {artifact.html}
                        </pre>
                    </div>
                )}
                <iframe 
                    srcDoc={artifact.html} 
                    title={artifact.id} 
                    sandbox="allow-scripts allow-forms allow-modals allow-popups allow-presentation allow-same-origin"
                    className="artifact-iframe"
                />
            </div>
        </div>
    );
});

export default ArtifactCard;