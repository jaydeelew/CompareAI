import React, { memo } from 'react';
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
}) => {
  const messageCount = conversations.length > 0 ? conversations[0]?.messages.length || 0 : 0;
  
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
        {/* History Toggle Button */}
        <div className="history-toggle-wrapper">
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
        </div>

        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
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

        {/* History List */}
        {showHistoryDropdown && (() => {
          const shouldHideScrollbar = historyLimit <= 3;
          
          const getMaxHeight = () => {
            const displayedCount = Math.min(conversationHistory.length, historyLimit);
            const userTier = isAuthenticated ? user?.subscription_tier || 'free' : 'anonymous';
            const tierLimits: { [key: string]: number } = {
              anonymous: 2,
              free: 3,
              starter: 10,
              starter_plus: 20,
              pro: 50,
              pro_plus: 100,
            };
            const tierLimit = tierLimits[userTier] || 2;
            const isShowingMessage = displayedCount === tierLimit;

            if (historyLimit === 2) {
              return isShowingMessage ? '230px' : '170px';
            }
            if (historyLimit === 3) {
              return isShowingMessage ? '315px' : '255px';
            }
            return isShowingMessage ? '360px' : '300px';
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

      {/* Usage Preview - Regular Mode */}
      {!isFollowUpMode && input.trim() && renderUsagePreview()}

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

