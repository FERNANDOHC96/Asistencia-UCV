import React from 'react';
import { Check, Clock, X, Loader2 } from 'lucide-react';
import { AttendanceStatus } from '../../types';

export interface AttendanceStatusButtonProps {
  status: AttendanceStatus;
  isActive: boolean;
  isLoading?: boolean;
  disabled?: boolean;
  isAnimated?: boolean;
  size?: 'sm' | 'md';
  onClick: () => void;
}

const STATUS_CONFIG: Record<
  AttendanceStatus,
  {
    name: string;
    activeBg: string;
    activeBorder: string;
    icon: (sizeClass: string) => React.ReactNode;
  }
> = {
  presente: {
    name: 'presente',
    activeBg: 'bg-[#1B7F4B]',
    activeBorder: 'border-[#1B7F4B]',
    icon: (sizeClass) => <Check className={`${sizeClass} stroke-[3]`} />,
  },
  tardanza: {
    name: 'tardanza',
    activeBg: 'bg-[#F59E0B]',
    activeBorder: 'border-[#F59E0B]',
    icon: (sizeClass) => <Clock className={`${sizeClass} stroke-[2.5]`} />,
  },
  falta: {
    name: 'falta',
    activeBg: 'bg-[#C8102E]',
    activeBorder: 'border-[#C8102E]',
    icon: (sizeClass) => <X className={`${sizeClass} stroke-[3]`} />,
  },
  justificado: {
    name: 'justificado',
    activeBg: 'bg-[#4B6584]',
    activeBorder: 'border-[#4B6584]',
    icon: () => <span className="font-bold text-xs leading-none select-none">J</span>,
  },
};

export const AttendanceStatusButton: React.FC<AttendanceStatusButtonProps> = ({
  status,
  isActive,
  isLoading = false,
  disabled = false,
  isAnimated = false,
  size = 'md',
  onClick,
}) => {
  const config = STATUS_CONFIG[status];
  const sizeClasses = size === 'sm' ? 'w-7 h-7' : 'w-7.5 h-7.5 sm:w-8 sm:h-8';
  const iconSizeClass = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3.5 h-3.5 sm:w-4 sm:h-4';

  const titleText = isLoading
    ? 'Guardando...'
    : isActive
    ? `${config.name.charAt(0).toUpperCase() + config.name.slice(1)} (actual)`
    : `Marcar ${config.name}`;

  const ariaLabel = isLoading
    ? `Guardando estado ${config.name}...`
    : isActive
    ? `${config.name.charAt(0).toUpperCase() + config.name.slice(1)} (estado actual)`
    : `Marcar ${config.name}`;

  let stateClasses = '';
  if (isLoading) {
    stateClasses = 'bg-[#F1F3F6] border-[#D5DCE6] text-[#8A97A8] cursor-wait';
  } else if (isActive) {
    stateClasses = `${config.activeBg} ${config.activeBorder} text-white shadow-xs cursor-default ${
      isAnimated ? 'scale-105 animate-pop motion-reduce:transform-none motion-reduce:animate-none' : ''
    }`;
  } else {
    stateClasses =
      'bg-[#F1F3F6] border-[#D5DCE6] text-[#8A97A8] hover:bg-[#E4E8EE] hover:text-[#5B6B7C] hover:border-[#CBD4E1] cursor-pointer transition-colors';
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isLoading}
      title={titleText}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      aria-busy={isLoading ? 'true' : undefined}
      className={`${sizeClasses} rounded-full border flex items-center justify-center transition-all duration-150 motion-reduce:transition-none focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/40 focus:ring-offset-1 select-none ${stateClasses}`}
    >
      {isLoading ? (
        <Loader2 className={`${iconSizeClass} animate-spin text-[#8A97A8]`} />
      ) : (
        config.icon(iconSizeClass)
      )}
    </button>
  );
};

export interface AttendanceStatusButtonGroupProps {
  currentStatus?: AttendanceStatus | 'sin_registrar' | null;
  savingStatus?: AttendanceStatus | null;
  disabled?: boolean;
  isAnimated?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  onSelectStatus: (status: AttendanceStatus) => void;
  onJustifyClick?: () => void;
}

export const AttendanceStatusButtonGroup: React.FC<AttendanceStatusButtonGroupProps> = ({
  currentStatus,
  savingStatus = null,
  disabled = false,
  isAnimated = false,
  size = 'md',
  className = '',
  onSelectStatus,
  onJustifyClick,
}) => {
  const statuses: AttendanceStatus[] = ['presente', 'tardanza', 'falta', 'justificado'];

  return (
    <div
      role="group"
      aria-label="Controles de estado de asistencia"
      className={`flex items-center gap-1.5 shrink-0 ${className}`}
    >
      {statuses.map((st) => {
        const isActive = currentStatus === st;
        const isLoading = savingStatus === st;

        const handleClick = () => {
          if (disabled || isLoading) return;
          if (st === 'justificado' && onJustifyClick) {
            onJustifyClick();
          } else {
            onSelectStatus(st);
          }
        };

        return (
          <AttendanceStatusButton
            key={st}
            status={st}
            isActive={isActive}
            isLoading={isLoading}
            disabled={disabled || Boolean(savingStatus)}
            isAnimated={isAnimated && isActive}
            size={size}
            onClick={handleClick}
          />
        );
      })}
    </div>
  );
};
