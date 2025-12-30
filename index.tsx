/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

//Vibe coded by ammaar@google.com

import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';

import { Artifact, Session, ComponentVariation, LayoutOption, SavedComponent, Collection } from './types';
import { INITIAL_PLACEHOLDERS } from './constants';
import { DEFAULT_MODEL } from './models';
import { generateId, generateContent, streamGenerateContent, streamVariations, getSavedComponents, saveComponent, removeComponent, getCollections, saveCollection, deleteCollection } from './utils';

import DottedGlowBackground from './components/DottedGlowBackground';
import ArtifactCard from './components/ArtifactCard';
import SideDrawer from './components/SideDrawer';
import PromptEditor from './components/PromptEditor';
import LibrarySidebar from './components/LibrarySidebar';
import TagManager from './components/TagManager';
import CollectionManager from './components/CollectionManager';
import CollectionEditor from './components/CollectionEditor';
import ModelSelector from './components/ModelSelector';
import {
    ThinkingIcon,
    CodeIcon,
    SparklesIcon,
    ArrowLeftIcon,
    ArrowRightIcon,
    ArrowUpIcon,
    GridIcon,
    RefreshIcon,
    StyleIcon,
    CopyIcon,
    LibraryIcon,
    StarIcon,
    EyeOffIcon,
    BlendIcon,
    MoreLikeThisIcon,
    CheckIcon
} from './components/Icons';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(-1);
  const [focusedArtifactIndex, setFocusedArtifactIndex] = useState<number | null>(null);
  
  const [inputValue, setInputValue] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [placeholders, setPlaceholders] = useState<string[]>(INITIAL_PLACEHOLDERS);
  
  const [drawerState, setDrawerState] = useState<{
      isOpen: boolean;
      mode: 'code' | 'variations' | 'library' | 'tags' | 'collections' | 'collection-editor' | null;
      title: string;
      data: any; 
  }>({ isOpen: false, mode: null, title: '', data: null });

  // Library state
  const [savedComponents, setSavedComponents] = useState<SavedComponent[]>(getSavedComponents());
  const [collections, setCollections] = useState<Collection[]>(getCollections());
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);

  // Model selection state
  const [selectedModelId, setSelectedModelId] = useState<string>(() => {
    const stored = localStorage.getItem('flash-ui-selected-model');
    return stored || DEFAULT_MODEL;
  });

  useEffect(() => {
    localStorage.setItem('flash-ui-selected-model', selectedModelId);
  }, [selectedModelId]);

  const [componentVariations, setComponentVariations] = useState<ComponentVariation[]>([]);

  // Word substitution state
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);
  const [wordSuggestion, setWordSuggestion] = useState<{
      word: string;
      index: number;
      suggestions: string[];
      isLoading: boolean;
  } | null>(null);

  // Style DNA state
  const [lockedStyle, setLockedStyle] = useState<{
      html: string;
      styleName: string;
  } | null>(null);

  // Hidden artifacts state (per session)
  const [hiddenArtifacts, setHiddenArtifacts] = useState<Set<string>>(new Set());

  // Style blend selection state
  const [blendSelection, setBlendSelection] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const gridScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      inputRef.current?.focus();
  }, []);

  // Close library dropdown when clicking outside
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          const libraryDropdown = document.querySelector('.library-dropdown');
          const libraryMenu = document.querySelector('.library-menu');
          if (libraryDropdown && libraryMenu && !libraryDropdown.contains(event.target as Node)) {
              libraryMenu.classList.remove('open');
          }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
          document.removeEventListener('mousedown', handleClickOutside);
      };
  }, []);

  // Fix for mobile: reset scroll when focusing an item to prevent "overscroll" state
  useEffect(() => {
    if (focusedArtifactIndex !== null && window.innerWidth <= 1024) {
        if (gridScrollRef.current) {
            gridScrollRef.current.scrollTop = 0;
        }
        window.scrollTo(0, 0);
    }
  }, [focusedArtifactIndex]);

  // Cycle placeholders
  useEffect(() => {
      const interval = setInterval(() => {
          setPlaceholderIndex(prev => (prev + 1) % placeholders.length);
      }, 3000);
      return () => clearInterval(interval);
  }, [placeholders.length]);

  // Dynamic placeholder generation on load
  useEffect(() => {
      const fetchDynamicPlaceholders = async () => {
          try {
              const prompt = 'Generate 20 creative, short, diverse UI component prompts (e.g. "bioluminescent task list"). Return ONLY a raw JSON array of strings. IP SAFEGUARD: Avoid referencing specific famous artists, movies, or brands.';
              const response = await generateContent(prompt, selectedModelId);
              const text = response.text || '[]';
              const jsonMatch = text.match(/\[[\s\S]*\]/);
              if (jsonMatch) {
                  const newPlaceholders = JSON.parse(jsonMatch[0]);
                  if (Array.isArray(newPlaceholders) && newPlaceholders.length > 0) {
                      const shuffled = newPlaceholders.sort(() => 0.5 - Math.random()).slice(0, 10);
                      setPlaceholders(prev => [...prev, ...shuffled]);
                  }
              }
          } catch (e) {
              console.warn("Silently failed to fetch dynamic placeholders", e);
          }
      };
      setTimeout(fetchDynamicPlaceholders, 1000);
  }, []);

  // Clear state when switching sessions
  useEffect(() => {
      setEditedPrompt(null);
      setHiddenArtifacts(new Set());
      setBlendSelection([]);
      setWordSuggestion(null);
  }, [currentSessionIndex]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(event.target.value);
  };

  const parseJsonStream = async function* (responseStream: AsyncGenerator<{ text: string }>) {
      let buffer = '';
      for await (const chunk of responseStream) {
          const text = chunk.text;
          if (typeof text !== 'string') continue;
          buffer += text;
          let braceCount = 0;
          let start = buffer.indexOf('{');
          while (start !== -1) {
              braceCount = 0;
              let end = -1;
              for (let i = start; i < buffer.length; i++) {
                  if (buffer[i] === '{') braceCount++;
                  else if (buffer[i] === '}') braceCount--;
                  if (braceCount === 0 && i > start) {
                      end = i;
                      break;
                  }
              }
              if (end !== -1) {
                  const jsonString = buffer.substring(start, end + 1);
                  try {
                      yield JSON.parse(jsonString);
                      buffer = buffer.substring(end + 1);
                      start = buffer.indexOf('{');
                  } catch (e) {
                      start = buffer.indexOf('{', start + 1);
                  }
              } else {
                  break; 
              }
          }
      }
  };

  const handleGenerateVariations = useCallback(async () => {
    const currentSession = sessions[currentSessionIndex];
    if (!currentSession || focusedArtifactIndex === null) return;
    const currentArtifact = currentSession.artifacts[focusedArtifactIndex];

    setIsLoading(true);
    setComponentVariations([]);
    setDrawerState({ isOpen: true, mode: 'variations', title: 'Variations', data: currentArtifact.id });

    try {
        const prompt = `
You are a master UX designer. Generate 5 RADICAL UX VARIATIONS of: "${currentSession.prompt}".

**GOAL:**
Create fundamentally different user experience approaches - different information architectures, interaction patterns, and user flows. Not just visual style changes.

**FOR EACH VARIATION:**
- Invent a unique UX approach name (e.g., "Progressive Disclosure", "Inline Edit", "Command Palette", "Split View", "Timeline Scrubber")
- Describe the target user and their primary job to be done
- Specify the main interaction pattern
- List the information hierarchy (what users see/do first)
- Include required states (loading, empty, error, etc.)
- Generate high-fidelity HTML/CSS that implements this UX approach

**DESIGN FOCUS:**
- Prioritize usability and clarity over decoration
- Include realistic microcopy and proper states
- Implement keyboard navigation and accessibility basics
- Use clean, readable visual design that supports the UX goals

Required JSON Output Format (stream ONE object per line):
\`{ "name": "UX Approach Name", "html": "..." }\`
        `.trim();

        const responseStream = streamVariations(prompt, selectedModelId);

        for await (const variation of parseJsonStream(responseStream)) {
            if (variation.name && variation.html) {
                setComponentVariations(prev => [...prev, variation]);
            }
        }
    } catch (e: any) {
        console.error("Error generating variations:", e);
        const errorMessage = e.message || 'Unknown error occurred';
        setDrawerState(prev => ({
            ...prev,
            title: `Error: ${errorMessage}`,
            data: {
                error: true,
                message: errorMessage,
                details: 'Failed to generate variations. Please check your API configuration and try again.'
            }
        }));
    } finally {
        setIsLoading(false);
    }
  }, [sessions, currentSessionIndex, focusedArtifactIndex]);

  const applyVariation = (html: string) => {
      if (focusedArtifactIndex === null) return;
      setSessions(prev => prev.map((sess, i) => 
          i === currentSessionIndex ? {
              ...sess,
              artifacts: sess.artifacts.map((art, j) => 
                j === focusedArtifactIndex ? { ...art, html, status: 'complete' } : art
              )
          } : sess
      ));
      setDrawerState(s => ({ ...s, isOpen: false }));
  };

  const handleShowCode = () => {
      const currentSession = sessions[currentSessionIndex];
      if (currentSession && focusedArtifactIndex !== null) {
          const artifact = currentSession.artifacts[focusedArtifactIndex];
          setDrawerState({ isOpen: true, mode: 'code', title: 'Source Code', data: artifact.html });
      }
  };

  const [copySuccess, setCopySuccess] = useState(false);

  const handleCopyCode = useCallback(async () => {
      if (drawerState.mode === 'code' && drawerState.data) {
          try {
              // Try modern clipboard API first (works on most modern browsers)
              if (navigator.clipboard && navigator.clipboard.writeText) {
                  await navigator.clipboard.writeText(drawerState.data);
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000);
                  return;
              }
              
              // Fallback for older browsers and mobile Safari (iOS < 13.4, older Android)
              const textArea = document.createElement('textarea');
              textArea.value = drawerState.data;
              // Style to be invisible but still selectable
              textArea.style.position = 'fixed';
              textArea.style.top = '0';
              textArea.style.left = '0';
              textArea.style.width = '2em';
              textArea.style.height = '2em';
              textArea.style.padding = '0';
              textArea.style.border = 'none';
              textArea.style.outline = 'none';
              textArea.style.boxShadow = 'none';
              textArea.style.background = 'transparent';
              textArea.style.opacity = '0';
              textArea.style.zIndex = '-9999';
              
              document.body.appendChild(textArea);
              textArea.focus();
              textArea.select();
              
              // For mobile, we need to set selection range
              if (textArea.setSelectionRange) {
                  textArea.setSelectionRange(0, drawerState.data.length);
              }
              
              try {
                  const successful = document.execCommand('copy');
                  document.body.removeChild(textArea);
                  
                  if (successful) {
                      setCopySuccess(true);
                      setTimeout(() => setCopySuccess(false), 2000);
                  } else {
                      throw new Error('Copy command failed');
                  }
              } catch (err) {
                  document.body.removeChild(textArea);
                  console.error('Failed to copy code:', err);
                  // Show user-friendly message
                  alert('Copy failed. Please manually select the code and copy it (Cmd/Ctrl+C).');
              }
          } catch (err) {
              console.error('Failed to copy code:', err);
              // If clipboard API fails, try fallback
              try {
                  const textArea = document.createElement('textarea');
                  textArea.value = drawerState.data;
                  textArea.style.position = 'fixed';
                  textArea.style.top = '50%';
                  textArea.style.left = '50%';
                  textArea.style.transform = 'translate(-50%, -50%)';
                  textArea.style.width = '90%';
                  textArea.style.height = '200px';
                  textArea.style.zIndex = '9999';
                  textArea.style.background = 'white';
                  textArea.style.color = 'black';
                  textArea.style.padding = '10px';
                  textArea.style.border = '2px solid #333';
                  textArea.style.borderRadius = '8px';
                  
                  document.body.appendChild(textArea);
                  textArea.focus();
                  textArea.select();
                  
                  // Give user a moment to see the textarea, then try to copy
                  setTimeout(() => {
                      try {
                          document.execCommand('copy');
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                      } catch (e) {
                          // User can manually copy from visible textarea
                      }
                      setTimeout(() => document.body.removeChild(textArea), 1000);
                  }, 100);
              } catch (e) {
                  alert('Please manually select and copy the code from the source view.');
              }
          }
      }
  }, [drawerState]);

  // Reset copy success state when switching away from code view
  useEffect(() => {
      if (drawerState.mode !== 'code') {
          setCopySuccess(false);
      }
  }, [drawerState.mode]);

  // Word substitution handlers
  const handleWordClick = useCallback(async (word: string, index: number) => {
      setWordSuggestion({ word, index, suggestions: [], isLoading: true });

      try {
          const prompt = `
You are helping a designer explore creative alternatives for UI prompt words.

Original word: "${word}"
Context: This word is part of a UI design prompt.

Generate 5 alternative words that would change the VISUAL FEEL of the design without changing the core UX/functionality.
Focus on words that evoke different:
- Materials (glass, paper, metal, organic, etc.)
- Moods (playful, serious, ethereal, bold, etc.)
- Visual styles (minimal, maximal, geometric, organic, etc.)

Return ONLY a raw JSON array of 5 single words. Example: ["ethereal", "brutalist", "organic", "neon", "vintage"]
          `.trim();

          const response = await generateContent(prompt);
          const text = response.text || '[]';
          const jsonMatch = text.match(/\[[\s\S]*\]/);

          if (jsonMatch) {
              const suggestions = JSON.parse(jsonMatch[0]);
              setWordSuggestion({ word, index, suggestions, isLoading: false });
          } else {
              setWordSuggestion(null);
          }
      } catch (e) {
          console.error('Error fetching word suggestions:', e);
          setWordSuggestion(null);
      }
  }, []);

  const handleWordReplace = useCallback((newWord: string) => {
      if (!wordSuggestion) return;
      const session = sessions[currentSessionIndex];
      if (!session) return;

      const originalPrompt = session.prompt;
      const currentPrompt = editedPrompt ?? originalPrompt;
      const words = currentPrompt.split(/\s+/);
      words[wordSuggestion.index] = newWord;
      const newPrompt = words.join(' ');

      setEditedPrompt(newPrompt);
      setWordSuggestion(null);
  }, [wordSuggestion, sessions, currentSessionIndex, editedPrompt]);

  // Style DNA handlers (defined before handleSendMessage since it depends on lockedStyle)
  const handleLockStyle = useCallback(() => {
      if (focusedArtifactIndex === null) return;
      const session = sessions[currentSessionIndex];
      if (!session) return;
      const artifact = session.artifacts[focusedArtifactIndex];
      setLockedStyle({
          html: artifact.html,
          styleName: artifact.styleName
      });
  }, [focusedArtifactIndex, sessions, currentSessionIndex]);

  const handleUnlockStyle = useCallback(() => {
      setLockedStyle(null);
  }, []);

  // Hide artifact handler
  const handleHideArtifact = useCallback((artifactId: string) => {
      setHiddenArtifacts(prev => {
          const newSet = new Set(prev);
          newSet.add(artifactId);
          return newSet;
      });
      // If hiding the focused artifact, unfocus
      const session = sessions[currentSessionIndex];
      if (session && focusedArtifactIndex !== null) {
          const focusedArtifact = session.artifacts[focusedArtifactIndex];
          if (focusedArtifact.id === artifactId) {
              setFocusedArtifactIndex(null);
          }
      }
  }, [sessions, currentSessionIndex, focusedArtifactIndex]);

  // Restore all hidden artifacts
  const handleRestoreHidden = useCallback(() => {
      setHiddenArtifacts(new Set());
  }, []);

  // Toggle blend selection
  const handleToggleBlendSelection = useCallback((artifactId: string) => {
      setBlendSelection(prev => {
          if (prev.includes(artifactId)) {
              return prev.filter(id => id !== artifactId);
          } else if (prev.length < 2) {
              return [...prev, artifactId];
          }
          // If already 2 selected, replace the first one
          return [prev[1], artifactId];
      });
  }, []);

  const handleSendMessage = useCallback(async (manualPrompt?: string) => {
    const promptToUse = manualPrompt || inputValue;
    const trimmedInput = promptToUse.trim();
    
    if (!trimmedInput || isLoading) return;
    if (!manualPrompt) setInputValue('');

    setIsLoading(true);
    const baseTime = Date.now();
    const sessionId = generateId();

    const placeholderArtifacts: Artifact[] = Array(5).fill(null).map((_, i) => ({
        id: `${sessionId}_${i}`,
        styleName: 'Designing...',
        html: '',
        status: 'streaming',
    }));

    const newSession: Session = {
        id: sessionId,
        prompt: trimmedInput,
        timestamp: baseTime,
        artifacts: placeholderArtifacts
    };

    setSessions(prev => [...prev, newSession]);
    setCurrentSessionIndex(sessions.length);
    setFocusedArtifactIndex(null);
    setEditedPrompt(null); // Clear any edited prompt when starting new session 

    try {
        const uxPrompt = `
Generate 5 distinct, highly divergent UX directions for: "${trimmedInput}".

**GOAL:**
Create radically different user experience approaches, not visual styles. Focus on structure, flow, information architecture, and interaction patterns.

**FOR EACH UX DIRECTION, PROVIDE:**
- name: A short, evocative name (e.g., "Progressive Disclosure Wizard", "Inline Edit Dashboard", "Command Palette Interface", "Split View Workspace", "Timeline Scrubber")
- targetUser: Who is this designed for? (e.g., "power users who need speed", "novices who need guidance", "mobile-first commuters")
- jobToBeDone: What core job does this help the user accomplish?
- primaryAction: The main action users take (e.g., "filter and compare", "quick edit", "navigate via search")
- secondaryActions: 2-3 supporting actions
- informationHierarchy: Top 5 elements in order of importance (what users see/do first)
- requiredStates: List required UI states (e.g., ["loading", "empty", "error", "success", "editing"])
- accessibilityNotes: Key accessibility considerations (e.g., "keyboard navigation essential", "screen reader announcements", "high contrast required")

**STRICT IP SAFEGUARD:**
Never use artist or brand names. Focus on UX patterns and user needs.

**OUTPUT FORMAT:**
Return ONLY a raw JSON array of 5 objects. Each object must have: name, targetUser, jobToBeDone, primaryAction, secondaryActions (array), informationHierarchy (array), requiredStates (array), accessibilityNotes (string).

Example structure:
[
  {
    "name": "Progressive Disclosure Wizard",
    "targetUser": "novices who need step-by-step guidance",
    "jobToBeDone": "complete a complex task without feeling overwhelmed",
    "primaryAction": "advance through steps with clear progress",
    "secondaryActions": ["skip optional steps", "review previous steps", "save progress"],
    "informationHierarchy": ["current step title", "step instructions", "input fields", "progress indicator", "navigation buttons"],
    "requiredStates": ["loading", "validation error", "success", "saved draft"],
    "accessibilityNotes": "keyboard navigation, ARIA live regions for step changes, focus management"
  }
]
        `.trim();

        let uxResponse;
        try {
            uxResponse = await generateContent(uxPrompt, selectedModelId);
        } catch (e: any) {
            console.error("Error generating UX directions:", e);
            throw new Error(`Failed to generate UX directions: ${e.message || 'Unknown error'}`);
        }

        let generatedUxDirections: Array<{
            name: string;
            targetUser: string;
            jobToBeDone: string;
            primaryAction: string;
            secondaryActions: string[];
            informationHierarchy: string[];
            requiredStates: string[];
            accessibilityNotes: string;
        }> = [];
        
        const uxText = uxResponse.text || '[]';
        const jsonMatch = uxText.match(/\[[\s\S]*\]/);
        
        if (jsonMatch) {
            try {
                generatedUxDirections = JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.warn("Failed to parse UX directions, using fallbacks");
            }
        }

        if (!generatedUxDirections || generatedUxDirections.length < 5) {
            generatedUxDirections = [
                {
                    name: "Progressive Disclosure Wizard",
                    targetUser: "novices who need step-by-step guidance",
                    jobToBeDone: "complete a complex task without feeling overwhelmed",
                    primaryAction: "advance through steps with clear progress",
                    secondaryActions: ["skip optional steps", "review previous steps"],
                    informationHierarchy: ["current step title", "step instructions", "input fields", "progress indicator", "navigation buttons"],
                    requiredStates: ["loading", "validation error", "success"],
                    accessibilityNotes: "keyboard navigation, ARIA live regions"
                },
                {
                    name: "Inline Edit Dashboard",
                    targetUser: "power users who need speed",
                    jobToBeDone: "edit multiple items quickly without page reloads",
                    primaryAction: "click to edit in place",
                    secondaryActions: ["bulk actions", "filter and sort", "export data"],
                    informationHierarchy: ["data table", "inline edit controls", "save/cancel buttons", "status indicators", "toolbar"],
                    requiredStates: ["editing", "saving", "error", "success"],
                    accessibilityNotes: "keyboard shortcuts, focus management, screen reader announcements"
                },
                {
                    name: "Command Palette Interface",
                    targetUser: "keyboard-first power users",
                    jobToBeDone: "access any feature instantly via search",
                    primaryAction: "type to search and execute commands",
                    secondaryActions: ["navigate results", "see keyboard shortcuts", "recent commands"],
                    informationHierarchy: ["search input", "command results", "preview/help text", "keyboard hints", "recent history"],
                    requiredStates: ["searching", "no results", "executing", "success"],
                    accessibilityNotes: "keyboard only, ARIA combobox, live search results"
                },
                {
                    name: "Split View Workspace",
                    targetUser: "users comparing or referencing multiple views",
                    jobToBeDone: "work with related information side-by-side",
                    primaryAction: "navigate between panels",
                    secondaryActions: ["resize panels", "sync scrolling", "close panels"],
                    informationHierarchy: ["left panel content", "right panel content", "resize handle", "panel controls", "sync indicator"],
                    requiredStates: ["loading", "empty", "error", "syncing"],
                    accessibilityNotes: "keyboard panel navigation, focus trap, screen reader panel announcements"
                },
                {
                    name: "Timeline Scrubber",
                    targetUser: "users exploring chronological or sequential data",
                    jobToBeDone: "navigate through time-based information intuitively",
                    primaryAction: "scrub through timeline to see changes",
                    secondaryActions: ["zoom in/out", "jump to date", "play animation"],
                    informationHierarchy: ["timeline control", "current view", "detail panel", "zoom controls", "playback controls"],
                    requiredStates: ["loading", "playing", "paused", "error"],
                    accessibilityNotes: "keyboard timeline navigation, ARIA slider, live region updates"
                }
            ];
        }

        generatedUxDirections = generatedUxDirections.slice(0, 5);

        setSessions(prev => prev.map(s => {
            if (s.id !== sessionId) return s;
            return {
                ...s,
                artifacts: s.artifacts.map((art, i) => ({
                    ...art,
                    styleName: generatedUxDirections[i]?.name || 'Designing...'
                }))
            };
        }));

        const generateArtifact = async (artifact: Artifact, uxSpec: typeof generatedUxDirections[0]) => {
            try {
                // Build the base prompt with UX focus
                let prompt = `
You are Flash UI. Create a high-fidelity, usable UI component for: "${trimmedInput}".

**UX DIRECTION: ${uxSpec.name}**

**UX SPECIFICATION:**
- Target User: ${uxSpec.targetUser}
- Job to be Done: ${uxSpec.jobToBeDone}
- Primary Action: ${uxSpec.primaryAction}
- Secondary Actions: ${uxSpec.secondaryActions.join(', ')}
- Information Hierarchy (in order): ${uxSpec.informationHierarchy.join(' → ')}
- Required States: ${uxSpec.requiredStates.join(', ')}
- Accessibility: ${uxSpec.accessibilityNotes}

**DESIGN PRINCIPLES:**
1. **Usability First**: Optimize for clarity and ease of use, not decoration. Visual design should support the UX goals.
2. **State Management**: Implement ALL required states (${uxSpec.requiredStates.join(', ')}) with clear visual feedback.
3. **Accessibility**: ${uxSpec.accessibilityNotes}. Include proper ARIA labels, keyboard navigation, and focus management.
4. **Microcopy**: Include realistic, helpful text (button labels, helper text, error messages, empty states).
5. **Visual Hierarchy**: Respect the information hierarchy. The most important elements should be visually prominent.
6. **Performance**: Use efficient CSS. Avoid heavy filters or complex animations that distract from usability.
`;

                // Add style reference if style is locked
                if (lockedStyle) {
                    prompt += `
**STYLE REFERENCE - MATCH THIS AESTHETIC:**
Analyze and match the visual style (colors, typography, textures, spacing, visual language) from this reference:
\`\`\`html
${lockedStyle.html}
\`\`\`

IMPORTANT: Use the SAME visual style (colors, fonts, textures, effects) but create a COMPLETELY DIFFERENT UX structure that follows the UX specification above.
`;
                } else {
                    prompt += `
**VISUAL STYLE GUIDANCE:**
- Use system fonts or high-quality web fonts (avoid decorative fonts)
- High contrast for readability
- Clear spacing and visual breathing room
- Subtle, purposeful animations (focus states, transitions)
- Avoid excessive shadows, gradients, or effects that reduce usability
`;
                }

                prompt += `
**TECHNICAL REQUIREMENTS:**
- Include all required states with appropriate UI feedback
- Implement keyboard navigation (tab order, enter/esc keys)
- Use semantic HTML
- Include proper form labels and ARIA attributes where needed
- Add realistic microcopy (not placeholder text)
- Return ONLY RAW HTML. No markdown fences.
                `.trim();
          
                const responseStream = streamGenerateContent(prompt, undefined, selectedModelId);

                let accumulatedHtml = '';
                for await (const chunk of responseStream) {
                    const text = chunk.text;
                    if (typeof text === 'string') {
                        accumulatedHtml += text;
                        setSessions(prev => prev.map(sess => 
                            sess.id === sessionId ? {
                                ...sess,
                                artifacts: sess.artifacts.map(art => 
                                    art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                                )
                            } : sess
                        ));
                    }
                }
                
                let finalHtml = accumulatedHtml.trim();
                if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                if (!finalHtml) {
                    throw new Error('No HTML content received from API');
                }

                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { ...art, html: finalHtml, status: 'complete' } : art
                        )
                    } : sess
                ));

            } catch (e: any) {
                console.error('Error generating artifact:', e);
                const errorMessage = e.message || 'Unknown error occurred';
                const errorHtml = `
                    <div style="padding: 40px; text-align: center; color: #ff6b6b; font-family: system-ui, -apple-system, sans-serif;">
                        <div style="font-size: 24px; margin-bottom: 16px;">⚠️ Design Generation Failed</div>
                        <div style="font-size: 14px; color: #ff9999; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
                            ${errorMessage}
                        </div>
                        <div style="font-size: 12px; color: #999; margin-top: 24px;">
                            <div>Common issues:</div>
                            <ul style="text-align: left; display: inline-block; margin-top: 8px;">
                                <li>API key not configured (check .env file)</li>
                                <li>Network connection issues</li>
                                <li>API rate limits exceeded</li>
                                <li>Server not running (check port 3001)</li>
                            </ul>
                        </div>
                    </div>
                `;
                setSessions(prev => prev.map(sess => 
                    sess.id === sessionId ? {
                        ...sess,
                        artifacts: sess.artifacts.map(art => 
                            art.id === artifact.id ? { 
                                ...art, 
                                html: errorHtml, 
                                status: 'error',
                                styleName: 'Error'
                            } : art
                        )
                    } : sess
                ));
            }
        };

        await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedUxDirections[i])));

    } catch (e: any) {
        console.error("Fatal error in generation process", e);
        const errorMessage = e.message || 'Unknown error occurred';
        
        // Update all artifacts in the session to show error
        setSessions(prev => prev.map(sess => {
            if (sess.id !== sessionId) return sess;
            return {
                ...sess,
                artifacts: sess.artifacts.map(art => ({
                    ...art,
                    html: `
                        <div style="padding: 40px; text-align: center; color: #ff6b6b; font-family: system-ui, -apple-system, sans-serif;">
                            <div style="font-size: 24px; margin-bottom: 16px;">⚠️ Generation Failed</div>
                            <div style="font-size: 14px; color: #ff9999; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
                                ${errorMessage}
                            </div>
                            <div style="font-size: 12px; color: #999; margin-top: 24px;">
                                Please check your API configuration and try again.
                            </div>
                        </div>
                    `,
                    status: 'error' as const,
                    styleName: 'Error'
                }))
            };
        }));
    } finally {
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputValue, isLoading, sessions.length, lockedStyle]);

  // Handlers that depend on handleSendMessage
  const handleRegenerateWithEdits = useCallback(() => {
      if (!editedPrompt) return;
      handleSendMessage(editedPrompt);
      setEditedPrompt(null);
  }, [editedPrompt, handleSendMessage]);

  const handleRemixLayout = useCallback(() => {
      const currentSession = sessions[currentSessionIndex];
      if (!lockedStyle || !currentSession) return;
      handleSendMessage(currentSession.prompt);
  }, [lockedStyle, sessions, currentSessionIndex, handleSendMessage]);

  // "More Like This" - generate 5 similar designs based on focused artifact
  const handleMoreLikeThis = useCallback(async () => {
      const session = sessions[currentSessionIndex];
      if (!session || focusedArtifactIndex === null || isLoading) return;

      const sourceArtifact = session.artifacts[focusedArtifactIndex];
      if (sourceArtifact.status !== 'complete') return;

      setIsLoading(true);
      const baseTime = Date.now();
      const sessionId = generateId();

      const placeholderArtifacts: Artifact[] = Array(5).fill(null).map((_, i) => ({
          id: `${sessionId}_${i}`,
          styleName: 'Designing...',
          html: '',
          status: 'streaming' as const,
      }));

      const newSession: Session = {
          id: sessionId,
          prompt: `More like: ${session.prompt}`,
          timestamp: baseTime,
          artifacts: placeholderArtifacts
      };

      setSessions(prev => [...prev, newSession]);
      setCurrentSessionIndex(sessions.length);
      setFocusedArtifactIndex(null);

      try {
          // Generate 5 style variations based on the source
          const stylePrompt = `
Analyze this HTML design and generate 5 creative variations of its visual style.

SOURCE DESIGN:
\`\`\`html
${sourceArtifact.html}
\`\`\`

Generate 5 distinct style names that are similar in spirit but with interesting variations.
Each should evoke a slightly different mood or material quality while maintaining the core aesthetic.

Return ONLY a raw JSON array of 5 creative style names.
          `.trim();

          let styleResponse;
          try {
              styleResponse = await generateContent(stylePrompt, selectedModelId);
          } catch (e: any) {
              console.error("Error generating styles:", e);
              throw new Error(`Failed to generate styles: ${e.message || 'Unknown error'}`);
          }
          let generatedStyles: string[] = [];
          const styleText = styleResponse.text || '[]';
          const jsonMatch = styleText.match(/\[[\s\S]*\]/);

          if (jsonMatch) {
              try {
                  generatedStyles = JSON.parse(jsonMatch[0]);
              } catch (e) {
                  console.warn("Failed to parse styles");
              }
          }

          if (!generatedStyles || generatedStyles.length < 5) {
              generatedStyles = [
                  `${sourceArtifact.styleName} - Refined`,
                  `${sourceArtifact.styleName} - Bold`,
                  `${sourceArtifact.styleName} - Minimal`,
                  `${sourceArtifact.styleName} - Warm`,
                  `${sourceArtifact.styleName} - Cool`
              ];
          }

          generatedStyles = generatedStyles.slice(0, 5);

          setSessions(prev => prev.map(s => {
              if (s.id !== sessionId) return s;
              return {
                  ...s,
                  artifacts: s.artifacts.map((art, i) => ({
                      ...art,
                      styleName: generatedStyles[i]
                  }))
              };
          }));

          const generateArtifact = async (artifact: Artifact, styleInstruction: string) => {
              try {
                  const prompt = `
You are Flash UI. Create a design SIMILAR to the reference but with this variation: "${styleInstruction}".

REFERENCE DESIGN (match the overall aesthetic and quality):
\`\`\`html
${sourceArtifact.html}
\`\`\`

ORIGINAL PROMPT: "${session.prompt}"

Create a new design that:
1. Maintains the same visual language (colors, typography, textures)
2. Applies the variation "${styleInstruction}"
3. May have a different layout but keeps the same component type
4. Matches or exceeds the quality of the reference

Return ONLY RAW HTML. No markdown fences.
                  `.trim();

                  const responseStream = streamGenerateContent(prompt, undefined, selectedModelId);
                  let accumulatedHtml = '';

                  for await (const chunk of responseStream) {
                      const text = chunk.text;
                      if (typeof text === 'string') {
                          accumulatedHtml += text;
                          setSessions(prev => prev.map(sess =>
                              sess.id === sessionId ? {
                                  ...sess,
                                  artifacts: sess.artifacts.map(art =>
                                      art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                                  )
                              } : sess
                          ));
                      }
                  }

                  let finalHtml = accumulatedHtml.trim();
                  if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                  if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                  if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                  setSessions(prev => prev.map(sess =>
                      sess.id === sessionId ? {
                          ...sess,
                          artifacts: sess.artifacts.map(art =>
                              art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                          )
                      } : sess
                  ));
    } catch (e: any) {
        console.error('Error generating artifact:', e);
        const errorMessage = e.message || 'Unknown error occurred';
        const errorHtml = `
            <div style="padding: 40px; text-align: center; color: #ff6b6b; font-family: system-ui, -apple-system, sans-serif;">
                <div style="font-size: 24px; margin-bottom: 16px;">⚠️ Design Generation Failed</div>
                <div style="font-size: 14px; color: #ff9999; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
                    ${errorMessage}
                </div>
            </div>
        `;
        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? {
                ...sess,
                artifacts: sess.artifacts.map(art => 
                    art.id === artifact.id ? { 
                        ...art, 
                        html: errorHtml, 
                        status: 'error',
                        styleName: 'Error'
                    } : art
                )
            } : sess
        ));
    }
          };

          await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, generatedStyles[i])));

      } catch (e: any) {
          console.error("Error in More Like This:", e);
          const errorMessage = e.message || 'Unknown error occurred';
          
          // Update all artifacts to show error
          setSessions(prev => prev.map(sess => {
              if (sess.id !== sessionId) return sess;
              return {
                  ...sess,
                  artifacts: sess.artifacts.map(art => ({
                      ...art,
                      html: `
                          <div style="padding: 40px; text-align: center; color: #ff6b6b; font-family: system-ui, -apple-system, sans-serif;">
                              <div style="font-size: 24px; margin-bottom: 16px;">⚠️ Generation Failed</div>
                              <div style="font-size: 14px; color: #ff9999; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
                                  ${errorMessage}
                              </div>
                          </div>
                      `,
                      status: 'error' as const,
                      styleName: 'Error'
                  }))
              };
          }));
      } finally {
          setIsLoading(false);
      }
  }, [sessions, currentSessionIndex, focusedArtifactIndex, isLoading]);

  // "Blend Styles" - combine 2 selected designs into 5 hybrids
  const handleBlendStyles = useCallback(async () => {
      const session = sessions[currentSessionIndex];
      if (!session || blendSelection.length !== 2 || isLoading) return;

      const artifact1 = session.artifacts.find(a => a.id === blendSelection[0]);
      const artifact2 = session.artifacts.find(a => a.id === blendSelection[1]);

      if (!artifact1 || !artifact2 || artifact1.status !== 'complete' || artifact2.status !== 'complete') return;

      setIsLoading(true);
      setBlendSelection([]);
      const baseTime = Date.now();
      const sessionId = generateId();

      const placeholderArtifacts: Artifact[] = Array(5).fill(null).map((_, i) => ({
          id: `${sessionId}_${i}`,
          styleName: 'Blending...',
          html: '',
          status: 'streaming' as const,
      }));

      const newSession: Session = {
          id: sessionId,
          prompt: `Blend: ${artifact1.styleName} + ${artifact2.styleName}`,
          timestamp: baseTime,
          artifacts: placeholderArtifacts
      };

      setSessions(prev => [...prev, newSession]);
      setCurrentSessionIndex(sessions.length);
      setFocusedArtifactIndex(null);

      try {
          // Generate blend variations
          const blendNames = [
              `${artifact1.styleName} × ${artifact2.styleName} (50/50)`,
              `${artifact1.styleName} dominant`,
              `${artifact2.styleName} dominant`,
              `Fusion: Structure meets Texture`,
              `Hybrid: Best of Both`
          ];

          setSessions(prev => prev.map(s => {
              if (s.id !== sessionId) return s;
              return {
                  ...s,
                  artifacts: s.artifacts.map((art, i) => ({
                      ...art,
                      styleName: blendNames[i]
                  }))
              };
          }));

          const blendRatios = [
              { a: 50, b: 50 },
              { a: 70, b: 30 },
              { a: 30, b: 70 },
              { a: 60, b: 40 },
              { a: 40, b: 60 }
          ];

          const generateArtifact = async (artifact: Artifact, blendName: string, ratio: { a: number, b: number }) => {
              try {
                  const prompt = `
You are Flash UI. Blend two design styles into a cohesive hybrid.

STYLE A (${ratio.a}% influence):
\`\`\`html
${artifact1.html}
\`\`\`

STYLE B (${ratio.b}% influence):
\`\`\`html
${artifact2.html}
\`\`\`

ORIGINAL PROMPT: "${session.prompt}"

Create a hybrid design that:
1. Takes ${ratio.a}% visual influence from Style A (colors, typography, etc.)
2. Takes ${ratio.b}% visual influence from Style B
3. Harmoniously blends both aesthetics
4. Creates something new that honors both sources

Return ONLY RAW HTML. No markdown fences.
                  `.trim();

                  const responseStream = streamGenerateContent(prompt, undefined, selectedModelId);
                  let accumulatedHtml = '';

                  for await (const chunk of responseStream) {
                      const text = chunk.text;
                      if (typeof text === 'string') {
                          accumulatedHtml += text;
                          setSessions(prev => prev.map(sess =>
                              sess.id === sessionId ? {
                                  ...sess,
                                  artifacts: sess.artifacts.map(art =>
                                      art.id === artifact.id ? { ...art, html: accumulatedHtml } : art
                                  )
                              } : sess
                          ));
                      }
                  }

                  let finalHtml = accumulatedHtml.trim();
                  if (finalHtml.startsWith('```html')) finalHtml = finalHtml.substring(7).trimStart();
                  if (finalHtml.startsWith('```')) finalHtml = finalHtml.substring(3).trimStart();
                  if (finalHtml.endsWith('```')) finalHtml = finalHtml.substring(0, finalHtml.length - 3).trimEnd();

                  setSessions(prev => prev.map(sess =>
                      sess.id === sessionId ? {
                          ...sess,
                          artifacts: sess.artifacts.map(art =>
                              art.id === artifact.id ? { ...art, html: finalHtml, status: finalHtml ? 'complete' : 'error' } : art
                          )
                      } : sess
                  ));
    } catch (e: any) {
        console.error('Error generating artifact:', e);
        const errorMessage = e.message || 'Unknown error occurred';
        const errorHtml = `
            <div style="padding: 40px; text-align: center; color: #ff6b6b; font-family: system-ui, -apple-system, sans-serif;">
                <div style="font-size: 24px; margin-bottom: 16px;">⚠️ Design Generation Failed</div>
                <div style="font-size: 14px; color: #ff9999; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
                    ${errorMessage}
                </div>
            </div>
        `;
        setSessions(prev => prev.map(sess => 
            sess.id === sessionId ? {
                ...sess,
                artifacts: sess.artifacts.map(art => 
                    art.id === artifact.id ? { 
                        ...art, 
                        html: errorHtml, 
                        status: 'error',
                        styleName: 'Error'
                    } : art
                )
            } : sess
        ));
    }
          };

          await Promise.all(placeholderArtifacts.map((art, i) => generateArtifact(art, blendNames[i], blendRatios[i])));

      } catch (e: any) {
          console.error("Error in Blend Styles:", e);
          const errorMessage = e.message || 'Unknown error occurred';
          
          // Update all artifacts to show error
          setSessions(prev => prev.map(sess => {
              if (sess.id !== sessionId) return sess;
              return {
                  ...sess,
                  artifacts: sess.artifacts.map(art => ({
                      ...art,
                      html: `
                          <div style="padding: 40px; text-align: center; color: #ff6b6b; font-family: system-ui, -apple-system, sans-serif;">
                              <div style="font-size: 24px; margin-bottom: 16px;">⚠️ Blend Failed</div>
                              <div style="font-size: 14px; color: #ff9999; margin-bottom: 24px; max-width: 500px; margin-left: auto; margin-right: auto;">
                                  ${errorMessage}
                              </div>
                          </div>
                      `,
                      status: 'error' as const,
                      styleName: 'Error'
                  }))
              };
          }));
      } finally {
          setIsLoading(false);
      }
  }, [sessions, currentSessionIndex, blendSelection, isLoading]);

  // Library handlers
  const handleSaveToLibrary = useCallback((artifactId?: string, sessionId?: string) => {
      const artifactIdToUse = artifactId || (focusedArtifactIndex !== null ? sessions[currentSessionIndex]?.artifacts[focusedArtifactIndex]?.id : null);
      const sessionIdToUse = sessionId || sessions[currentSessionIndex]?.id;
      
      if (!artifactIdToUse || !sessionIdToUse) return;
      
      const session = sessions.find(s => s.id === sessionIdToUse);
      if (!session) return;
      const artifact = session.artifacts.find(a => a.id === artifactIdToUse);
      if (!artifact || artifact.status !== 'complete') return;

      // Check if already saved
      const existingComponent = savedComponents.find(
          c => c.artifactId === artifact.id && c.sessionId === session.id
      );

      if (existingComponent) {
          // Already saved, just update
          return;
      }

      const savedComponent: SavedComponent = {
          id: generateId(),
          artifactId: artifact.id,
          sessionId: session.id,
          prompt: session.prompt,
          styleName: artifact.styleName,
          html: artifact.html,
          timestamp: Date.now(),
          tags: [],
          collectionIds: [],
          isFavorite: false
      };

      saveComponent(savedComponent);
      setSavedComponents(getSavedComponents());
  }, [sessions, currentSessionIndex, focusedArtifactIndex, savedComponents]);

  const handleSaveAndFavorite = useCallback((artifactId: string, sessionId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;
      const artifact = session.artifacts.find(a => a.id === artifactId);
      if (!artifact || artifact.status !== 'complete') return;

      // Check if already saved
      const existingComponent = savedComponents.find(
          c => c.artifactId === artifact.id && c.sessionId === session.id
      );

      let componentToUpdate: SavedComponent;
      
      if (existingComponent) {
          // Already saved, just toggle favorite
          componentToUpdate = existingComponent;
      } else {
          // Save first, then favorite
          componentToUpdate = {
              id: generateId(),
              artifactId: artifact.id,
              sessionId: session.id,
              prompt: session.prompt,
              styleName: artifact.styleName,
              html: artifact.html,
              timestamp: Date.now(),
              tags: [],
              collectionIds: [],
              isFavorite: true
          };
      }

      componentToUpdate.isFavorite = !componentToUpdate.isFavorite;
      saveComponent(componentToUpdate);
      setSavedComponents(getSavedComponents());
  }, [sessions, savedComponents]);

  const handleToggleFavorite = useCallback((componentId: string) => {
      const components = getSavedComponents();
      const component = components.find(c => c.id === componentId);
      if (component) {
          component.isFavorite = !component.isFavorite;
          saveComponent(component);
          setSavedComponents(getSavedComponents());
      }
  }, []);

  const handleUpdateTags = useCallback((componentId: string, tags: string[]) => {
      const components = getSavedComponents();
      const component = components.find(c => c.id === componentId);
      if (component) {
          component.tags = tags;
          saveComponent(component);
          setSavedComponents(getSavedComponents());
      }
  }, []);

  const handleUpdateCollections = useCallback((componentId: string, collectionIds: string[]) => {
      const components = getSavedComponents();
      const component = components.find(c => c.id === componentId);
      if (component) {
          component.collectionIds = collectionIds;
          saveComponent(component);
          setSavedComponents(getSavedComponents());

          // Update collection component lists
          const allCollections = getCollections();
          allCollections.forEach(collection => {
              const hasComponent = collection.componentIds.includes(componentId);
              const shouldHaveComponent = collectionIds.includes(collection.id);
              
              if (shouldHaveComponent && !hasComponent) {
                  collection.componentIds.push(componentId);
                  saveCollection(collection);
              } else if (!shouldHaveComponent && hasComponent) {
                  collection.componentIds = collection.componentIds.filter(id => id !== componentId);
                  saveCollection(collection);
              }
          });
          setCollections(getCollections());
      }
  }, []);

  const handleCreateCollection = useCallback((collectionData: Omit<Collection, 'id' | 'createdAt' | 'componentIds'>) => {
      const newCollection: Collection = {
          ...collectionData,
          id: generateId(),
          createdAt: Date.now(),
          componentIds: []
      };
      saveCollection(newCollection);
      setCollections(getCollections());
      setEditingCollection(null);
  }, []);

  const handleUpdateCollection = useCallback((collection: Collection) => {
      saveCollection(collection);
      setCollections(getCollections());
      setEditingCollection(null);
  }, []);

  const handleDeleteCollection = useCallback((collectionId: string) => {
      deleteCollection(collectionId);
      setCollections(getCollections());
      setSavedComponents(getSavedComponents());
  }, []);

  const handleComponentSelect = useCallback((component: SavedComponent) => {
      // Find the session and artifact, or create a new session with this component
      const sessionIndex = sessions.findIndex(s => s.id === component.sessionId);
      if (sessionIndex >= 0) {
          const artifactIndex = sessions[sessionIndex].artifacts.findIndex(a => a.id === component.artifactId);
          if (artifactIndex >= 0) {
              setCurrentSessionIndex(sessionIndex);
              setFocusedArtifactIndex(artifactIndex);
              setDrawerState({ isOpen: false, mode: null, title: '', data: null });
          }
      } else {
          // Create a new session with this component
          const newSession: Session = {
              id: component.sessionId,
              prompt: component.prompt,
              timestamp: component.timestamp,
              artifacts: [{
                  id: component.artifactId,
                  styleName: component.styleName,
                  html: component.html,
                  status: 'complete'
              }]
          };
          setSessions(prev => [...prev, newSession]);
          setCurrentSessionIndex(sessions.length);
          setFocusedArtifactIndex(0);
          setDrawerState({ isOpen: false, mode: null, title: '', data: null });
      }
  }, [sessions]);

  const isComponentSaved = useCallback((artifactId: string, sessionId: string) => {
      return savedComponents.some(c => c.artifactId === artifactId && c.sessionId === sessionId);
  }, [savedComponents]);

  const handleSurpriseMe = () => {
      const currentPrompt = placeholders[placeholderIndex];
      setInputValue(currentPrompt);
      handleSendMessage(currentPrompt);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading) {
      event.preventDefault();
      handleSendMessage();
    } else if (event.key === 'Tab' && !inputValue && !isLoading) {
        event.preventDefault();
        setInputValue(placeholders[placeholderIndex]);
    }
  };

  const nextItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex < 4) setFocusedArtifactIndex(focusedArtifactIndex + 1);
      } else {
          if (currentSessionIndex < sessions.length - 1) setCurrentSessionIndex(currentSessionIndex + 1);
      }
  }, [currentSessionIndex, sessions.length, focusedArtifactIndex]);

  const prevItem = useCallback(() => {
      if (focusedArtifactIndex !== null) {
          if (focusedArtifactIndex > 0) setFocusedArtifactIndex(focusedArtifactIndex - 1);
      } else {
           if (currentSessionIndex > 0) setCurrentSessionIndex(currentSessionIndex - 1);
      }
  }, [currentSessionIndex, focusedArtifactIndex]);

  const isLoadingDrawer = isLoading && drawerState.mode === 'variations' && componentVariations.length === 0;

  const hasStarted = sessions.length > 0 || isLoading;
  const currentSession = sessions[currentSessionIndex];

  let canGoBack = false;
  let canGoForward = false;

  if (hasStarted) {
      if (focusedArtifactIndex !== null) {
          canGoBack = focusedArtifactIndex > 0;
          canGoForward = focusedArtifactIndex < (currentSession?.artifacts.length || 0) - 1;
      } else {
          canGoBack = currentSessionIndex > 0;
          canGoForward = currentSessionIndex < sessions.length - 1;
      }
  }

  return (
    <>
        <a href="https://x.com/ammaar" target="_blank" rel="noreferrer" className={`creator-credit ${hasStarted ? 'hide-on-mobile' : ''}`}>
            created by @ammaar
        </a>

        <SideDrawer 
            isOpen={drawerState.isOpen} 
            onClose={() => {
                setDrawerState(s => ({...s, isOpen: false}));
                setCopySuccess(false); // Reset copy success state when closing
            }} 
            title={drawerState.title}
        >
            {isLoadingDrawer && (
                 <div className="loading-state">
                     <ThinkingIcon /> 
                     Designing variations...
                 </div>
            )}

            {drawerState.mode === 'code' && (
                <div className="code-block-wrapper">
                    <button 
                        className={`copy-code-button ${copySuccess ? 'copied' : ''}`}
                        onClick={handleCopyCode}
                        aria-label="Copy code"
                    >
                        <CopyIcon /> {copySuccess ? 'Copied!' : 'Copy Code'}
                    </button>
                    <pre className="code-block"><code>{drawerState.data}</code></pre>
                </div>
            )}
            
            {drawerState.mode === 'variations' && (
                <>
                    {drawerState.data?.error ? (
                        <div style={{padding: '40px', textAlign: 'center', color: '#ff6b6b', fontFamily: 'system-ui, -apple-system, sans-serif'}}>
                            <div style={{fontSize: '24px', marginBottom: '16px'}}>⚠️ Error Generating Variations</div>
                            <div style={{fontSize: '14px', color: '#ff9999', marginBottom: '24px'}}>
                                {drawerState.data.message || 'Unknown error occurred'}
                            </div>
                            <div style={{fontSize: '12px', color: '#999'}}>
                                {drawerState.data.details || 'Please try again.'}
                            </div>
                        </div>
                    ) : componentVariations.length > 0 ? (
                        <div className="sexy-grid">
                            {componentVariations.map((v, i) => (
                                 <div key={i} className="sexy-card" onClick={() => applyVariation(v.html)}>
                                     <div className="sexy-preview">
                                         <iframe srcDoc={v.html} title={v.name} sandbox="allow-scripts allow-same-origin" />
                                     </div>
                                     <div className="sexy-label">{v.name}</div>
                                 </div>
                            ))}
                        </div>
                    ) : null}
                </>
            )}

            {drawerState.mode === 'library' && (
                <LibrarySidebar
                    savedComponents={savedComponents}
                    collections={collections}
                    onComponentSelect={handleComponentSelect}
                    onCollectionCreate={() => setEditingCollection({} as Collection)}
                    onCollectionUpdate={handleUpdateCollection}
                    onCollectionDelete={handleDeleteCollection}
                    onClose={() => setDrawerState(s => ({...s, isOpen: false}))}
                    initialFilter={drawerState.data?.filter === 'favorites' ? 'favorites' : 'all'}
                />
            )}

            {drawerState.mode === 'tags' && drawerState.data && (
                <div className="tags-drawer">
                    <TagManager
                        tags={drawerState.data.tags || []}
                        onTagsChange={(tags) => handleUpdateTags(drawerState.data.id, tags)}
                    />
                </div>
            )}

            {drawerState.mode === 'collections' && drawerState.data && (
                <div className="collections-drawer">
                    <CollectionManager
                        collections={collections}
                        componentId={drawerState.data.id}
                        onCollectionsChange={(collectionIds) => handleUpdateCollections(drawerState.data.id, collectionIds)}
                        onCreateCollection={() => setEditingCollection({} as Collection)}
                    />
                </div>
            )}

            {drawerState.mode === 'collection-editor' && editingCollection && (
                <CollectionEditor
                    collection={editingCollection.id ? editingCollection : null}
                    onSave={(data) => {
                        if (editingCollection.id) {
                            handleUpdateCollection({ ...editingCollection, ...data });
                        } else {
                            handleCreateCollection(data);
                        }
                    }}
                    onCancel={() => {
                        setEditingCollection(null);
                        setDrawerState(s => ({...s, isOpen: false}));
                    }}
                />
            )}
        </SideDrawer>

        <div className="immersive-app">
            <DottedGlowBackground 
                gap={24} 
                radius={1.5} 
                color="rgba(255, 255, 255, 0.02)" 
                glowColor="rgba(255, 255, 255, 0.15)" 
                speedScale={0.5} 
            />

            <div className={`stage-container ${focusedArtifactIndex !== null ? 'mode-focus' : 'mode-split'}`}>
                 <div className={`empty-state ${hasStarted ? 'fade-out' : ''}`}>
                     <div className="empty-content">
                         <h1>Flash UI</h1>
                         <p>Creative UI generation in a flash</p>
                         <button className="surprise-button" onClick={handleSurpriseMe} disabled={isLoading}>
                             <SparklesIcon /> Surprise Me
                         </button>
                     </div>
                 </div>

                {sessions.map((session, sIndex) => {
                    let positionClass = 'hidden';
                    if (sIndex === currentSessionIndex) positionClass = 'active-session';
                    else if (sIndex < currentSessionIndex) positionClass = 'past-session';
                    else if (sIndex > currentSessionIndex) positionClass = 'future-session';

                    const visibleArtifacts = sIndex === currentSessionIndex
                        ? session.artifacts.filter(a => !hiddenArtifacts.has(a.id))
                        : session.artifacts;

                    return (
                        <div key={session.id} className={`session-group ${positionClass}`}>
                            <div className="artifact-grid" ref={sIndex === currentSessionIndex ? gridScrollRef : null}>
                                {visibleArtifacts.map((artifact) => {
                                    const aIndex = session.artifacts.findIndex(a => a.id === artifact.id);
                                    const isFocused = focusedArtifactIndex === aIndex;
                                    const isSaved = isComponentSaved(artifact.id, session.id);
                                    const isSelected = blendSelection.includes(artifact.id);
                                    const savedComponent = savedComponents.find(
                                        c => c.artifactId === artifact.id && c.sessionId === session.id
                                    );
                                    const isFavorite = savedComponent?.isFavorite || false;

                                    return (
                                        <div key={artifact.id} className={`artifact-card-wrapper ${isSelected ? 'blend-selected' : ''}`}>
                                            {sIndex === currentSessionIndex && artifact.status === 'complete' && (
                                                <button
                                                    className={`blend-toggle ${isSelected ? 'selected' : ''}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleToggleBlendSelection(artifact.id);
                                                    }}
                                                    title={isSelected ? 'Remove from blend' : 'Select for blend'}
                                                >
                                                    {isSelected ? <CheckIcon /> : <BlendIcon />}
                                                </button>
                                            )}
                                            {sIndex === currentSessionIndex && (
                                                <button
                                                    className="hide-button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleHideArtifact(artifact.id);
                                                    }}
                                                    title="Hide this design"
                                                >
                                                    <EyeOffIcon />
                                                </button>
                                            )}
                                            <ArtifactCard
                                                artifact={artifact}
                                                isFocused={isFocused}
                                                onClick={() => setFocusedArtifactIndex(aIndex)}
                                                onSaveToLibrary={() => handleSaveToLibrary(artifact.id, session.id)}
                                                onFavorite={() => handleSaveAndFavorite(artifact.id, session.id)}
                                                isSaved={isSaved}
                                                isFavorite={isFavorite}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            {sIndex === currentSessionIndex && hiddenArtifacts.size > 0 && (
                                <div className="hidden-indicator">
                                    <span>{hiddenArtifacts.size} hidden</span>
                                    <button onClick={handleRestoreHidden}>Restore All</button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

             {canGoBack && (
                <button className="nav-handle left" onClick={prevItem} aria-label="Previous">
                    <ArrowLeftIcon />
                </button>
             )}
             {canGoForward && (
                <button className="nav-handle right" onClick={nextItem} aria-label="Next">
                    <ArrowRightIcon />
                </button>
             )}

            <div className={`action-bar ${focusedArtifactIndex !== null ? 'visible' : ''}`}>
                 {currentSession && (
                    <PromptEditor
                        originalPrompt={currentSession.prompt}
                        editedPrompt={editedPrompt}
                        onPromptChange={setEditedPrompt}
                        onWordClick={handleWordClick}
                        wordSuggestion={wordSuggestion}
                        onSuggestionSelect={handleWordReplace}
                        onSuggestionClose={() => setWordSuggestion(null)}
                        disabled={isLoading}
                    />
                 )}

                 {/* Regenerate button - shows when prompt has been modified */}
                 {editedPrompt && editedPrompt !== currentSession?.prompt && (
                    <button className="regenerate-button" onClick={handleRegenerateWithEdits} disabled={isLoading}>
                        <RefreshIcon /> Regenerate
                    </button>
                 )}

                 <div className="action-buttons">
                    <button onClick={() => setFocusedArtifactIndex(null)}>
                        <GridIcon /> Grid View
                    </button>

                    {/* Style DNA dropdown */}
                    <div className="style-dna-dropdown">
                        <button className={`style-dna-trigger ${lockedStyle ? 'active' : ''}`} disabled={isLoading}>
                            <StyleIcon /> Style DNA {lockedStyle && '✓'}
                        </button>
                        <div className="style-dna-menu">
                            {!lockedStyle ? (
                                <button onClick={handleLockStyle}>
                                    Lock This Style
                                </button>
                            ) : (
                                <>
                                    <button onClick={handleRemixLayout}>
                                        Remix Layout
                                    </button>
                                    <button onClick={handleUnlockStyle}>
                                        Unlock Style
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    <button onClick={handleGenerateVariations} disabled={isLoading}>
                        <SparklesIcon /> Explore UX
                    </button>
                    <button onClick={handleMoreLikeThis} disabled={isLoading}>
                        <MoreLikeThisIcon /> Similar Styles
                    </button>
                    <button onClick={handleShowCode}>
                        <CodeIcon /> Source
                    </button>
                 </div>

                 {/* Blend Styles button - shows when 2 designs are selected */}
                 {blendSelection.length === 2 && (
                    <button className="blend-button" onClick={handleBlendStyles} disabled={isLoading}>
                        <BlendIcon /> Blend Selected ({blendSelection.length}/2)
                    </button>
                 )}
                 {blendSelection.length === 1 && (
                    <div className="blend-hint">Select one more design to blend</div>
                 )}

                 {/* Favorite button - always shown when focused */}
                 {focusedArtifactIndex !== null && currentSession && (() => {
                    const artifact = currentSession.artifacts[focusedArtifactIndex];
                    const savedComponent = savedComponents.find(
                        c => c.artifactId === artifact.id && c.sessionId === currentSession.id
                    );
                    const isFavorite = savedComponent?.isFavorite || false;
                    
                    return (
                        <button
                            className={`favorite-button ${isFavorite ? 'active' : ''}`}
                            onClick={() => {
                                if (savedComponent) {
                                    handleToggleFavorite(savedComponent.id);
                                } else {
                                    handleSaveAndFavorite(artifact.id, currentSession.id);
                                }
                            }}
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                        >
                            <StarIcon filled={isFavorite} />
                        </button>
                    );
                 })()}
            </div>

            {/* Style locked indicator near input */}
            {lockedStyle && (
                <div className="style-locked-indicator">
                    <StyleIcon /> Style locked: {lockedStyle.styleName}
                    <button onClick={handleUnlockStyle} className="unlock-button">×</button>
                </div>
            )}

            {/* Top-right controls */}
            <div className="top-right-controls">
                <div className="library-dropdown">
                    <button
                        className={`library-toggle ${savedComponents.length > 0 ? 'has-items' : ''}`}
                        onClick={() => {
                            const libraryButton = document.querySelector('.library-toggle');
                            const libraryMenu = document.querySelector('.library-menu');
                            if (libraryMenu) {
                                libraryMenu.classList.toggle('open');
                            }
                        }}
                        title="Library"
                    >
                        <LibraryIcon />
                        {savedComponents.length > 0 && <span className="library-count">{savedComponents.length}</span>}
                    </button>
                    <div className="library-menu">
                        <button
                            onClick={() => {
                                setDrawerState({ isOpen: true, mode: 'library', title: 'Library', data: null });
                                document.querySelector('.library-menu')?.classList.remove('open');
                            }}
                        >
                            <LibraryIcon /> All Components ({savedComponents.length})
                        </button>
                        <button
                            onClick={() => {
                                setDrawerState({ isOpen: true, mode: 'library', title: 'Favorites', data: { filter: 'favorites' } });
                                document.querySelector('.library-menu')?.classList.remove('open');
                            }}
                        >
                            <StarIcon filled /> Favorites ({savedComponents.filter(c => c.isFavorite).length})
                        </button>
                    </div>
                </div>
            </div>

            <div className="floating-input-container">
                <div className={`input-wrapper ${isLoading ? 'loading' : ''}`}>
                    {(!inputValue && !isLoading) && (
                        <div className="animated-placeholder" key={placeholderIndex}>
                            <span className="placeholder-text">{placeholders[placeholderIndex]}</span>
                            <span className="tab-hint">Tab</span>
                        </div>
                    )}
                    {!isLoading ? (
                        <input 
                            ref={inputRef}
                            type="text" 
                            value={inputValue} 
                            onChange={handleInputChange} 
                            onKeyDown={handleKeyDown} 
                            disabled={isLoading} 
                        />
                    ) : (
                        <div className="input-generating-label">
                            <span className="generating-prompt-text">{currentSession?.prompt}</span>
                            <ThinkingIcon />
                        </div>
                    )}
                    <button className="send-button" onClick={() => handleSendMessage()} disabled={isLoading || !inputValue.trim()}>
                        <ArrowUpIcon />
                    </button>
                </div>
                <div className="model-selector-inline">
                    <ModelSelector
                        selectedModelId={selectedModelId}
                        onModelChange={setSelectedModelId}
                    />
                </div>
            </div>
        </div>
    </>
  );
}

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<React.StrictMode><App /></React.StrictMode>);
}