import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Smartphone,
  CalendarCheck,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Calendar,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStudentStats } from '../../services/studentService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { getTodayLima, formatDisplayDate } from '../../lib/dateUtils';
import { ActionButton, SectionIconBadge } from '../ui';

interface StudentHomeProps {
  onNavigate: (tab: string) => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [attendancesCount, setAttendancesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const todayLima = getTodayLima();

  const loadStats = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const stats = await getStudentStats(user.id);
      setCoursesCount(stats.activeEnrollmentsCount);
      setAttendancesCount(stats.totalAttendancesCount);
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <section className="ucv-hero-reveal relative rounded-2xl overflow-hidden bg-[#071D42] shadow-[0_14px_34px_-12px_rgba(11,42,91,0.3)] border border-[#0B2A5B]/20">
        <div
          className="pointer-events-none absolute inset-0 bg-[url('/assets/aistudio/Vista_a_rea_azulada_de_edificio_universitario_938ef91a.png')] bg-cover bg-center bg-no-repeat"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#071D42] via-[#0B2A5B]/82 to-[#0B2A5B]/20"
          aria-hidden="true"
        />

        <div className="relative z-10 px-6 py-6 sm:px-8 sm:py-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5 min-w-0 max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-white/85">
              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                <Calendar className="w-3.5 h-3.5 text-white/85" strokeWidth={1.85} aria-hidden="true" />
                {formatDisplayDate(todayLima)} (Perú)
              </span>
              {profile?.code && (
                <>
                  <span aria-hidden="true" className="text-white/35">·</span>
                  <span className="font-mono tabular-nums text-white/85">
                    Cód. {profile.code}
                  </span>
                </>
              )}
              <span aria-hidden="true" className="text-white/35">·</span>
              <span className="text-white/80 font-medium">Portal Estudiante</span>
            </div>

            <h1 className="text-xl sm:text-[26px] font-bold text-white tracking-[-0.02em] leading-tight text-balance">
              Bienvenido(a), {profile?.first_names} {profile?.last_names}
            </h1>

            <p className="text-xs sm:text-[13px] text-white/85 leading-relaxed">
              Universidad César Vallejo • Resumen de tus asignaturas matriculadas y control de asistencia.
            </p>
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={loadStats}
            className="self-start md:self-center inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-white hover:bg-slate-50 text-[#0B2A5B] text-[13px] font-semibold shadow-[0_6px_18px_-4px_rgba(7,28,64,0.35)] border border-white/90 transition-all duration-150 cursor-pointer active:scale-[0.985] disabled:opacity-60 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              strokeWidth={1.9}
              aria-hidden="true"
            />
            <span>Actualizar</span>
          </button>
        </div>
      </section>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" strokeWidth={1.85} />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-900">Error al consultar datos</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        <div className="ucv-card-pro ucv-card-interactive ucv-animate-in ucv-delay-1 group relative p-5 sm:p-6 rounded-2xl overflow-hidden bg-gradient-to-br from-white via-[#F6FAFF] to-[#EBF3FF] border border-blue-100/95 shadow-[0_8px_24px_-12px_rgba(31,95,168,0.16)] flex items-center justify-between">
          <div className="relative z-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Asignaturas Matriculadas
            </span>
            <div className="text-3xl font-bold text-[#0B2A5B] mt-1.5 font-mono tabular-nums tracking-[-0.02em]">
              {loading ? '...' : coursesCount}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Matrículas vigentes en el ciclo actual
            </p>
          </div>
          <SectionIconBadge icon={BookOpen} variant="blue" size="lg" interactive />
        </div>

        <div className="ucv-card-pro ucv-card-interactive ucv-animate-in ucv-delay-2 group relative p-5 sm:p-6 rounded-2xl overflow-hidden bg-gradient-to-br from-white via-[#FFF9FA] to-[#FFF0F2] border border-red-100/95 shadow-[0_8px_24px_-12px_rgba(200,16,46,0.14)] flex items-center justify-between">
          <div className="relative z-10">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Asistencias Registradas
            </span>
            <div className="text-3xl font-bold text-[#C8102E] mt-1.5 font-mono tabular-nums tracking-[-0.02em]">
              {loading ? '...' : attendancesCount}
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Registros confirmados por docentes
            </p>
          </div>
          <SectionIconBadge icon={UserCheck} variant="red" size="lg" interactive />
        </div>
      </div>

      <div className="rounded-2xl flex items-center gap-3.5 px-5 py-3.5 bg-gradient-to-r from-[#EFF6FF] via-[#F7FAFF] to-[#EFF6FF] border border-blue-200/80 text-xs text-slate-700">
        <SectionIconBadge icon={Smartphone} variant="blue" size="sm" />
        <p className="font-medium">
          Para registrar tu asistencia con QR usa la app <strong className="font-bold text-[#0B2A5B]">UCV</strong><strong className="font-bold text-[#C8102E]">GO</strong> en tu celular.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

        <div
          onClick={() => onNavigate('mis_asignaturas')}
          className="ucv-card-pro ucv-card-interactive ucv-animate-in ucv-delay-3 p-6 rounded-2xl bg-white border border-slate-200/85 hover:border-blue-200 shadow-[0_8px_22px_-12px_rgba(11,42,91,0.12)] cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2164B5] to-[#0B2A5B] text-white flex items-center justify-center shrink-0 shadow-sm transition-transform duration-150 group-hover:scale-[1.03]">
              <BookOpen className="w-7 h-7" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B2A5B] group-hover:text-[#1F5FA8] transition-colors">
                Mis Asignaturas
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Consulte sus cursos matriculados, docentes asignados y horarios de clase semanales.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end mt-5">
            <ActionButton
              variant="view"
              size="xs"
              iconRight={ArrowRight}
              onClick={() => onNavigate('mis_asignaturas')}
              className="rounded-xl"
            >
              Ver asignaturas
            </ActionButton>
          </div>
        </div>

        <div
          onClick={() => onNavigate('mi_asistencia')}
          className="ucv-card-pro ucv-card-interactive ucv-animate-in ucv-delay-4 p-6 rounded-2xl bg-white border border-slate-200/85 hover:border-red-200 shadow-[0_8px_22px_-12px_rgba(11,42,91,0.12)] cursor-pointer flex flex-col justify-between group"
        >
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EB2640] to-[#A50D25] text-white flex items-center justify-center shrink-0 shadow-sm transition-transform duration-150 group-hover:scale-[1.03]">
              <CalendarCheck className="w-7 h-7" strokeWidth={1.75} aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#0B2A5B] group-hover:text-[#C8102E] transition-colors">
                Mi Historial de Asistencia
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Revise su porcentaje de asistencia por asignatura, tardanzas, faltas y justificaciones.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end mt-5">
            <ActionButton
              variant="delete"
              size="xs"
              iconRight={ArrowRight}
              onClick={() => onNavigate('mi_asistencia')}
              className="rounded-xl"
            >
              Ver historial
            </ActionButton>
          </div>
        </div>
      </div>

      <div className="rounded-2xl px-5 py-3.5 bg-gradient-to-r from-[#ECFDF3] via-[#F2FEF7] to-[#E9FCEF] border border-emerald-200/85 flex items-start gap-3 text-xs text-slate-700">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" strokeWidth={1.9} />
        <div>
          <span className="font-bold text-[#0B2A5B]">Mecanismo de seguridad de asistencia:</span>{' '}
          El código QR generado en clase por el docente es dinámico. Recuerde que su asistencia quedará formalmente registrada una vez que el docente apruebe su solicitud desde su panel.
        </div>
      </div>
    </div>
  );
};
