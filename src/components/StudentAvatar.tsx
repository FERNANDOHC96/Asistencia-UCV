import React, { useState, useEffect } from 'react';
import { AttendanceStatus } from '../types';

export interface StudentAvatarData {
  id: string;
  first_names: string;
  last_names: string;
  code?: string;
  avatar_updated_at?: string | null;
}

export interface StudentAvatarProps {
  student: StudentAvatarData;
  status?: AttendanceStatus | 'sin_registrar';
  signedUrl?: string | null;
  isAnimated?: boolean;
  className?: string;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  student,
  status,
  signedUrl,
  isAnimated = false,
  className = '',
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [signedUrl]);

  const firstLetter = (student.first_names?.trim()?.[0] || '').toUpperCase();
  const lastLetter = (student.last_names?.trim()?.[0] || '').toUpperCase();
  const initials = `${firstLetter}${lastLetter}` || 'AL';
  const fullName = `${student.first_names || ''} ${student.last_names || ''}`.trim();

  let ringClasses = 'ring-2 ring-slate-200';
  if (status) {
    switch (status) {
      case 'presente':
        ringClasses = 'ring-[3px] ring-emerald-500 ring-offset-1 ring-offset-white';
        break;
      case 'tardanza':
        ringClasses = 'ring-[3px] ring-amber-500 ring-offset-1 ring-offset-white';
        break;
      case 'falta':
        ringClasses = 'ring-[3px] ring-red-500 ring-offset-1 ring-offset-white';
        break;
      case 'justificado':
        ringClasses = 'ring-[3px] ring-slate-500 ring-offset-1 ring-offset-white';
        break;
      case 'sin_registrar':
      default:
        ringClasses = 'ring-[3px] ring-slate-300 ring-offset-1 ring-offset-white';
        break;
    }
  }

  const renderBadge = () => {
    if (!status) return null;

    let badgeBg = 'bg-slate-300 text-slate-700';
    let icon = '—';

    switch (status) {
      case 'presente':
        badgeBg = 'bg-emerald-600 text-white';
        icon = '✓';
        break;
      case 'tardanza':
        badgeBg = 'bg-amber-500 text-white';
        icon = '⏱';
        break;
      case 'falta':
        badgeBg = 'bg-red-600 text-white';
        icon = '✕';
        break;
      case 'justificado':
        badgeBg = 'bg-slate-700 text-white';
        icon = 'J';
        break;
      case 'sin_registrar':
      default:
        badgeBg = 'bg-slate-300 text-slate-600';
        icon = '—';
        break;
    }

    return (
      <span
        aria-hidden="true"
        className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border border-white shadow-sm transition-all duration-300 ${badgeBg}`}
      >
        {icon}
      </span>
    );
  };

  const hasPhoto = Boolean(signedUrl && !imgError);

  return (
    <div
      className={`relative group inline-flex items-center justify-center select-none flex-shrink-0 ${className}`}
    >

      <div
        className={`w-10 h-10 min-w-[40px] min-h-[40px] max-w-[40px] max-h-[40px] rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 ${ringClasses} ${
          isAnimated ? 'scale-115 ring-offset-2' : ''
        }`}
      >
        {hasPhoto ? (
          <img
            src={signedUrl!}
            alt={fullName}
            loading="lazy"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <div className="w-full h-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center tracking-wider">
            {initials}
          </div>
        )}
      </div>

      {renderBadge()}

      <div
        className="hidden md:group-hover:flex absolute left-12 top-1/2 -translate-y-1/2 z-50 flex-col items-center p-2.5 bg-white rounded-xl shadow-2xl border border-slate-200/90 pointer-events-none w-[148px] animate-in fade-in zoom-in-95 duration-150"
        style={{ filter: 'drop-shadow(0 10px 15px rgba(0, 0, 0, 0.15))' }}
      >

        <div className="w-[120px] h-[120px] rounded-full overflow-hidden bg-slate-100 flex items-center justify-center ring-1 ring-slate-200/80 shadow-inner flex-shrink-0">
          {hasPhoto ? (
            <img
              src={signedUrl!}
              alt={fullName}
              className="w-full h-full object-cover rounded-full"
            />
          ) : (
            <span className="text-3xl font-extrabold text-slate-600 tracking-wider">
              {initials}
            </span>
          )}
        </div>

        <div className="mt-2 text-center w-full px-1">
          <p className="text-xs font-semibold text-slate-900 leading-snug line-clamp-2">
            {fullName || 'Alumno'}
          </p>
          {student.code && (
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">
              {student.code}
            </p>
          )}
          {status && (
            <span
              className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                status === 'presente'
                  ? 'bg-emerald-100 text-emerald-800'
                  : status === 'tardanza'
                  ? 'bg-amber-100 text-amber-800'
                  : status === 'falta'
                  ? 'bg-red-100 text-red-800'
                  : status === 'justificado'
                  ? 'bg-slate-200 text-slate-800'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {status.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
