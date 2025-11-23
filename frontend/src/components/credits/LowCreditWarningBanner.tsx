/**
 * LowCreditWarningBanner Component
 * 
 * Displays a warning banner when user's credits are running low.
 * Shows different severity levels based on remaining credits.
 */

import React from 'react'
import type { CreditBalance } from '../../services/creditService'
import './LowCreditWarningBanner.css'

export interface LowCreditWarningBannerProps {
  /** Credit balance data */
  balance: CreditBalance | null
  /** Whether credits are loading */
  isLoading?: boolean
  /** Callback when user clicks to upgrade */
  onUpgradeClick?: () => void
  /** Callback when user dismisses the banner */
  onDismiss?: () => void
  /** Custom className */
  className?: string
}

/**
 * LowCreditWarningBanner component for displaying low credit warnings
 * 
 * @example
 * ```tsx
 * <LowCreditWarningBanner 
 *   balance={creditBalance}
 *   onUpgradeClick={() => setShowUpgradeModal(true)}
 *   onDismiss={() => setShowWarning(false)}
 * />
 * ```
 */
export const LowCreditWarningBanner: React.FC<LowCreditWarningBannerProps> = ({
  balance,
  isLoading = false,
  onUpgradeClick,
  onDismiss,
  className = '',
}) => {
  if (isLoading || !balance) {
    return null
  }

  const creditsRemaining = balance.credits_remaining
  const creditsAllocated = balance.credits_allocated
  const remainingPercent = creditsAllocated > 0
    ? (creditsRemaining / creditsAllocated) * 100
    : 100

  // Only show banner if credits are below 20%
  if (remainingPercent >= 20) {
    return null
  }

  // Determine severity level
  const getSeverity = () => {
    if (remainingPercent >= 10) return 'warning' // 10-20% remaining
    if (remainingPercent > 0) return 'alert' // 1-10% remaining
    return 'critical' // 0% remaining
  }

  const severity = getSeverity()

  const getMessage = () => {
    if (severity === 'critical') {
      return `You've run out of credits! Upgrade to continue using CompareIntel.`
    }
    if (severity === 'alert') {
      return `Warning: You have ${Math.round(creditsRemaining)} credits remaining (${remainingPercent.toFixed(0)}%). Upgrade now to avoid interruption.`
    }
    return `You have ${Math.round(creditsRemaining)} credits remaining (${remainingPercent.toFixed(0)}%). Consider upgrading for more credits.`
  }

  const getIcon = () => {
    if (severity === 'critical') return '🚨'
    if (severity === 'alert') return '⚠️'
    return '💡'
  }

  return (
    <div 
      className={`low-credit-warning-banner low-credit-warning-banner-${severity} ${className}`}
      role="alert"
      aria-live="polite"
    >
      <div className="low-credit-warning-content">
        <div className="low-credit-warning-icon">
          {getIcon()}
        </div>
        <div className="low-credit-warning-message">
          {getMessage()}
        </div>
        <div className="low-credit-warning-actions">
          {onUpgradeClick && (
            <button
              className="low-credit-warning-upgrade-btn"
              onClick={onUpgradeClick}
            >
              Upgrade
            </button>
          )}
          {onDismiss && (
            <button
              className="low-credit-warning-dismiss-btn"
              onClick={onDismiss}
              aria-label="Dismiss warning"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

LowCreditWarningBanner.displayName = 'LowCreditWarningBanner'

