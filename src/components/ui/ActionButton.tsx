import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export type ActionButtonVariant =
  | 'primary'
  | 'brand'
  | 'secondary'
  | 'view'
  | 'edit'
  | 'delete'
  | 'confirm'
  | 'warning'
  | 'ghost';

export type ActionButtonSize = 'xs' | 'sm' | 'md';

export interface ActionButtonProps {
  icon?: LucideIcon;
  iconRight?: LucideIcon;
  children: React.ReactNode;
  variant?: ActionButtonVariant;
  size?: ActionButtonSize;
  loading?: boolean;
  spinningIcon?: boolean;
  disabled?: boolean;
  strokeWidth?: number;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  type?: 'button' | 'submit' | 'reset';
  title?: string;
}

const VARIANT_CLASSES: Record<ActionButtonVariant, string> = {
  primary:
    'bg-[#0B2A5B] hover:bg-[#133A78] text-white border-[#0B2A5B] shadow-[0_1px_2px_rgba(11,42,91,0.22)] focus-visible:ring-[#1F5FA8]/45',
  brand:
    'bg-[#C8102E] hover:bg-[#A50D25] text-white border-[#C8102E] shadow-[0_1px_2px_rgba(200,16,46,0.22)] focus-visible:ring-[#C8102E]/45',
  secondary:
    'bg-white hover:bg-slate-50 text-slate-700 hover:text-[#0B2A5B] border-slate-200 hover:border-slate-300 shadow-[0_1px_2px_rgba(15,23,42,0.04)] focus-visible:ring-[#1F5FA8]/30',
  view:
    'bg-[#1F5FA8]/[0.07] hover:bg-[#1F5FA8]/[0.13] text-[#154A8A] hover:text-[#0B2A5B] border-[#1F5FA8]/25 hover:border-[#1F5FA8]/45 focus-visible:ring-[#1F5FA8]/35',
  edit:
    'bg-indigo-50/75 hover:bg-indigo-100/85 text-indigo-700 border-indigo-200/85 hover:border-indigo-300 focus-visible:ring-indigo-500/35',
  delete:
    'bg-red-50/80 hover:bg-red-100/90 text-[#B80E29] hover:text-[#8E0A1F] border-red-200/90 hover:border-red-300 focus-visible:ring-[#C8102E]/35',
  confirm:
    'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-[0_1px_2px_rgba(5,150,105,0.22)] focus-visible:ring-emerald-500/40',
  warning:
    'bg-amber-50/90 hover:bg-amber-100 text-amber-800 border-amber-200/90 hover:border-amber-300 focus-visible:ring-amber-500/35',
  ghost:
    'bg-transparent hover:bg-slate-100/85 text-slate-600 hover:text-[#0B2A5B] border-transparent hover:border-slate-200/80 focus-visible:ring-slate-400/35',
};

const SIZE_CLASSES: Record<ActionButtonSize, { btn: string; icon: string }> = {
  xs: { btn: 'h-8 px-2.5 text-xs rounded-lg gap-1.5', icon: 'w-3.5 h-3.5' },
  sm: { btn: 'h-9 px-3.5 text-xs rounded-lg gap-2', icon: 'w-4 h-4' },
  md: { btn: 'h-10 px-4 text-[13px] rounded-xl gap-2', icon: 'w-[17px] h-[17px]' },
};

export const ActionButton: React.FC<ActionButtonProps> = ({
  icon: Icon,
  iconRight: IconRight,
  children,
  variant = 'secondary',
  size = 'sm',
  loading = false,
  spinningIcon = false,
  disabled = false,
  strokeWidth = 1.85,
  className = '',
  onClick,
  type = 'button',
  title,
}) => {
  const sizeConfig = SIZE_CLASSES[size];
  const variantClasses = VARIANT_CLASSES[variant];
  const isDisabled = disabled || loading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      className={`inline-flex items-center justify-center font-semibold tracking-[-0.01em] border whitespace-nowrap shrink-0 transition-all duration-150 ease-out cursor-pointer select-none active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:pointer-events-none motion-reduce:transition-none ${sizeConfig.btn} ${variantClasses} ${className}`}
    >
      {loading ? (
        <Loader2 className={`${sizeConfig.icon} shrink-0 animate-spin`} strokeWidth={strokeWidth} aria-hidden="true" />
      ) : Icon ? (
        <Icon
          className={`${sizeConfig.icon} shrink-0 ${spinningIcon ? 'animate-spin' : ''}`}
          strokeWidth={strokeWidth}
          aria-hidden="true"
        />
      ) : null}
      <span>{children}</span>
      {IconRight && !loading && (
        <IconRight className={`${sizeConfig.icon} shrink-0`} strokeWidth={strokeWidth} aria-hidden="true" />
      )}
    </button>
  );
};
