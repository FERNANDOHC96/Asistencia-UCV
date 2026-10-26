import React, { useState, useEffect, useCallback } from 'react';
import { BookOpen, Calendar, Users, Clock, ArrowRight, RefreshCw, AlertCircle, CheckCircle2, UserCheck, Layers, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { getTeacherSections, TeacherSection } from '../../services/teacherService';
import { getTodayLima, formatDisplayDate } from '../../lib/dateUtils';
import { translateSupabaseError } from '../../lib/supabaseErrors';

interface TeacherHomeProps {
  onNavigate: (tab: string) => void;
}

export const TeacherHome: React.FC<TeacherHomeProps> = ({ onNavigate }) => {
  const { user, profile } = useAuth();
  const [sections, setSections] = useState<TeacherSection[]>([]);
  const [sessionsTodayCount, setSessionsTodayCount] = useState<number>(0);
  const [totalStudentsCount, setTotalStudentsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const todayLima = getTodayLima();

  const fetchDashboardData = useCallback(async () => {
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
      const supabase = getSupabaseClient();

      // 1. Obtener secciones asignadas al profesor autenticado
      const teacherSections = await getTeacherSections(user.id);
      setSections(teacherSections);

      const sectionIds = teacherSections.map((s) => s.id);

      // 2. Alumnos matriculados en total (suma de matrículas activas de sus secciones)
      const totalStudents = teacherSections.reduce((acc, s) => acc + s.activeEnrollmentsCount, 0);
      setTotalStudentsCount(totalStudents);

      // 3. Sesiones programadas para hoy
      if (sectionIds.length > 0) {
        const { count: sTodayCount, error: sErr } = await supabase
          .from('class_sessions')
          .select('*', { count: 'exact', head: true })
          .in('section_id', sectionIds)
          .is('archived_at', null)
          .eq('session_date', todayLima)
          .eq('status', 'programada');

        if (sErr) throw sErr;
        setSessionsTodayCount(sTodayCount ?? 0);
      } else {
        setSessionsTodayCount(0);
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, [user, todayLima]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header institucional */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-100 text-[#1F5FA8]">
              Docente Titular
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Hoy: {formatDisplayDate(todayLima)} (Perú)
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] mt-1">
            Bienvenido(a), Prof. {profile?.first_names} {profile?.last_names}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-mono mt-0.5">
            Código Universitario: <strong className="text-slate-800">{profile?.code}</strong>
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-[#1F5FA8] hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Error en la consulta</span>
            <p className="mt-0.5 leading-relaxed">{error}</p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Mis Asignaturas */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1F5FA8] flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Carga Lectiva
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mis Secciones
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                {loading ? '...' : sections.length}
              </span>
              <span className="text-xs text-slate-500">asignadas</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('mis_asignaturas')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 group cursor-pointer"
            >
              <span>Ver mis asignaturas</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Sesiones de Hoy */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Horario de Hoy
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Sesiones Programadas Hoy
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                {loading ? '...' : sessionsTodayCount}
              </span>
              <span className="text-xs text-slate-500">clases hoy</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('sesiones')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 group cursor-pointer"
            >
              <span>Ver sesiones de clase</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        {/* Alumnos en Total */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Estudiantes
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Alumnos a Cargo
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                {loading ? '...' : totalStudentsCount}
              </span>
              <span className="text-xs text-slate-500">matriculados activos</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('asistencia')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 group cursor-pointer"
            >
              <span>Registrar asistencia</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Empty State / Sections List */}
      {!loading && sections.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-xs border border-amber-200 p-8 text-center max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">
            Todavía no tienes cursos asignados
          </h3>
          <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
            Todavía no tienes cursos asignados. Pide al administrador que te asigne una sección.
          </p>
          <div className="mt-4 inline-block text-[11px] font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            Una vez que se asigne tu perfil a una sección, podrás gestionar tus clases y tomar asistencia.
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">
                Resumen de Mis Secciones Asignadas
              </h3>
              <p className="text-xs text-slate-500">
                Periodo lectivo actual y aforo de cada grupo
              </p>
            </div>
            <button
              onClick={() => onNavigate('mis_asignaturas')}
              className="text-xs font-bold text-[#1F5FA8] hover:underline"
            >
              Ver detalle completo
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sections.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-blue-300 transition-all shadow-2xs group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs font-bold bg-blue-100 text-[#1F5FA8] px-2 py-0.5 rounded border border-blue-200">
                    Sección {s.name}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-500 font-mono">
                    {s.offering.period.name}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 mt-2 line-clamp-1 group-hover:text-[#1F5FA8] transition-colors">
                  {s.offering.course.name}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  {s.offering.course.code} • {s.offering.course.credits} créditos
                </p>

                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs">
                  <span className="text-slate-600 flex items-center gap-1 font-medium">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    {s.activeEnrollmentsCount} {s.capacity ? `/ ${s.capacity}` : 'alumnos'}
                  </span>
                  <button
                    onClick={() => onNavigate('asistencia')}
                    className="text-[11px] font-bold text-[#1F5FA8] hover:underline flex items-center gap-1"
                  >
                    <span>Asistencia</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
