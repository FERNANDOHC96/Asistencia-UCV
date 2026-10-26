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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Tarjeta de bienvenida y perfil */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#EEF2F7] border border-blue-200 flex items-center justify-center text-[#1F5FA8] shrink-0 font-black text-2xl shadow-2xs">
            {profile?.first_names ? profile.first_names.charAt(0).toUpperCase() : <GraduationCap className="w-8 h-8" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                Portal Estudiante
              </span>
              <span className="text-[10px] font-mono text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded">
                Cód: {profile?.code}
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#0B2A5B] mt-1">
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {/* Alerta de Error */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-bold text-red-800">Error al consultar datos</h4>
            <p className="text-xs text-red-700 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Contadores Reales */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Asignaturas Matriculadas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Asignaturas Matriculadas
            </span>
            <div className="text-3xl font-black text-[#0B2A5B] mt-1">
              {loading ? '...' : coursesCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Matrículas vigentes en el ciclo actual
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1F5FA8] flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Asistencias Registradas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Asistencias Registradas
            </span>
            <div className="text-3xl font-black text-emerald-700 mt-1">
              {loading ? '...' : attendancesCount}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Registros confirmados por docentes
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Aviso discreto App Móvil */}
      <div className="flex items-center gap-3 px-4 py-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-xs text-slate-700">
        <Smartphone className="w-5 h-5 text-[#1F5FA8] shrink-0" />
        <p className="font-medium">
          Para registrar tu asistencia con QR usa la app <strong className="font-bold text-[#0B2A5B]">AsisQR UCV</strong> en tu celular.
        </p>
      </div>

      {/* Acciones Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Mis Asignaturas */}
        <div
          onClick={() => onNavigate('mis_asignaturas')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#1F5FA8] flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Mis Asignaturas</h3>
            <p className="text-xs text-slate-500 mt-1">
              Consulte sus cursos matriculados, docentes asignados y horarios de clase semanales.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1F5FA8] mt-6 group-hover:translate-x-1 transition-transform">
            <span>Ver asignaturas</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>

        {/* Mi Asistencia */}
        <div
          onClick={() => onNavigate('mi_asistencia')}
          className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs hover:border-blue-300 transition-all cursor-pointer flex flex-col justify-between group"
        >
          <div>
            <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Mi Historial de Asistencia</h3>
            <p className="text-xs text-slate-500 mt-1">
              Revise su porcentaje de asistencia por asignatura, tardanzas, faltas y justificaciones.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 mt-6 group-hover:translate-x-1 transition-transform">
            <span>Ver historial</span>
            <ArrowRight className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Aviso institucional */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
        <ShieldCheck className="w-4 h-4 text-[#1F5FA8] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold text-[#0B2A5B]">Mecanismo de seguridad de asistencia:</span>{' '}
          El código QR generado en clase por el docente es dinámico. Recuerde que su asistencia quedará formalmente registrada una vez que el docente apruebe su solicitud desde su panel.
        </div>
      </div>
    </div>
  );
};
