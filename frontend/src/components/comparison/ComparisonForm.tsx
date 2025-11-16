import React, { memo, useEffect, useRef, useCallback } from 'react';
import type { User } from '../../types';
import type { ConversationSummary, ModelConversation } from '../../types';
import { truncatePrompt, formatDate } from '../../utils';
import { getConversationLimit, getDailyLimit, getExtendedLimit } from '../../config/constants';

interface ComparisonFormProps {
  // Input state
  input: string;
  setInput: (value: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  
  // Mode state
  isFollowUpMode: boolean;
  isExtendedMode: boolean;
  isLoading: boolean;
  isAnimatingButton: boolean;
  isAnimatingTextarea: boolean;
  
  // User state
  isAuthenticated: boolean;
  user: User | null;
  usageCount: number;
  extendedUsageCount: number;
  
  // Conversations
  conversations: ModelConversation[];
  
  // History
  showHistoryDropdown: boolean;
  setShowHistoryDropdown: (show: boolean) => void;
  conversationHistory: ConversationSummary[];
  isLoadingHistory: boolean;
  historyLimit: number;
  currentVisibleComparisonId: string | null;
  
  // Handlers
  onSubmitClick: () => void;
  onContinueConversation: () => void;
  onNewComparison: () => void;
  onExtendedModeToggle: () => void;
  onLoadConversation: (summary: ConversationSummary) => void;
  onDeleteConversation: (summary: ConversationSummary, e: React.MouseEvent) => void;
  
  // Utilities
  getExtendedRecommendation: (input: string) => boolean;
  renderUsagePreview: () => React.ReactNode;
  
  // Model selection
  selectedModels: string[];
}

/**
 * ComparisonForm component - handles the main input area, history, and controls
 * 
 * @example
 * ```tsx
 * <ComparisonForm
 *   input={input}
 *   setInput={setInput}
 *   onSubmitClick={handleSubmit}
 *   {...otherProps}
 * />
 * ```
 */
export const ComparisonForm = memo<ComparisonFormProps>(({
  input,
  setInput,
  textareaRef,
  isFollowUpMode,
  isExtendedMode,
  isLoading,
  isAnimatingButton,
  isAnimatingTextarea,
  isAuthenticated,
  user,
  usageCount,
  extendedUsageCount,
  conversations,
  showHistoryDropdown,
  setShowHistoryDropdown,
  conversationHistory,
  isLoadingHistory,
  historyLimit,
  currentVisibleComparisonId,
  onSubmitClick,
  onContinueConversation,
  onNewComparison,
  onExtendedModeToggle,
  onLoadConversation,
  onDeleteConversation,
  getExtendedRecommendation,
  renderUsagePreview,
  selectedModels,
}) => {
  const messageCount = conversations.length > 0 ? conversations[0]?.messages.length || 0 : 0;
  
  // Prevent text from scrolling into button area (ChatGPT-style)
  // Key insight: When scrolling, the bottom of visible TEXT should stop at the top of padding where buttons are
  // scrollHeight includes padding, clientHeight includes padding (box-sizing: border-box)
  // We want: bottom of visible text = top of padding area
  // Formula: scrollTop + (clientHeight - paddingBottom) = scrollHeight - paddingBottom
  // Therefore: maxScrollTop = scrollHeight - clientHeight
  // But this shows padding. To prevent text in padding: maxScrollTop = scrollHeight - clientHeight - paddingBottom
  const enforceScrollLimit = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    
    // Only enforce if textarea is scrollable
    if (textarea.scrollHeight <= textarea.clientHeight) {
      return;
    }
    
    const computedStyle = window.getComputedStyle(textarea);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);
    
    // Calculate max scroll position that keeps text above padding area
    // When scrolled to this position, bottom of visible text aligns with top of padding
    const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight - paddingBottom);
    
    // Enforce scroll limit - prevent text from scrolling into button area
    if (textarea.scrollTop > maxScrollTop) {
      textarea.scrollTop = maxScrollTop;
    }
  }, [textareaRef]);

  // Auto-expand textarea based on content (like ChatGPT)
  // Scrollable after 5 lines (6th line triggers scrolling) - text never reaches buttons
  const adjustTextareaHeight = useCallback(() => {
    if (!textareaRef.current) return;
    
    const textarea = textareaRef.current;
    
    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    
    // Calculate height for exactly 5 lines of text
    // The textarea has bottom padding (60px) where buttons are positioned
    const computedStyle = window.getComputedStyle(textarea);
    const fontSize = parseFloat(computedStyle.fontSize);
    const lineHeight = parseFloat(computedStyle.lineHeight) || fontSize * 1.6;
    const paddingTop = parseFloat(computedStyle.paddingTop);
    const paddingBottom = parseFloat(computedStyle.paddingBottom);
    
    // Calculate height for exactly 5 lines of text content
    const lineHeightPx = lineHeight;
    const fiveLinesHeight = lineHeightPx * 5; // Height for 5 lines of text
    
    // maxHeight = 5 lines + top padding + bottom padding (where buttons are)
    // This ensures exactly 5 lines are visible, and buttons are in the padding area below
    const maxHeight = fiveLinesHeight + paddingTop + paddingBottom;
    
    const minHeight = lineHeightPx + paddingTop + paddingBottom; // Minimum height for single line
    const scrollHeight = textarea.scrollHeight;
    
    // Set height to maxHeight (5 lines) when content exceeds it, otherwise grow with content
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
    
    // Enable scrolling when 6th line is needed (content exceeds 5 lines)
    if (scrollHeight > maxHeight) {
      textarea.style.overflowY = 'auto';
      // Enforce scroll limit to prevent text from reaching buttons
      requestAnimationFrame(() => {
        enforceScrollLimit();
      });
    } else {
      textarea.style.overflowY = 'hidden';
      // Reset scroll position when not scrolling
      textarea.scrollTop = 0;
    }
  }, [enforceScrollLimit]);
  
  // Adjust height when input changes
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      adjustTextareaHeight();
    });
  }, [input, adjustTextareaHeight]);
  
  // Adjust height on window resize
  useEffect(() => {
    const handleResize = () => {
      requestAnimationFrame(() => {
        adjustTextareaHeight();
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [adjustTextareaHeight]);
  
  // Initial height adjustment on mount
  useEffect(() => {
    // Small delay to ensure textarea is rendered
    const timer = setTimeout(() => {
      adjustTextareaHeight();
    }, 0);
    return () => clearTimeout(timer);
  }, [adjustTextareaHeight]);

  // Add scroll handler to prevent text from scrolling into button area
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Handle scroll events to enforce limit
    const scrollHandler = () => {
      enforceScrollLimit();
    };
    
    // Handle input events to enforce limit after content changes
    const inputHandler = () => {
      requestAnimationFrame(() => {
        enforceScrollLimit();
      });
    };

    textarea.addEventListener('scroll', scrollHandler, { passive: true });
    textarea.addEventListener('input', inputHandler);
    textarea.addEventListener('wheel', scrollHandler, { passive: true });

    return () => {
      textarea.removeEventListener('scroll', scrollHandler);
      textarea.removeEventListener('input', inputHandler);
      textarea.removeEventListener('wheel', scrollHandler);
    };
  }, [enforceScrollLimit]);
  
  // Continuous enforcement to catch browser's auto-scroll-to-cursor behavior
  useEffect(() => {
    if (!textareaRef.current) return;
    
    let animationFrameId: number | null = null;
    let isRunning = true;
    
    const continuousEnforce = () => {
      if (!isRunning || !textareaRef.current) {
        return;
      }
      
      enforceScrollLimit();
      animationFrameId = requestAnimationFrame(continuousEnforce);
    };
    
    animationFrameId = requestAnimationFrame(continuousEnforce);
    
    return () => {
      isRunning = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [enforceScrollLimit]);
  
  return (
    <>
      <div className="follow-up-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        {isFollowUpMode ? (
          <>
            <h2 style={{ margin: 0 }}>
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Follow Up Mode
            </h2>
            <button
              onClick={onNewComparison}
              className="textarea-icon-button new-inquiry-button"
              title="Exit follow up mode"
              disabled={isLoading}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                minWidth: '32px',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                style={{
                  width: '22px',
                  height: '22px',
                  display: 'block',
                  margin: 0,
                  transform: 'translate(0px, 1px)'
                }}
              >
                <path d="M12 2v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
            <span style={{
              fontSize: 'clamp(1.25rem, 3vw, 1.5rem)',
              fontWeight: 700,
              color: 'transparent',
              textAlign: 'center',
              margin: 0,
              letterSpacing: '-0.025em',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
              background: 'linear-gradient(135deg, #ffffff 0%, #e2e8f0 100%)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text'
            }}>
              {messageCount + (input.trim() ? 1 : 0)} message context
            </span>
          </>
        ) : (
          <h2>Enter Your Prompt</h2>
        )}
      </div>

      <div className={`textarea-container ${isAnimatingTextarea ? 'animate-pulse-border' : ''}`}>
        {/* Wrapper for textarea and buttons to keep buttons positioned relative to textarea */}
        <div className="textarea-wrapper">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // adjustTextareaHeight will be called via useEffect
              // Enforce scroll limit after browser's auto-scroll-to-cursor completes
              requestAnimationFrame(() => {
                enforceScrollLimit();
                // Double-check after another frame to catch delayed scroll
                requestAnimationFrame(() => {
                  enforceScrollLimit();
                });
              });
            }}
            onScroll={() => {
              // Immediately enforce on scroll events
              enforceScrollLimit();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (isFollowUpMode) {
                  onContinueConversation();
                } else {
                  onSubmitClick();
                }
              }
            }}
            placeholder={isFollowUpMode
              ? "Enter your follow-up here"
              : "Let's get started..."
            }
            className="hero-input-textarea"
            rows={1}
            data-testid="comparison-input-textarea"
          />

          {/* History Toggle Button - positioned on left side */}
          <button
            type="button"
            className={`history-toggle-button ${showHistoryDropdown ? 'active' : ''}`}
            onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
            title="Load previous conversations"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          <div className="textarea-actions">
            {(() => {
              const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
              const regularLimit = getDailyLimit(userTier);
              const extendedLimit = getExtendedLimit(userTier);

              const currentRegularUsage = isAuthenticated && user
                ? user.daily_usage_count
                : usageCount;
              const currentExtendedUsage = isAuthenticated && user
                ? user.daily_extended_usage
                : extendedUsageCount;

              const regularRemaining = regularLimit - currentRegularUsage;
              const hasReachedExtendedLimit = currentExtendedUsage >= extendedLimit;
              const hasNoRemainingRegularResponses = regularRemaining <= 0;

              const handleClick = (e: React.MouseEvent) => {
                if ((hasReachedExtendedLimit || hasNoRemainingRegularResponses) && !isExtendedMode) {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                onExtendedModeToggle();
              };

              const getTitle = () => {
                if (isExtendedMode) {
                  return 'Disable Extended mode';
                }
                if (hasNoRemainingRegularResponses) {
                  return `No remaining model responses today.${userTier === 'anonymous' ? ' Sign up for a free account to get 20 model responses per day!' : ' Paid tiers with higher limits will be available soon!'}`;
                }
                if (hasReachedExtendedLimit) {
                  return `Daily Extended tier limit of ${extendedLimit} interactions reached`;
                }
                
                let tierDisplayName: string;
                if (userTier.endsWith('_plus')) {
                  const baseTier = userTier.replace('_plus', '');
                  tierDisplayName = baseTier.charAt(0).toUpperCase() + baseTier.slice(1) + '+';
                } else {
                  tierDisplayName = userTier.split('_')
                    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                    .join(' ');
                }
                return `${tierDisplayName} tier users get ${extendedLimit} extended interactions`;
              };

              return (
                <button
                  className={`extended-mode-button ${isExtendedMode ? 'active' : ''} ${getExtendedRecommendation(input) ? 'recommended' : ''}`}
                  onClick={handleClick}
                  disabled={isLoading}
                  style={(hasReachedExtendedLimit || hasNoRemainingRegularResponses) && !isLoading ? { cursor: 'not-allowed' } : undefined}
                  title={getTitle()}
                >
                  E
                </button>
              );
            })()}
            <button
              onClick={isFollowUpMode ? onContinueConversation : onSubmitClick}
              disabled={(() => {
                const usesExtendedTier = isExtendedMode;
                const tierLimit = usesExtendedTier ? 15000 : 5000;
                const exceedsLimit = input.length > tierLimit;

                return isLoading ||
                  exceedsLimit ||
                  (isFollowUpMode && messageCount >= 24);
              })()}
              className={`textarea-icon-button submit-button ${!isFollowUpMode && !input.trim() ? 'not-ready' : ''} ${isAnimatingButton ? 'animate-pulse-glow' : ''}`}
              title={(() => {
                if (messageCount >= 24) return 'Maximum conversation length reached - start a new comparison';
                const usesExtendedTier = isExtendedMode;
                const tierLimit = usesExtendedTier ? 15000 : 5000;
                if (input.length > tierLimit) return `Input exceeds ${usesExtendedTier ? 'Extended' : 'Standard'} tier limit - reduce length or enable Extended mode`;
                return isFollowUpMode ? 'Continue conversation' : 'Compare models';
              })()}
              data-testid="comparison-submit-button"
            >
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 14l5-5 5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        {/* History List */}
        {showHistoryDropdown && (() => {
          const shouldHideScrollbar = historyLimit <= 3;
          
          // Calculate max height based on user tier
          // Each entry: 1rem top padding (16px) + content (~23px prompt + 8px margin + ~15px meta) + 1rem bottom padding (16px) ≈ 78px
          // Plus borders between items (1px each)
          // Notification height: ~50px (margin-top 8px + padding 16px + content ~20px + padding 8px)
          const getMaxHeight = () => {
            // Check if notification should be shown
            const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
            const tierLimit = getConversationLimit(userTier);
            const shouldShowNotification = (userTier === 'anonymous' || userTier === 'free') && 
                                          conversationHistory.length >= tierLimit;
            const notificationHeight = shouldShowNotification ? 50 : 0;
            
            if (historyLimit === 2) {
              return `${165 + notificationHeight}px`; // Height for 2 entries + notification if present
            }
            return `${250 + notificationHeight}px`; // Height for 3 entries + notification if present
          };

          return (
            <div
              className={`history-inline-list ${shouldHideScrollbar ? 'no-scrollbar' : 'scrollable'}`}
              style={{ maxHeight: getMaxHeight() }}
            >
              {isLoadingHistory ? (
                <div className="history-loading">Loading...</div>
              ) : conversationHistory.length === 0 ? (
                <div className="history-empty">No conversation history</div>
              ) : (
                <>
                  {conversationHistory
                    .slice(0, historyLimit)
                    .map((summary) => {
                      const isActive = currentVisibleComparisonId && String(summary.id) === currentVisibleComparisonId;

                      return (
                        <div
                          key={summary.id}
                          className={`history-item ${isActive ? 'history-item-active' : ''}`}
                          onClick={() => onLoadConversation(summary)}
                        >
                          <div className="history-item-content">
                            <div className="history-item-prompt">{truncatePrompt(summary.input_data)}</div>
                            <div className="history-item-meta">
                              <span className="history-item-models">{summary.models_used.length} model{summary.models_used.length !== 1 ? 's' : ''}</span>
                              <span className="history-item-date">{formatDate(summary.created_at)}</span>
                            </div>
                          </div>
                          <button
                            className="history-item-delete"
                            onClick={(e) => onDeleteConversation(summary, e)}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}

                  {/* Tier limit message */}
                  {(() => {
                    const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
                    const tierLimit = getConversationLimit(userTier);

                    if (userTier !== 'anonymous' && userTier !== 'free') {
                      return null;
                    }

                    const visibleCount = conversationHistory.length;
                    const isAtLimit = visibleCount >= tierLimit;

                    if (!isAtLimit) {
                      return null;
                    }

                    if (!isAuthenticated) {
                      return (
                        <div className="history-signup-prompt">
                          <div className="history-signup-message">
                            <span className="history-signup-line">You can only save the last 2 comparisons.</span>
                            <span className="history-signup-line"> Sign up for a free account to save more!</span>
                          </div>
                        </div>
                      );
                    } else {
                      return (
                        <div className="history-signup-prompt">
                          <div className="history-signup-message">
                            <span className="history-signup-line">You only have 3 saves for your tier.</span>
                            <span className="history-signup-line"> Upgrade to Starter for 10 saved comparisons or Pro for 50!</span>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Usage Preview - Regular Mode */}
      <div className="usage-preview-container">
        {!isFollowUpMode && (input.trim() || selectedModels.length > 0) && renderUsagePreview()}
      </div>

      {/* Context Warning & Usage Preview - Follow-up Mode */}
      {isFollowUpMode && conversations.length > 0 && (() => {
        let warningLevel: 'info' | 'medium' | 'high' | 'critical' | null = null;
        let warningMessage = '';
        let warningIcon = '';

        if (messageCount >= 24) {
          warningLevel = 'critical';
          warningIcon = '🚫';
          warningMessage = 'Maximum conversation length reached (24 messages). Please start a fresh comparison for continued assistance.';
        } else if (messageCount >= 20) {
          warningLevel = 'critical';
          warningIcon = '✨';
          warningMessage = 'Time for a fresh start! Starting a new comparison will give you the best response quality and speed.';
        } else if (messageCount >= 14) {
          warningLevel = 'high';
          warningIcon = '💡';
          warningMessage = 'Consider starting a fresh comparison! New conversations help maintain optimal context and response quality.';
        } else if (messageCount >= 10) {
          warningLevel = 'medium';
          warningIcon = '🎯';
          warningMessage = 'Pro tip: Fresh comparisons provide more focused and relevant responses!';
        } else if (messageCount >= 6) {
          warningLevel = 'info';
          warningIcon = 'ℹ️';
          warningMessage = 'Reminder: Starting a new comparison helps keep responses sharp and context-focused.';
        }

        return (
          <>
            {messageCount > 0 && renderUsagePreview()}

            {warningLevel && (
              <div className={`context-warning ${warningLevel}`}>
                <div className="context-warning-content">
                  <div className="context-warning-message">
                    <span className="context-warning-icon">{warningIcon}</span>{warningMessage}
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}
    </>
  );
});

ComparisonForm.displayName = 'ComparisonForm';

