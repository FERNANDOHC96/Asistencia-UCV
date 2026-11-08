import React, { useState, useEffect, useCallback } from 'react';
import { Users, GraduationCap, BookOpen, UserCheck, ArrowRight, RefreshCw, AlertCircle, UserPlus, Plus } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';
import { useAuth } from '../context/AuthContext';
import { CreateUserModal } from './CreateUserModal';

interface AdminDashboardProps {
  onNavigate: (tab: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const { profile } = useAuth();

  const [studentCount, setStudentCount] = useState<number | null>(null);
  const [teacherCount, setTeacherCount] = useState<number | null>(null);
  const [courseCount, setCourseCount] = useState<number | null>(null);
  const [enrollmentCount, setEnrollmentCount] = useState<number | null>(null);

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

      setStudentCount(cAlumnos ?? 0);
      setTeacherCount(cProfesores ?? 0);
      setCourseCount(cCursos ?? 0);
      setEnrollmentCount(cMatriculas ?? 0);
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
      setStudentCount(null);
      setTeacherCount(null);
      setCourseCount(null);
      setEnrollmentCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
            Panel de Administración
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Bienvenido, <span className="font-semibold text-slate-800">{profile?.first_names} {profile?.last_names}</span>. Gestión simplificada de alumnos, profesores y cursos.
          </p>
        </div>

        <button
          onClick={fetchMetrics}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-[#1F5FA8] hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar métricas</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1F5FA8] flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Catálogo
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Alumnos
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                {loading ? '...' : studentCount !== null ? studentCount : '-'}
              </span>
              <span className="text-xs text-slate-500">estudiantes</span>
            </div>
            {!loading && studentCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">No hay alumnos registrados</p>
                <button
                  onClick={() => setModalRole('alumno')}
                  className="w-full py-1 px-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar primer alumno</span>
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('alumnos')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 group cursor-pointer"
            >
              <span>Ver listado</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => setModalRole('alumno')}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3 h-3 text-[#1F5FA8]" />
              <span>Nuevo</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Catálogo
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Total Profesores
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                {loading ? '...' : teacherCount !== null ? teacherCount : '-'}
              </span>
              <span className="text-xs text-slate-500">docentes</span>
            </div>
            {!loading && teacherCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">No hay profesores registrados</p>
                <button
                  onClick={() => setModalRole('profesor')}
                  className="w-full py-1 px-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar primer profesor</span>
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('profesores')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 group cursor-pointer"
            >
              <span>Ver listado</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <button
              onClick={() => setModalRole('profesor')}
              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <UserPlus className="w-3 h-3 text-[#1F5FA8]" />
              <span>Nuevo</span>
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Académico
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Cursos
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                {loading ? '...' : courseCount !== null ? courseCount : '-'}
              </span>
              <span className="text-xs text-slate-500">cursos activos</span>
            </div>
            {!loading && courseCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">No hay cursos registrados</p>
                <button
                  onClick={() => onNavigate('cursos')}
                  className="w-full py-1 px-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Crear primer curso</span>
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('cursos')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 group cursor-pointer"
            >
              <span>Gestionar cursos</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Inscripciones
              </span>
            </div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Matrículas Activas
            </h3>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-[#0B2A5B] font-mono">
                {loading ? '...' : enrollmentCount !== null ? enrollmentCount : '-'}
              </span>
              <span className="text-xs text-slate-500">estudiantes inscritos</span>
            </div>
            {!loading && enrollmentCount === 0 && (
              <div className="mt-3 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <p className="text-[11px] font-medium text-amber-800 mb-2">Sin alumnos matriculados</p>
                <button
                  onClick={() => onNavigate('cursos')}
                  className="w-full py-1 px-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Ir a Cursos para matricular</span>
                </button>
              </div>
            )}
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            <button
              onClick={() => onNavigate('cursos')}
              className="text-xs font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1 group cursor-pointer"
            >
              <span>Gestionar matrículas</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
