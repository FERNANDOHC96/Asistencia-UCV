import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen,
  Smartphone,
  CalendarCheck,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  GraduationCap,
  Clock,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getStudentStats } from '../../services/studentService';
import { isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';

interface StudentHomeProps {
  onNavigate: (tab: string) => void;
}

export const StudentHome: React.FC<StudentHomeProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [attendancesCount, setAttendancesCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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
    } catch (err: any) {
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

      <div className="ucv-card rounded-2xl overflow-hidden">
        <div className="h-1 w-full ucv-topbar-split" />
        <div className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#0B2A5B] via-[#1F5FA8] to-[#C8102E] p-0.5 shrink-0 shadow-xs">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center text-[#0B2A5B] font-black text-2xl">
                {profile?.first_names ? profile.first_names.charAt(0).toUpperCase() : <GraduationCap className="w-8 h-8" />}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-50 text-[#C8102E] border border-red-200">
                  Portal Estudiante
                </span>
                <span className="text-[10px] font-mono text-[#0B2A5B] font-bold bg-blue-50 border border-blue-200/80 px-1.5 py-0.5 rounded">
                  Cód: {profile?.code}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#0B2A5B] mt-1 tracking-tight">
                {profile?.first_names} {profile?.last_names}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Universidad César Vallejo • Control de asistencia universitaria
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={loadStats}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/80 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-900">Error al consultar datos</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div className="ucv-card ucv-card-interactive ucv-animate-in ucv-delay-1 p-5 rounded-xl border-t-2 border-t-[#1F5FA8] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Asignaturas Matriculadas
            </span>
            <div className="text-3xl font-black text-[#0B2A5B] mt-1 font-mono">
              {loading ? '...' : coursesCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Matrículas vigentes en el ciclo actual
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 text-[#1F5FA8] flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        <div className="ucv-card ucv-card-interactive ucv-animate-in ucv-delay-2 p-5 rounded-xl border-t-2 border-t-[#C8102E] flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Asistencias Registradas
            </span>
            <div className="text-3xl font-black text-[#C8102E] mt-1 font-mono">
              {loading ? '...' : attendancesCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Registros confirmados por docentes
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 border border-red-100 text-[#C8102E] flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="ucv-card flex items-center gap-3 px-4 py-3.5 border-l-4 border-l-[#1F5FA8] rounded-xl text-xs text-slate-700">
        <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1F5FA8] flex items-center justify-center shrink-0">
          <Smartphone className="w-4 h-4" />
        </div>
        <p className="font-medium">
          Para registrar tu asistencia con QR usa la app <strong className="font-extrabold text-[#0B2A5B]">UCV</strong><strong className="font-extrabold text-[#C8102E]">GO</strong> en tu celular.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div
          onClick={() => onNavigate('mis_asignaturas')}
          className="ucv-card ucv-card-interactive ucv-animate-in ucv-delay-3 p-6 rounded-2xl border-t-2 border-t-[#1F5FA8] hover:border-blue-300 cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#1F5FA8] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0B2A5B]">Mis Asignaturas</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Consulte sus cursos matriculados, docentes asignados y horarios de clase semanales.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F5FA8] mt-6 group-hover:translate-x-1 transition-transform">
            <span>Ver asignaturas</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        <div
          onClick={() => onNavigate('mi_asistencia')}
          className="ucv-card ucv-card-interactive ucv-animate-in ucv-delay-4 p-6 rounded-2xl border-t-2 border-t-[#C8102E] hover:border-red-300 cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 text-[#C8102E] flex items-center justify-center mb-4 transition-transform group-hover:scale-105">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-[#0B2A5B]">Mi Historial de Asistencia</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Revise su porcentaje de asistencia por asignatura, tardanzas, faltas y justificaciones.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#C8102E] mt-6 group-hover:translate-x-1 transition-transform">
            <span>Ver historial</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="ucv-card p-4 rounded-xl border-l-4 border-l-[#C8102E] flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[#0B2A5B]">Mecanismo de seguridad de asistencia:</span>{' '}
          El código QR generado en clase por el docente es dinámico. Recuerde que su asistencia quedará formalmente registrada una vez que el docente apruebe su solicitud desde su panel.
        </div>
      </div>
    </div>
  );
};
