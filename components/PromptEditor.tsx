/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from 'react';

interface WordSuggestion {
    word: string;
    index: number;
    suggestions: string[];
    isLoading: boolean;
}

interface PromptEditorProps {
    originalPrompt: string;
    editedPrompt: string | null;
    onPromptChange: (newPrompt: string) => void;
    onWordClick: (word: string, index: number) => void;
    wordSuggestion: WordSuggestion | null;
    onSuggestionSelect: (word: string) => void;
    onSuggestionClose: () => void;
    disabled?: boolean;
}

export default function PromptEditor({
    originalPrompt,
    editedPrompt,
    onPromptChange,
    onWordClick,
    wordSuggestion,
    onSuggestionSelect,
    onSuggestionClose,
    disabled = false
}: PromptEditorProps) {
    const [customInput, setCustomInput] = useState('');
    const popoverRef = useRef<HTMLDivElement>(null);
    const currentPrompt = editedPrompt ?? originalPrompt;
    const words = currentPrompt.split(/\s+/);
    const originalWords = originalPrompt.split(/\s+/);

    // Close popover on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                onSuggestionClose();
            }
        };
        if (wordSuggestion) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [wordSuggestion, onSuggestionClose]);

    const handleWordClick = (word: string, index: number) => {
        if (disabled) return;
        onWordClick(word, index);
    };

    const handleSuggestionClick = (suggestion: string) => {
        onSuggestionSelect(suggestion);
        setCustomInput('');
    };

    const handleCustomSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customInput.trim()) {
            onSuggestionSelect(customInput.trim());
            setCustomInput('');
        }
    };

    const isModified = editedPrompt !== null && editedPrompt !== originalPrompt;

    return (
        <div className="prompt-editor">
            <div className="word-chips">
                {words.map((word, index) => {
                    const isChanged = originalWords[index] !== word;
                    const isActive = wordSuggestion?.index === index;

                    return (
                        <span key={index} className="word-chip-wrapper">
                            <button
                                className={`word-chip ${isChanged ? 'modified' : ''} ${isActive ? 'active' : ''}`}
                                onClick={() => handleWordClick(word, index)}
                                disabled={disabled}
                            >
                                {word}
                            </button>

                            {isActive && wordSuggestion && (
                                <div className="word-popover" ref={popoverRef}>
                                    {wordSuggestion.isLoading ? (
                                        <div className="popover-loading">
                                            <span className="loading-dot"></span>
                                            <span className="loading-dot"></span>
                                            <span className="loading-dot"></span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="suggestion-list">
                                                {wordSuggestion.suggestions.map((suggestion, i) => (
                                                    <button
                                                        key={i}
                                                        className="suggestion-item"
                                                        onClick={() => handleSuggestionClick(suggestion)}
                                                    >
                                                        {suggestion}
                                                    </button>
                                                ))}
                                            </div>
                                            <form onSubmit={handleCustomSubmit} className="custom-word-form">
                                                <input
                                                    type="text"
                                                    value={customInput}
                                                    onChange={(e) => setCustomInput(e.target.value)}
                                                    placeholder="Type custom..."
                                                    className="custom-word-input"
                                                    autoFocus
                                                />
                                            </form>
                                        </>
                                    )}
                                </div>
                            )}
                        </span>
                    );
                })}
            </div>

            {isModified && (
                <div className="prompt-modified-indicator">
                    Modified
                </div>
            )}
        </div>
    );
}
