import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { LucideIcon } from 'lucide-react';

export type IconActionVariant =
  | 'view'
  | 'edit'
  | 'delete'
  | 'confirm'
  | 'warning'
  | 'refresh'
  | 'neutral'
  | 'alert'
  | 'ghost-light';

export type IconActionSize = 'xs' | 'sm' | 'md';

export interface IconActionButtonProps {
  icon: LucideIcon;
  label: string;
  tooltip?: string;
  variant?: IconActionVariant;
  size?: IconActionSize;
  spinning?: boolean;
  active?: boolean;
  disabled?: boolean;
  tooltipSide?: 'top' | 'bottom';
  strokeWidth?: number;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit';
  ariaExpanded?: boolean;
  ariaHaspopup?: boolean;
  badge?: React.ReactNode;
}

const VARIANT_CLASSES: Record<IconActionVariant, string> = {
  view:
    'text-[#154A8A] bg-[#1F5FA8]/[0.06] border-[#1F5FA8]/20 hover:bg-[#1F5FA8]/[0.12] hover:border-[#1F5FA8]/40 hover:text-[#0B2A5B] focus-visible:ring-[#1F5FA8]/40',
  edit:
    'text-indigo-600 bg-indigo-50/75 border-indigo-200/80 hover:bg-indigo-100/90 hover:border-indigo-300 hover:text-indigo-700 focus-visible:ring-indigo-500/35',
  delete:
    'text-[#B80E29] bg-[#C8102E]/[0.06] border-[#C8102E]/20 hover:bg-[#C8102E]/[0.12] hover:border-[#C8102E]/40 hover:text-[#8E0A1F] focus-visible:ring-[#C8102E]/40',
  confirm:
    'text-emerald-700 bg-emerald-50/80 border-emerald-200/85 hover:bg-emerald-100/90 hover:border-emerald-300 hover:text-emerald-800 focus-visible:ring-emerald-500/35',
  warning:
    'text-amber-700 bg-amber-50/85 border-amber-200/85 hover:bg-amber-100/90 hover:border-amber-300 hover:text-amber-800 focus-visible:ring-amber-500/35',
  refresh:
    'text-[#0B2A5B] bg-white border-slate-200 hover:bg-[#1F5FA8]/[0.07] hover:border-[#1F5FA8]/35 hover:text-[#154A8A] focus-visible:ring-[#1F5FA8]/35',
  neutral:
    'text-slate-600 bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300 hover:text-[#0B2A5B] focus-visible:ring-[#1F5FA8]/30',
  alert:
    'text-[#B80E29] bg-red-50/85 border-red-200/90 hover:bg-red-100 hover:border-red-300 hover:text-[#8E0A1F] focus-visible:ring-red-500/35',
  'ghost-light':
    'text-white/85 bg-white/10 border-white/15 hover:bg-white/20 hover:border-white/30 hover:text-white focus-visible:ring-white/50',
};

const ACTIVE_VARIANT_CLASSES: Record<IconActionVariant, string> = {
  view: 'bg-[#1F5FA8] text-white border-[#1F5FA8] shadow-xs',
  edit: 'bg-indigo-600 text-white border-indigo-600 shadow-xs',
  delete: 'bg-[#C8102E] text-white border-[#C8102E] shadow-xs',
  confirm: 'bg-emerald-600 text-white border-emerald-600 shadow-xs',
  warning: 'bg-amber-600 text-white border-amber-600 shadow-xs',
  refresh: 'bg-[#0B2A5B] text-white border-[#0B2A5B] shadow-xs',
  neutral: 'bg-[#0B2A5B] text-white border-[#0B2A5B] shadow-xs',
  alert: 'bg-[#C8102E] text-white border-[#C8102E] shadow-xs',
  'ghost-light': 'bg-white/25 text-white border-white/40 shadow-xs',
};

const SIZE_CLASSES: Record<IconActionSize, { btn: string; icon: string }> = {
  xs: { btn: 'w-8 h-8 rounded-lg', icon: 'w-4 h-4' },
  sm: { btn: 'w-9 h-9 rounded-lg', icon: 'w-[17px] h-[17px]' },
  md: { btn: 'w-10 h-10 rounded-xl', icon: 'w-[18px] h-[18px]' },
};

export const IconActionButton: React.FC<IconActionButtonProps> = ({
  icon: Icon,
  label,
  tooltip,
  variant = 'neutral',
  size = 'sm',
  spinning = false,
  active = false,
  disabled = false,
  tooltipSide = 'top',
  strokeWidth = 1.85,
  className = '',
  onClick,
  type = 'button',
  ariaExpanded,
  ariaHaspopup,
  badge,
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; side: 'top' | 'bottom' }>({
    top: 0,
    left: 0,
    side: tooltipSide,
  });

  const tooltipText = tooltip ?? label;

  const updateCoords = useCallback(() => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    let effectiveSide = tooltipSide;
    if (tooltipSide === 'top' && rect.top < 44) {
      effectiveSide = 'bottom';
    } else if (tooltipSide === 'bottom' && window.innerHeight - rect.bottom < 44) {
      effectiveSide = 'top';
    }
    const centerX = rect.left + rect.width / 2;
    const clampedX = Math.max(72, Math.min(window.innerWidth - 72, centerX));
    const top = effectiveSide === 'top' ? rect.top - 8 : rect.bottom + 8;
    setCoords({ top, left: clampedX, side: effectiveSide });
  }, [tooltipSide]);

  useEffect(() => {
    if (!tooltipVisible) return;
    updateCoords();
    const handleScrollOrResize = () => setTooltipVisible(false);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [tooltipVisible, updateCoords]);

  const sizeConfig = SIZE_CLASSES[size];
  const colorClasses = active ? ACTIVE_VARIANT_CLASSES[variant] : VARIANT_CLASSES[variant];

  return (
    <>
      <button
        ref={buttonRef}
        type={type}
        onClick={(e) => {
          setTooltipVisible(false);
          onClick?.(e);
        }}
        disabled={disabled}
        aria-label={label}
        aria-expanded={ariaExpanded}
        aria-haspopup={ariaHaspopup}
        onMouseEnter={() => {
          if (!disabled) {
            updateCoords();
            setTooltipVisible(true);
          }
        }}
        onMouseLeave={() => setTooltipVisible(false)}
        onFocus={() => {
          if (!disabled) {
            updateCoords();
            setTooltipVisible(true);
          }
        }}
        onBlur={() => setTooltipVisible(false)}
        className={`relative inline-flex items-center justify-center shrink-0 border shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all duration-150 ease-out cursor-pointer select-none hover:shadow-xs active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-45 disabled:pointer-events-none motion-reduce:transition-none ${sizeConfig.btn} ${colorClasses} ${className}`}
      >
        <Icon
          className={`${sizeConfig.icon} shrink-0 ${spinning ? 'animate-spin' : ''}`}
          strokeWidth={strokeWidth}
          aria-hidden="true"
        />
        {badge}
      </button>
      {tooltipVisible &&
        tooltipText &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform: coords.side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
            className="fixed z-[120] pointer-events-none px-2.5 py-1.5 rounded-lg bg-[#0B2A5B] text-white text-[11px] font-semibold tracking-tight whitespace-nowrap shadow-lg border border-white/10 ucv-tooltip-in"
          >
            {tooltipText}
          </div>,
          document.body
        )}
    </>
  );
};
