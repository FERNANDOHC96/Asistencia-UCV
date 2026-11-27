import React from 'react';
import { LucideIcon } from 'lucide-react';

export type SectionIconVariant =
  | 'navy'
  | 'blue'
  | 'red'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'neutral';

export type SectionIconSize = 'sm' | 'md' | 'lg';

export interface SectionIconBadgeProps {
  icon: LucideIcon;
  variant?: SectionIconVariant;
  size?: SectionIconSize;
  interactive?: boolean;
  strokeWidth?: number;
  className?: string;
}

const VARIANT_CLASSES: Record<SectionIconVariant, string> = {
  navy: 'bg-[#0B2A5B]/[0.07] text-[#0B2A5B] border-[#0B2A5B]/15',
  blue: 'bg-[#1F5FA8]/[0.08] text-[#154A8A] border-[#1F5FA8]/18',
  red: 'bg-[#C8102E]/[0.07] text-[#B80E29] border-[#C8102E]/18',
  emerald: 'bg-emerald-50/90 text-emerald-700 border-emerald-200/85',
  amber: 'bg-amber-50/90 text-amber-700 border-amber-200/85',
  indigo: 'bg-indigo-50/90 text-indigo-700 border-indigo-200/85',
  neutral: 'bg-slate-100/90 text-slate-600 border-slate-200/90',
};

const SIZE_CLASSES: Record<SectionIconSize, { box: string; icon: string }> = {
  sm: { box: 'w-9 h-9 rounded-lg', icon: 'w-[17px] h-[17px]' },
  md: { box: 'w-10 h-10 rounded-xl', icon: 'w-[19px] h-[19px]' },
  lg: { box: 'w-12 h-12 rounded-xl', icon: 'w-[22px] h-[22px]' },
};

export const SectionIconBadge: React.FC<SectionIconBadgeProps> = ({
  icon: Icon,
  variant = 'navy',
  size = 'md',
  interactive = false,
  strokeWidth = 1.8,
  className = '',
}) => {
  const sizeConfig = SIZE_CLASSES[size];
  const colorClasses = VARIANT_CLASSES[variant];

  return (
    <div
      className={`inline-flex items-center justify-center shrink-0 border ${
        interactive ? 'transition-transform duration-150 group-hover:scale-[1.03]' : ''
      } ${sizeConfig.box} ${colorClasses} ${className}`}
      aria-hidden="true"
    >
      <Icon className={sizeConfig.icon} strokeWidth={strokeWidth} />
    </div>
  );
};
