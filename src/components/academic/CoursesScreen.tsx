import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  Loader2,
  X,
  CheckCircle2,
  ArrowLeft,
  User,
  Users,
  UserCheck,
  UserMinus,
  Archive,
  GraduationCap,
  CheckSquare,
  Square,
  AlertTriangle,
  ChevronRight,
  Clock,
  Calendar
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { fetchProfilesMapByIds, ProfileBasicInfo } from '../../lib/profileHelper';
import { CourseOverview, Profile } from '../../types';
import { formatDisplayDate, formatLimaTime } from '../../lib/dateUtils';
import { DeleteConfirmModal } from '../DeleteConfirmModal';
import { CourseScheduleSection } from './CourseScheduleSection';
import { CourseSessionsSection } from './CourseSessionsSection';
import { IconActionButton, ActionButton, SectionIconBadge } from '../ui';

interface EnrolledStudentRecord {
  id: string;
  student_id: string;
  enrolled_at?: string;
  profile?: ProfileBasicInfo;
}

export const CoursesScreen: React.FC = () => {
  const [courses, setCourses] = useState<CourseOverview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [selectedCourse, setSelectedCourse] = useState<CourseOverview | null>(null);
  const [courseTab, setCourseTab] = useState<'resumen' | 'horario' | 'sesiones'>('resumen');

  const [teachers, setTeachers] = useState<ProfileBasicInfo[]>([]);

  const [isNewCourseModalOpen, setIsNewCourseModalOpen] = useState<boolean>(false);
  const [newCode, setNewCode] = useState<string>('');
  const [newName, setNewName] = useState<string>('');
  const [newTeacherId, setNewTeacherId] = useState<string>('');
  const [newCourseLoading, setNewCourseLoading] = useState<boolean>(false);
  const [newCourseError, setNewCourseError] = useState<string | null>(null);

  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSuccess, setDetailSuccess] = useState<string | null>(null);

  const [editTeacherId, setEditTeacherId] = useState<string>('');
  const [saveTeacherLoading, setSaveTeacherLoading] = useState<boolean>(false);

  const [enrolledStudents, setEnrolledStudents] = useState<EnrolledStudentRecord[]>([]);
  const [unenrollStudentTarget, setUnenrollStudentTarget] = useState<EnrolledStudentRecord | null>(null);
  const [unenrollLoading, setUnenrollLoading] = useState<boolean>(false);

  const [availableStudents, setAvailableStudents] = useState<ProfileBasicInfo[]>([]);
  const [enrollSearch, setEnrollSearch] = useState<string>('');
  const [selectedToEnroll, setSelectedToEnroll] = useState<Set<string>>(new Set());
  const [enrollLoading, setEnrollLoading] = useState<boolean>(false);
  const [confirmEnrollAllOpen, setConfirmEnrollAllOpen] = useState<boolean>(false);

  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState<boolean>(false);
  const [archiveLoading, setArchiveLoading] = useState<boolean>(false);

  const fetchCourses = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: sbError } = await supabase
        .from('course_overview')
        .select('*')
        .order('name', { ascending: true });

      if (sbError) {
        throw sbError;
      }

      setCourses(data || []);
      if (selectedCourse) {
        const refreshed = (data || []).find((c) => c.section_id === selectedCourse.section_id);
        if (refreshed) {
          setSelectedCourse(refreshed);
        }
      }
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'courses'));
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCourse]);

  const fetchTeachers = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('profiles')
        .select('id, code, first_names, last_names')
        .eq('role', 'profesor')
        .eq('active', true)
        .order('last_names', { ascending: true });
      setTeachers(data || []);
    } catch {

    }
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchTeachers();
  }, []);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) => {
      const fullTeacher = `${c.teacher_first_names || ''} ${c.teacher_last_names || ''}`.toLowerCase();
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        fullTeacher.includes(q)
      );
    });
  }, [courses, searchQuery]);

  const fetchCourseDetailData = useCallback(async (course: CourseOverview) => {
    setDetailLoading(true);
    setDetailError(null);
    setDetailSuccess(null);
    setEditTeacherId(course.teacher_id || '');
    setSelectedToEnroll(new Set());

    try {
      const supabase = getSupabaseClient();

      const { data: enrData, error: enrErr } = await supabase
        .from('enrollments')
        .select('id, student_id, enrolled_at, status')
        .eq('section_id', course.section_id)
        .eq('status', 'activa')
        .order('enrolled_at', { ascending: false });

      if (enrErr) throw enrErr;

      const studentIds = (enrData || []).map((e) => e.student_id);
      const profilesMap = await fetchProfilesMapByIds(studentIds);

      const resolvedEnrolled: EnrolledStudentRecord[] = (enrData || []).map((e) => ({
        id: e.id,
        student_id: e.student_id,
        enrolled_at: e.enrolled_at,
        profile: profilesMap[e.student_id],
      }));
      setEnrolledStudents(resolvedEnrolled);

      const { data: allStudents, error: stdsErr } = await supabase
        .from('profiles')
        .select('id, code, first_names, last_names')
        .eq('role', 'alumno')
        .eq('active', true)
        .order('last_names', { ascending: true });

      if (stdsErr) throw stdsErr;

      const enrolledIdsSet = new Set(studentIds);
      const available = (allStudents || []).filter((s) => !enrolledIdsSet.has(s.id));
      setAvailableStudents(available);
    } catch (err: unknown) {
      setDetailError(translateSupabaseError(err));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      fetchCourseDetailData(selectedCourse);
    }
  }, [selectedCourse?.section_id]);

  const handleOpenNewCourseModal = () => {
    setNewCode('');
    setNewName('');
    setNewTeacherId('');
    setNewCourseError(null);
    setIsNewCourseModalOpen(true);
  };

  const handleCreateCourseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewCourseError(null);

    const code = newCode.trim().toUpperCase();
    const name = newName.trim();
    const teacher = newTeacherId || null;

    if (!code || !name) {
      setNewCourseError('Debes ingresar el código y el nombre del curso.');
      return;
    }

    setNewCourseLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('create_course_simple', {
        p_code: code,
        p_name: name,
        p_teacher: teacher,
      });

      if (rpcErr) throw rpcErr;

      const codeResponse = typeof res === 'string' ? res : res?.code;

      if (codeResponse === 'success') {
        setIsNewCourseModalOpen(false);
        setActionSuccess(`Curso "${name}" (${code}) creado exitosamente.`);
        await fetchCourses();
      } else if (codeResponse === 'unauthorized') {
        setNewCourseError('No tienes permisos de administrador.');
      } else if (codeResponse === 'missing_data') {
        setNewCourseError('Debes ingresar el código y el nombre del curso.');
      } else if (codeResponse === 'invalid_teacher') {
        setNewCourseError('El profesor seleccionado no es válido o no está activo.');
      } else if (codeResponse === 'duplicate_code') {
        setNewCourseError('Ya existe un curso con ese código.');
      } else {
        setNewCourseError(typeof res === 'string' ? res : res?.message || 'Error al crear el curso.');
      }
    } catch (err: unknown) {
      setNewCourseError(translateSupabaseError(err));
    } finally {
      setNewCourseLoading(false);
    }
  };

  const handleSaveTeacher = async () => {
    if (!selectedCourse) return;
    setSaveTeacherLoading(true);
    setDetailError(null);
    setDetailSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const teacherUuid = editTeacherId ? editTeacherId : null;

      const { data: res, error: rpcErr } = await supabase.rpc('set_course_teacher', {
        p_section: selectedCourse.section_id,
        p_teacher: teacherUuid,
      });

      if (rpcErr) throw rpcErr;

      const codeResponse = typeof res === 'string' ? res : res?.code;

      if (codeResponse === 'success') {
        setDetailSuccess('Profesor actualizado correctamente.');

        await fetchCourses();
      } else if (codeResponse === 'unauthorized') {
        setDetailError('No tienes permisos de administrador.');
      } else if (codeResponse === 'invalid_teacher') {
        setDetailError('El profesor seleccionado no es válido o no está activo.');
      } else if (codeResponse === 'invalid_section') {
        setDetailError('Sección no válida.');
      } else {
        setDetailError(typeof res === 'string' ? res : res?.message || 'Error al asignar profesor.');
      }
    } catch (err: unknown) {
      setDetailError(translateSupabaseError(err));
    } finally {
      setSaveTeacherLoading(false);
    }
  };

  const handleUnenrollStudentConfirm = async () => {
    if (!selectedCourse || !unenrollStudentTarget) return;
    setUnenrollLoading(true);
    setDetailError(null);
    setDetailSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('unenroll_student', {
        p_section: selectedCourse.section_id,
        p_student: unenrollStudentTarget.student_id,
      });

      if (rpcErr) throw rpcErr;

      const codeResponse = typeof res === 'string' ? res : res?.code;

      if (codeResponse === 'success') {
        setDetailSuccess('Alumno retirado de la sección.');
        setUnenrollStudentTarget(null);
        await fetchCourseDetailData(selectedCourse);
        await fetchCourses();
      } else if (codeResponse === 'unauthorized') {
        setDetailError('No tienes permisos de administrador.');
      } else if (codeResponse === 'invalid_enrollment') {
        setDetailError('Matrícula no encontrada o ya retirada.');
      } else {
        setDetailError(typeof res === 'string' ? res : res?.message || 'Error al retirar alumno.');
      }
    } catch (err: unknown) {
      setDetailError(translateSupabaseError(err));
    } finally {
      setUnenrollLoading(false);
    }
  };

  const handleEnrollSelected = async () => {
    if (!selectedCourse || selectedToEnroll.size === 0) return;
    setEnrollLoading(true);
    setDetailError(null);
    setDetailSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const studentsArray = Array.from(selectedToEnroll);

      const { data: res, error: rpcErr } = await supabase.rpc('enroll_students', {
        p_section: selectedCourse.section_id,
        p_students: studentsArray,
        p_all: false,
      });

      if (rpcErr) throw rpcErr;

      const codeResponse = typeof res === 'string' ? res : res?.code;

      if (codeResponse === 'success') {
        setDetailSuccess(`${studentsArray.length} alumno(s) matriculado(s) exitosamente.`);
        setSelectedToEnroll(new Set());
        await fetchCourseDetailData(selectedCourse);
        await fetchCourses();
      } else if (codeResponse === 'unauthorized') {
        setDetailError('No tienes permisos de administrador.');
      } else if (codeResponse === 'invalid_section') {
        setDetailError('Sección no válida.');
      } else if (codeResponse === 'no_students') {
        setDetailError('No hay alumnos para matricular.');
      } else {
        setDetailError(typeof res === 'string' ? res : res?.message || 'Error al matricular alumnos.');
      }
    } catch (err: unknown) {
      setDetailError(translateSupabaseError(err));
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleEnrollAll = async () => {
    if (!selectedCourse) return;
    setEnrollLoading(true);
    setDetailError(null);
    setDetailSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { data: res, error: rpcErr } = await supabase.rpc('enroll_students', {
        p_section: selectedCourse.section_id,
        p_students: [],
        p_all: true,
      });

      if (rpcErr) throw rpcErr;

      const codeResponse = typeof res === 'string' ? res : res?.code;

      if (codeResponse === 'success') {
        setDetailSuccess('Todos los alumnos activos fueron matriculados exitosamente.');
        setConfirmEnrollAllOpen(false);
        setSelectedToEnroll(new Set());
        await fetchCourseDetailData(selectedCourse);
        await fetchCourses();
      } else if (codeResponse === 'unauthorized') {
        setDetailError('No tienes permisos de administrador.');
      } else if (codeResponse === 'invalid_section') {
        setDetailError('Sección no válida.');
      } else if (codeResponse === 'no_students') {
        setDetailError('No hay alumnos activos para matricular.');
      } else {
        setDetailError(typeof res === 'string' ? res : res?.message || 'Error al matricular alumnos.');
      }
    } catch (err: unknown) {
      setDetailError(translateSupabaseError(err));
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleArchiveCourseConfirm = async () => {
    if (!selectedCourse) return;
    setArchiveLoading(true);
    setDetailError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: archErr } = await supabase
        .from('courses')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', selectedCourse.course_id);

      if (archErr) throw archErr;

      setIsArchiveModalOpen(false);
      setActionSuccess(`El curso "${selectedCourse.name}" fue archivado exitosamente.`);
      setSelectedCourse(null);
      setCourseTab('resumen');
      await fetchCourses();
    } catch (err: unknown) {
      setDetailError(translateSupabaseError(err));
    } finally {
      setArchiveLoading(false);
    }
  };

  const filteredAvailableStudents = useMemo(() => {
    const q = enrollSearch.trim().toLowerCase();
    if (!q) return availableStudents;
    return availableStudents.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        `${s.first_names} ${s.last_names}`.toLowerCase().includes(q)
    );
  }, [availableStudents, enrollSearch]);

  const toggleSelectStudent = (id: string) => {
    setSelectedToEnroll((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAllVisible = () => {
    const allVisibleIds = filteredAvailableStudents.map((s) => s.id);
    const allSelected = allVisibleIds.every((id) => selectedToEnroll.has(id));

    setSelectedToEnroll((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        allVisibleIds.forEach((id) => next.delete(id));
      } else {
        allVisibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  if (selectedCourse) {
    const teacherFullName = selectedCourse.teacher_id
      ? `${selectedCourse.teacher_first_names || ''} ${selectedCourse.teacher_last_names || ''}`.trim()
      : null;

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

        <div className="ucv-card rounded-2xl overflow-hidden">
          <div className="h-1 ucv-topbar-split w-full" />
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <IconActionButton
                  icon={ArrowLeft}
                  label="Volver a Cursos"
                  tooltip="Volver al listado de cursos"
                  variant="neutral"
                  size="md"
                  onClick={() => {
                    setSelectedCourse(null);
                    setCourseTab('resumen');
                    setActionSuccess(null);
                  }}
                  className="mt-0.5"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold px-2.5 py-0.5 rounded-md bg-blue-50/90 border border-blue-200/85 text-[#154A8A]">
                      {selectedCourse.code}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Sección {selectedCourse.section_name}
                    </span>
                  </div>
                  <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] mt-1 tracking-[-0.02em]">
                    {selectedCourse.name}
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ID de sección: <span className="font-mono text-slate-700">{selectedCourse.section_id}</span>
                  </p>
                </div>
              </div>

              <ActionButton
                icon={Archive}
                variant="delete"
                size="sm"
                onClick={() => setIsArchiveModalOpen(true)}
                className="self-start sm:self-auto"
              >
                Archivar curso
              </ActionButton>
            </div>

            {detailSuccess && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2 ucv-slide-down">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.85} />
                <span>{detailSuccess}</span>
              </div>
            )}
            {detailError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs font-semibold flex items-center gap-2 ucv-slide-down">
                <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0" strokeWidth={1.85} />
                <span>{detailError}</span>
              </div>
            )}

            <div className="mt-5 border-t border-slate-100 pt-3.5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setCourseTab('resumen')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-150 active:scale-[0.985] cursor-pointer ${
                  courseTab === 'resumen'
                    ? 'bg-[#0B2A5B] text-white shadow-xs border-b-2 border-[#C8102E]'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" strokeWidth={1.85} />
                <span>1. Matrícula y docente</span>
              </button>

              <button
                type="button"
                onClick={() => setCourseTab('horario')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-150 active:scale-[0.985] cursor-pointer ${
                  courseTab === 'horario'
                    ? 'bg-[#0B2A5B] text-white shadow-xs border-b-2 border-[#C8102E]'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100'
                }`}
              >
                <Clock className="w-4 h-4 shrink-0" strokeWidth={1.85} />
                <span>2. Horario</span>
              </button>

              <button
                type="button"
                onClick={() => setCourseTab('sesiones')}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-all duration-150 active:scale-[0.985] cursor-pointer ${
                  courseTab === 'sesiones'
                    ? 'bg-[#0B2A5B] text-white shadow-xs border-b-2 border-[#C8102E]'
                    : 'text-slate-600 hover:text-[#0B2A5B] hover:bg-slate-100'
                }`}
              >
                <Calendar className="w-4 h-4 shrink-0" strokeWidth={1.85} />
                <span>3. Sesiones</span>
              </button>
            </div>
          </div>
        </div>

        {courseTab === 'resumen' && (
          <>
        <div className="ucv-card rounded-2xl p-5">
          <div className="flex items-center gap-2.5 mb-3">
            <SectionIconBadge icon={GraduationCap} variant="blue" size="sm" />
            <h2 className="text-[11px] font-bold text-[#0B2A5B] uppercase tracking-[0.06em]">
              Docente Asignado
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                Profesor actual
              </span>
              {teacherFullName ? (
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-sm">{teacherFullName}</span>
                </div>
              ) : (
                <span className="inline-block px-2.5 py-1 text-xs font-bold rounded-md bg-slate-200 text-slate-600">
                  Sin asignar
                </span>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <select
                value={editTeacherId}
                onChange={(e) => setEditTeacherId(e.target.value)}
                className="flex-1 px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
              >
                <option value="">-- Sin asignar (Desasignar) --</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.last_names}, {t.first_names} ({t.code})
                  </option>
                ))}
              </select>

              <ActionButton
                icon={CheckCircle2}
                variant="primary"
                size="sm"
                loading={saveTeacherLoading}
                onClick={handleSaveTeacher}
              >
                Guardar profesor
              </ActionButton>
            </div>
          </div>
        </div>

        <div className="ucv-card rounded-2xl p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <SectionIconBadge icon={UserCheck} variant="red" size="sm" />
              <h2 className="text-[11px] font-bold text-[#0B2A5B] uppercase tracking-[0.06em]">
                Alumnos Matriculados ({enrolledStudents.length})
              </h2>
            </div>
            <ActionButton
              icon={RefreshCw}
              variant="view"
              size="xs"
              spinningIcon={detailLoading}
              disabled={detailLoading}
              onClick={() => fetchCourseDetailData(selectedCourse)}
            >
              Actualizar lista
            </ActionButton>
          </div>

          {detailLoading ? (
            <div className="py-8 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="w-6 h-6 animate-spin text-[#1F5FA8] mb-2" strokeWidth={1.9} />
              <span className="text-xs">Cargando matriculados...</span>
            </div>
          ) : enrolledStudents.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" strokeWidth={1.8} />
              <p className="text-xs font-semibold text-slate-600">No hay alumnos matriculados en esta sección</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Utiliza la sección inferior para matricular estudiantes</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Código</th>
                    <th className="py-2.5 px-3">Estudiante</th>
                    <th className="py-2.5 px-3">Fecha de Matrícula</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {enrolledStudents.map((enr) => (
                    <tr key={enr.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {enr.profile?.code || '--'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {enr.profile ? `${enr.profile.last_names}, ${enr.profile.first_names}` : 'Estudiante sin perfil'}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                        {enr.enrolled_at ? (
                          <>
                            {formatDisplayDate(enr.enrolled_at.slice(0, 10))} {formatLimaTime(enr.enrolled_at)}
                          </>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <IconActionButton
                          icon={UserMinus}
                          label="Retirar alumno"
                          tooltip="Retirar de la sección"
                          variant="delete"
                          size="sm"
                          onClick={() => setUnenrollStudentTarget(enr)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="ucv-card rounded-2xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <SectionIconBadge icon={Users} variant="navy" size="sm" />
              <h2 className="text-[11px] font-bold text-[#0B2A5B] uppercase tracking-[0.06em]">
                Matricular Alumnos
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <ActionButton
                icon={UserCheck}
                variant="primary"
                size="sm"
                loading={enrollLoading}
                disabled={selectedToEnroll.size === 0}
                onClick={handleEnrollSelected}
              >
                Matricular seleccionados ({selectedToEnroll.size})
              </ActionButton>

              <ActionButton
                icon={Users}
                variant="secondary"
                size="sm"
                disabled={availableStudents.length === 0 || enrollLoading}
                onClick={() => setConfirmEnrollAllOpen(true)}
              >
                Matricular a todos los alumnos ({availableStudents.length})
              </ActionButton>
            </div>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={enrollSearch}
              onChange={(e) => setEnrollSearch(e.target.value)}
              placeholder="Buscar alumno por código o apellidos..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
            />
          </div>

          {filteredAvailableStudents.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">
              {availableStudents.length === 0
                ? 'Todos los alumnos activos ya están matriculados en esta sección.'
                : 'No se encontraron alumnos con ese criterio.'}
            </p>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-slate-50 px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-xs">
                <button
                  onClick={toggleSelectAllVisible}
                  className="flex items-center gap-2 font-bold text-slate-700 hover:text-[#1F5FA8] cursor-pointer"
                >
                  {filteredAvailableStudents.every((s) => selectedToEnroll.has(s.id)) ? (
                    <CheckSquare className="w-4 h-4 text-[#1F5FA8]" />
                  ) : (
                    <Square className="w-4 h-4 text-slate-400" />
                  )}
                  <span>Seleccionar visibles ({filteredAvailableStudents.length})</span>
                </button>
                <span className="text-slate-400 text-[11px]">
                  {selectedToEnroll.size} marcado(s) en total
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {filteredAvailableStudents.map((s) => {
                  const isChecked = selectedToEnroll.has(s.id);
                  return (
                    <div
                      key={s.id}
                      onClick={() => toggleSelectStudent(s.id)}
                      className={`px-3.5 py-2 text-xs flex items-center justify-between hover:bg-blue-50/50 cursor-pointer transition-colors ${
                        isChecked ? 'bg-blue-50/70 font-semibold text-[#0B2A5B]' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-[#1F5FA8]" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                        <span className="font-mono text-slate-500 font-bold">{s.code}</span>
                        <span>{s.last_names}, {s.first_names}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
          </>
        )}

        {courseTab === 'horario' && (
          <CourseScheduleSection sectionId={selectedCourse.section_id} />
        )}

        {courseTab === 'sesiones' && (
          <CourseSessionsSection sectionId={selectedCourse.section_id} />
        )}

        {unenrollStudentTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="ucv-card ucv-scale-in rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
              <SectionIconBadge icon={UserMinus} variant="red" size="lg" className="mx-auto" />
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">¿Retirar alumno?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Se dará de baja la matrícula de{' '}
                  <strong className="text-slate-800">
                    {unenrollStudentTarget.profile
                      ? `${unenrollStudentTarget.profile.first_names} ${unenrollStudentTarget.profile.last_names}`
                      : 'este alumno'}
                  </strong>{' '}
                  en esta sección.
                </p>
              </div>
              <div className="flex gap-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setUnenrollStudentTarget(null)}
                  disabled={unenrollLoading}
                  className="flex-1"
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  icon={UserMinus}
                  variant="brand"
                  size="sm"
                  loading={unenrollLoading}
                  onClick={handleUnenrollStudentConfirm}
                  className="flex-1"
                >
                  Sí, retirar
                </ActionButton>
              </div>
            </div>
          </div>
        )}

        {confirmEnrollAllOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="ucv-card ucv-scale-in rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
              <SectionIconBadge icon={Users} variant="blue" size="lg" className="mx-auto" />
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">¿Matricular a todos?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Se matricularán todos los {availableStudents.length} alumnos activos del sistema en la sección{' '}
                  <strong>{selectedCourse.section_name}</strong>.
                </p>
              </div>
              <div className="flex gap-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setConfirmEnrollAllOpen(false)}
                  disabled={enrollLoading}
                  className="flex-1"
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  icon={UserCheck}
                  variant="primary"
                  size="sm"
                  loading={enrollLoading}
                  onClick={handleEnrollAll}
                  className="flex-1"
                >
                  Confirmar matrícula
                </ActionButton>
              </div>
            </div>
          </div>
        )}

        {isArchiveModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="ucv-card ucv-scale-in rounded-2xl max-w-sm w-full p-6 shadow-xl space-y-4">
              <SectionIconBadge icon={AlertTriangle} variant="amber" size="lg" className="mx-auto" />
              <div className="text-center">
                <h3 className="text-base font-bold text-slate-900">¿Archivar curso?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  El curso <strong className="text-slate-800">{selectedCourse.name}</strong> ya no aparecerá en la lista activa.
                </p>
              </div>
              <div className="flex gap-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsArchiveModalOpen(false)}
                  disabled={archiveLoading}
                  className="flex-1"
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  icon={Archive}
                  variant="brand"
                  size="sm"
                  loading={archiveLoading}
                  onClick={handleArchiveCourseConfirm}
                  className="flex-1"
                >
                  Sí, archivar
                </ActionButton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SectionIconBadge icon={BookOpen} variant="red" size="md" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] tracking-[-0.02em]">
              Gestión de Cursos
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Vista general de cursos, asignación docente y matrículas por sección.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <ActionButton
            icon={RefreshCw}
            variant="secondary"
            size="sm"
            spinningIcon={loading}
            disabled={loading}
            onClick={fetchCourses}
          >
            Actualizar
          </ActionButton>

          <ActionButton
            icon={Plus}
            variant="primary"
            size="sm"
            onClick={handleOpenNewCourseModal}
          >
            Nuevo curso
          </ActionButton>
        </div>
      </div>

      {actionSuccess && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2.5 ucv-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" strokeWidth={1.85} />
            <span className="font-semibold">{actionSuccess}</span>
          </div>
          <IconActionButton
            icon={X}
            label="Cerrar aviso"
            variant="confirm"
            size="xs"
            onClick={() => setActionSuccess(null)}
          />
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 ucv-slide-down">
          <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0" strokeWidth={1.85} />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.85} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por código de curso, nombre de asignatura o profesor..."
          className="w-full h-10 pl-10 pr-4 bg-white border border-slate-200/90 rounded-xl text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/20 focus:border-[#1F5FA8] shadow-2xs transition-all"
        />
      </div>

      <div className="ucv-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin text-[#1F5FA8] mb-3" strokeWidth={1.85} />
            <span className="text-xs font-semibold">Cargando cursos desde Supabase...</span>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-16 text-center text-slate-500">
            <SectionIconBadge icon={BookOpen} variant="neutral" size="lg" className="mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {courses.length === 0 ? 'No hay cursos registrados' : 'No se encontraron cursos coincidentes'}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {courses.length === 0
                ? 'Empieza creando el primer curso con su código, nombre y profesor asignado.'
                : 'Intenta con otro término de búsqueda.'}
            </p>
            {courses.length === 0 && (
              <div className="mt-4">
                <ActionButton
                  icon={Plus}
                  variant="primary"
                  size="sm"
                  onClick={handleOpenNewCourseModal}
                >
                  Crear primer curso
                </ActionButton>
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/90 text-slate-500 font-semibold uppercase tracking-[0.06em] text-[11px] border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Código</th>
                  <th className="py-3.5 px-4">Nombre del Curso</th>
                  <th className="py-3.5 px-4">Docente</th>
                  <th className="py-3.5 px-4 text-center">Alumnos</th>
                  <th className="py-3.5 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCourses.map((c) => {
                  const teacherFullName = c.teacher_id
                    ? `${c.teacher_first_names || ''} ${c.teacher_last_names || ''}`.trim()
                    : null;

                  return (
                    <tr
                      key={c.section_id}
                      onClick={() => {
                        setSelectedCourse(c);
                        setCourseTab('resumen');
                      }}
                      className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-slate-100 text-[#0B2A5B] border border-slate-200">
                          {c.code}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 group-hover:text-[#1F5FA8] transition-colors">
                          {c.name}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Sección: {c.section_name}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {teacherFullName ? (
                          <div className="flex items-center gap-1.5">
                            <GraduationCap className="w-4 h-4 text-slate-400" strokeWidth={1.85} />
                            <span className="font-medium text-slate-800">{teacherFullName}</span>
                          </div>
                        ) : (
                          <span className="inline-block px-2 py-0.5 text-[10px] font-bold rounded-md bg-slate-100 text-slate-500 border border-slate-200">
                            Sin asignar
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-flex items-center gap-1 font-mono font-bold text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-[#1F5FA8] border border-blue-100">
                          <Users className="w-3.5 h-3.5" strokeWidth={1.9} />
                          <span>{c.students ?? 0}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <ActionButton
                          iconRight={ChevronRight}
                          variant="view"
                          size="xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCourse(c);
                            setCourseTab('resumen');
                          }}
                        >
                          Detalle
                        </ActionButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isNewCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="ucv-card ucv-scale-in rounded-2xl max-w-md w-full shadow-2xl overflow-hidden">
            <div className="ucv-header-split text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center">
                  <BookOpen className="w-[18px] h-[18px] text-white" strokeWidth={1.9} />
                </div>
                <h3 className="text-sm font-extrabold">Nuevo Curso</h3>
              </div>
              <IconActionButton
                icon={X}
                label="Cerrar modal"
                variant="ghost-light"
                size="sm"
                onClick={() => setIsNewCourseModalOpen(false)}
              />
            </div>

            <form onSubmit={handleCreateCourseSubmit} className="p-5 space-y-4">
              {newCourseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.9} />
                  <span>{newCourseError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Código del Curso *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. IS501"
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-800 uppercase focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
                <p className="text-[11px] text-slate-400 mt-1">Identificador único del curso en el catálogo.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nombre del Curso *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej. Ingeniería de Software"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Docente a Cargo (Opcional)
                </label>
                <select
                  value={newTeacherId}
                  onChange={(e) => setNewTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                >
                  <option value="">-- Sin asignar --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.last_names}, {t.first_names} ({t.code})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">
                  Puedes asignarle un profesor activo ahora o más adelante.
                </p>
              </div>

              <div className="pt-2 flex gap-2">
                <ActionButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsNewCourseModalOpen(false)}
                  disabled={newCourseLoading}
                  className="flex-1"
                >
                  Cancelar
                </ActionButton>
                <ActionButton
                  type="submit"
                  icon={Plus}
                  variant="primary"
                  size="sm"
                  loading={newCourseLoading}
                  className="flex-1"
                >
                  Crear curso
                </ActionButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
