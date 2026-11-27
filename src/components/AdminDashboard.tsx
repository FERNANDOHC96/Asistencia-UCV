import React, { useState, useEffect, useCallback } from 'react';
import { Users, GraduationCap, BookOpen, UserCheck, ArrowRight, RefreshCw, AlertCircle, UserPlus, Plus, ShieldBan } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';
import { useAuth } from '../context/AuthContext';
import { CreateUserModal } from './CreateUserModal';
import { fetchActiveBlockedCount } from '../services/blockService';
import { ActionButton, SectionIconBadge } from './ui';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { profile } = useAuth();

  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);
  const [blockedCount, setBlockedCount] = useState<number | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [modalRole, setModalRole] = useState<'alumno' | 'profesor' | null>(null);

  const fetchMetrics = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      const { count: cAlumnos, error: errAlumnos } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'alumno');
      if (errAlumnos) throw errAlumnos;

      const { count: cProfesores, error: errProfesores } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'profesor');
      if (errProfesores) throw errProfesores;

      const { count: cCursos, error: errCursos } = await supabase
        .from('course_overview')
        .select('*', { count: 'exact', head: true });
      if (errCursos) throw errCursos;

      const { count: cMatriculas, error: errMatriculas } = await supabase
        .from('enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'activa');
      if (errMatriculas) throw errMatriculas;

      const activeBlocked = await fetchActiveBlockedCount().catch(() => 0);

      setStudentCount(cAlumnos ?? 0);
      setTeacherCount(cProfesores ?? 0);
      setCourseCount(cCursos ?? 0);
      setEnrollmentCount(cMatriculas ?? 0);
      setBlockedCount(activeBlocked);
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
      setStudentCount(null);
      setTeacherCount(null);
      setCourseCount(null);
      setEnrollmentCount(null);
      setBlockedCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] tracking-[-0.02em]">
            Panel de Administración
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Bienvenido, <span className="font-semibold text-slate-800">{profile?.first_names} {profile?.last_names}</span>. Gestión simplificada de alumnos, profesores y cursos.
          </p>
        </div>

        <ActionButton
          icon={RefreshCw}
          variant="secondary"
          size="sm"
          spinningIcon={loading}
          disabled={loading}
          onClick={fetchMetrics}
          className="self-start sm:self-auto"
        >
          Actualizar métricas
        </ActionButton>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" strokeWidth={1.85} />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="group ucv-card ucv-card-interactive ucv-animate-in ucv-delay-1 rounded-2xl border-t-2 border-t-[#1F5FA8] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <SectionIconBadge icon={Users} variant="blue" size="md" interactive />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Catálogo
              </span>
            </div>
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
              Total Alumnos
            </h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#0B2A5B] font-mono tabular-nums tracking-[-0.02em]">
                {loading ? '...' : studentCount !== null ? studentCount : '-'}
              </span>
              <span className="text-xs text-slate-500">estudiantes</span>
            </div>
            {!loading && studentCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50/90 rounded-xl border border-amber-200/85 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">No hay alumnos registrados</p>
                <ActionButton
                  icon={Plus}
                  variant="primary"
                  size="xs"
                  onClick={() => setModalRole('alumno')}
                  className="w-full"
                >
                  Registrar primer alumno
                </ActionButton>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('alumnos')}
              className="text-xs font-semibold text-[#154A8A] hover:text-[#0B2A5B] inline-flex items-center gap-1 group/link cursor-pointer transition-colors"
            >
              <span>Ver listado</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" strokeWidth={1.9} />
            </button>
            <ActionButton
              icon={UserPlus}
              variant="view"
              size="xs"
              onClick={() => setModalRole('alumno')}
            >
              Nuevo
            </ActionButton>
          </div>
        </div>

        <div className="group ucv-card ucv-card-interactive ucv-animate-in ucv-delay-2 rounded-2xl border-t-2 border-t-[#C8102E] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <SectionIconBadge icon={GraduationCap} variant="red" size="md" interactive />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Catálogo
              </span>
            </div>
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
              Total Profesores
            </h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#0B2A5B] font-mono tabular-nums tracking-[-0.02em]">
                {loading ? '...' : teacherCount !== null ? teacherCount : '-'}
              </span>
              <span className="text-xs text-slate-500">docentes</span>
            </div>
            {!loading && teacherCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50/90 rounded-xl border border-amber-200/85 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">No hay profesores registrados</p>
                <ActionButton
                  icon={Plus}
                  variant="brand"
                  size="xs"
                  onClick={() => setModalRole('profesor')}
                  className="w-full"
                >
                  Registrar primer profesor
                </ActionButton>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('profesores')}
              className="text-xs font-semibold text-[#B80E29] hover:text-[#8E0A1F] inline-flex items-center gap-1 group/link cursor-pointer transition-colors"
            >
              <span>Ver listado</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" strokeWidth={1.9} />
            </button>
            <ActionButton
              icon={UserPlus}
              variant="delete"
              size="xs"
              onClick={() => setModalRole('profesor')}
            >
              Nuevo
            </ActionButton>
          </div>
        </div>

        <div className="group ucv-card ucv-card-interactive ucv-animate-in ucv-delay-3 rounded-2xl border-t-2 border-t-[#0B2A5B] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <SectionIconBadge icon={BookOpen} variant="navy" size="md" interactive />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Académico
              </span>
            </div>
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
              Cursos
            </h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#0B2A5B] font-mono tabular-nums tracking-[-0.02em]">
                {loading ? '...' : courseCount !== null ? courseCount : '-'}
              </span>
              <span className="text-xs text-slate-500">cursos activos</span>
            </div>
            {!loading && courseCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50/90 rounded-xl border border-amber-200/85 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">No hay cursos registrados</p>
                <ActionButton
                  icon={Plus}
                  variant="primary"
                  size="xs"
                  onClick={() => onNavigate('cursos')}
                  className="w-full"
                >
                  Crear primer curso
                </ActionButton>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('cursos')}
              className="text-xs font-semibold text-[#0B2A5B] hover:text-[#154A8A] inline-flex items-center gap-1 group/link cursor-pointer transition-colors"
            >
              <span>Gestionar cursos</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <div className="group ucv-card ucv-card-interactive ucv-animate-in ucv-delay-4 rounded-2xl border-t-2 border-t-[#154A8A] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <SectionIconBadge icon={UserCheck} variant="blue" size="md" interactive />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Inscripciones
              </span>
            </div>
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
              Matrículas Activas
            </h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className="text-3xl font-bold text-[#0B2A5B] font-mono tabular-nums tracking-[-0.02em]">
                {loading ? '...' : enrollmentCount !== null ? enrollmentCount : '-'}
              </span>
              <span className="text-xs text-slate-500">estudiantes inscritos</span>
            </div>
            {!loading && enrollmentCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50/90 rounded-xl border border-amber-200/85 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">Sin alumnos matriculados</p>
                <ActionButton
                  iconRight={ArrowRight}
                  variant="brand"
                  size="xs"
                  onClick={() => onNavigate('cursos')}
                  className="w-full"
                >
                  Ir a Cursos para matricular
                </ActionButton>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('cursos')}
              className="text-xs font-semibold text-[#154A8A] hover:text-[#0B2A5B] inline-flex items-center gap-1 group/link cursor-pointer transition-colors"
            >
              <span>Gestionar matrículas</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" strokeWidth={1.9} />
            </button>
          </div>
        </div>

        <div className="group ucv-card ucv-card-interactive ucv-animate-in ucv-delay-4 rounded-2xl border-t-2 border-t-[#C8102E] p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <SectionIconBadge icon={ShieldBan} variant="red" size="md" interactive />
              <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
                Asistencia
              </span>
            </div>
            <h3 className="text-[11px] font-semibold text-slate-500 uppercase tracking-[0.06em]">
              Alumnos Inhabilitados
            </h3>
            <div className="mt-1.5 flex items-baseline gap-2">
              <span className={`text-3xl font-bold font-mono tabular-nums tracking-[-0.02em] ${blockedCount && blockedCount > 0 ? 'text-[#C8102E]' : 'text-[#0B2A5B]'}`}>
                {loading ? '...' : blockedCount !== null ? blockedCount : '-'}
              </span>
              <span className="text-xs text-slate-500">bloqueos activos</span>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('inhabilitados')}
              className="text-xs font-semibold text-[#B80E29] hover:text-[#8E0A1F] inline-flex items-center gap-1 group/link cursor-pointer transition-colors"
            >
              <span>Gestionar inhabilitados</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-0.5 transition-transform" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </div>

      {modalRole && (
        <CreateUserModal
          isOpen={true}
          role={modalRole}
          onClose={() => setModalRole(null)}
          onSuccess={() => {
            fetchMetrics();
          }}
        />
      )}
    </div>
  );
};
