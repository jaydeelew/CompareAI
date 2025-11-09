import React from 'react';

/**
 * TierSelector component props
 */
export interface TierSelectorProps {
  /** Whether extended mode is enabled */
  isExtendedMode: boolean;
  /** Callback to toggle extended mode */
  onToggle?: (enabled: boolean) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Whether extended mode is recommended */
  recommended?: boolean;
  /** Tooltip text */
  title?: string;
  /** Custom className */
  className?: string;
}

/**
 * TierSelector component for toggling between Brief/Standard and Extended modes
 * 
 * This component allows users to select between different tier levels for their queries.
 * Extended mode allows longer prompts and more detailed responses.
 * 
 * @example
 * ```tsx
 * <TierSelector
 *   isExtendedMode={false}
 *   onToggle={setIsExtendedMode}
 *   recommended={true}
 * />
 * ```
 */
export const TierSelector: React.FC<TierSelectorProps> = ({
  isExtendedMode,
  onToggle,
  disabled = false,
  recommended = false,
  title,
  className = '',
}) => {
  const handleClick = () => {
    if (!disabled && onToggle) {
      onToggle(!isExtendedMode);
    }
  };

  const buttonClassName = [
    'extended-mode-button',
    isExtendedMode ? 'active' : '',
    recommended ? 'recommended' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const style = disabled ? { cursor: 'not-allowed' } : undefined;

  return (
    <button
      className={buttonClassName}
      onClick={handleClick}
      disabled={disabled}
      style={style}
      title={title}
      aria-label={isExtendedMode ? 'Extended mode active' : 'Standard mode active'}
      aria-pressed={isExtendedMode}
    >
      E
    </button>
  );
};

TierSelector.displayName = 'TierSelector';

