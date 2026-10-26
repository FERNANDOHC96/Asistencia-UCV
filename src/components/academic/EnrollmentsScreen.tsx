import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { UserCheck, UserX, Search, Plus, RefreshCw, AlertCircle, CheckCircle2, Loader2, Users, AlertTriangle, ChevronRight, Check } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { Period, Course, Section, Profile, Enrollment, EnrollmentStatus } from '../../types';
import { fetchProfilesMapByIds } from '../../lib/profileHelper';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

interface EnrollmentExtended extends Enrollment {
  student?: Profile;
}

interface SectionOption extends Section {
  offering?: {
    id: string;
    course_id: string;
    period_id: string;
    course?: Course;
    period?: Period;
  };
}

export const EnrollmentsScreen: React.FC = () => {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [allStudents, setAllStudents] = useState<Profile[]>([]);

  // Selection
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');

  // Enrollments in current section
  const [enrollments, setEnrollments] = useState<EnrollmentExtended[]>([]);
  const [loadingEnrollments, setLoadingEnrollments] = useState<boolean>(false);
  const [generalLoading, setGeneralLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Multi-select students to enroll
  const [studentSearch, setStudentSearch] = useState<string>('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [enrollLoading, setEnrollLoading] = useState<boolean>(false);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [enrollSuccess, setEnrollSuccess] = useState<string | null>(null);

  // Withdraw modal
  const [withdrawingEnrollment, setWithdrawingEnrollment] = useState<EnrollmentExtended | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState<boolean>(false);

  // Initial fetch for selectors and students
  const fetchInitialData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setGeneralLoading(false);
      return;
    }

    setGeneralLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // 1. Periods (non-archived)
      const { data: pData, error: pErr } = await supabase
        .from('periods')
        .select('id, name, starts_on, ends_on, status')
        .is('archived_at', null)
        .order('starts_on', { ascending: false });
      if (pErr) throw pErr;
      setPeriods(pData || []);
      if (pData && pData.length > 0 && !selectedPeriodId) {
        setSelectedPeriodId(pData[0].id);
      }

      // 2. Courses (non-archived)
      const { data: cData, error: cErr } = await supabase
        .from('courses')
        .select('id, code, name, credits')
        .is('archived_at', null)
        .order('name', { ascending: true });
      if (cErr) throw cErr;
      setCourses(cData || []);
      if (cData && cData.length > 0 && !selectedCourseId) {
        setSelectedCourseId(cData[0].id);
      }

      // 3. Sections with offerings (non-archived)
      const { data: sData, error: sErr } = await supabase
        .from('sections')
        .select(`
          id,
          offering_id,
          name,
          capacity,
          archived_at,
          offering:course_offerings (
            id,
            course_id,
            period_id,
            course:courses (id, code, name, archived_at),
            period:periods (id, name, archived_at)
          )
        `)
        .is('archived_at', null)
        .order('name', { ascending: true });
      if (sErr) throw sErr;
      const normalizedSections: SectionOption[] = (sData || [])
        .filter((sec: any) => {
          const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
          const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
          const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;
          if (!crs || crs.archived_at) return false;
          if (!per || per.archived_at) return false;
          return true;
        })
        .map((sec: any) => {
          const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
          const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
          const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;
          return {
            ...sec,
            offering: off
              ? {
                  ...off,
                  course: crs,
                  period: per,
                }
              : undefined,
          };
        });
      setSections(normalizedSections);

      // 4. Students
      const { data: stuData, error: stuErr } = await supabase
        .from('profiles')
        .select('id, code, first_names, last_names, role, active')
        .eq('role', 'alumno')
        .eq('active', true)
        .order('last_names', { ascending: true });
      if (stuErr) throw stuErr;
      setAllStudents((stuData as Profile[]) || []);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'enrollments'));
    } finally {
      setGeneralLoading(false);
    }
  }, [selectedPeriodId, selectedCourseId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Filter available sections based on selected Period and Course
  const availableSections = useMemo(() => {
    return sections.filter((s) => {
      const pMatch = !selectedPeriodId || s.offering?.period_id === selectedPeriodId;
      const cMatch = !selectedCourseId || s.offering?.course_id === selectedCourseId;
      return pMatch && cMatch;
    });
  }, [sections, selectedPeriodId, selectedCourseId]);

  // Automatically select the first available section if current selection is invalid
  useEffect(() => {
    if (availableSections.length > 0) {
      if (!selectedSectionId || !availableSections.some((s) => s.id === selectedSectionId)) {
        setSelectedSectionId(availableSections[0].id);
      }
    } else {
      setSelectedSectionId('');
      setEnrollments([]);
    }
  }, [availableSections, selectedSectionId]);

  // Current active section object
  const currentSection = useMemo(() => {
    return sections.find((s) => s.id === selectedSectionId) || null;
  }, [sections, selectedSectionId]);

  // Fetch enrollments for the selected section
  const fetchEnrollments = useCallback(async () => {
    if (!selectedSectionId || !isSupabaseConfigured()) {
      setEnrollments([]);
      return;
    }

    setLoadingEnrollments(true);
    setEnrollError(null);

    try {
      const supabase = getSupabaseClient();
      // 1. Consulta la tabla principal enrollments (sin select anidado a profiles)
      const { data: enrollData, error: eErr } = await supabase
        .from('enrollments')
        .select('id, student_id, section_id, offering_id, status, enrolled_at')
        .eq('section_id', selectedSectionId)
        .order('status', { ascending: true });

      if (eErr) {
        setEnrollError(translateSupabaseError(eErr, 'enrollments'));
        setEnrollments([]);
        return;
      }

      // 2. Reúne los student_id y consulta profiles con .in('id', [...])
      const studentIds = (enrollData || []).map((row: any) => row.student_id);
      const studentProfilesMap = await fetchProfilesMapByIds(studentIds);

      // 3. Une ambos resultados en el código de la web
      const joinedEnrollments: EnrollmentExtended[] = (enrollData || []).map((row: any) => ({
        ...row,
        student: studentProfilesMap[row.student_id]
          ? ({
              ...studentProfilesMap[row.student_id],
              role: 'alumno',
              active: true,
            } as Profile)
          : undefined,
      }));

      setEnrollments(joinedEnrollments);
    } catch (err: unknown) {
      setEnrollError(err instanceof Error ? err.message : 'Error al consultar matrículas.');
      setEnrollments([]);
    } finally {
      setLoadingEnrollments(false);
    }
  }, [selectedSectionId]);

  useEffect(() => {
    if (selectedSectionId) {
      fetchEnrollments();
      setSelectedStudentIds([]);
    }
  }, [selectedSectionId, fetchEnrollments]);

  // Active students in current section
  const activeEnrollmentsCount = useMemo(() => {
    return enrollments.filter((e) => e.status === 'activa').length;
  }, [enrollments]);

  const isSectionFull = useMemo(() => {
    if (!currentSection?.capacity) return false;
    return activeEnrollmentsCount >= currentSection.capacity;
  }, [currentSection, activeEnrollmentsCount]);

  // Available students to enroll (exclude currently actively enrolled students in this section)
  const candidateStudents = useMemo(() => {
    const activelyEnrolledIds = new Set(
      enrollments.filter((e) => e.status === 'activa').map((e) => e.student_id)
    );

    const q = studentSearch.trim().toLowerCase();
    return allStudents.filter((stu) => {
      if (activelyEnrolledIds.has(stu.id)) return false;
      if (!q) return true;
      return (
        stu.code.toLowerCase().includes(q) ||
        stu.first_names.toLowerCase().includes(q) ||
        stu.last_names.toLowerCase().includes(q) ||
        `${stu.first_names} ${stu.last_names}`.toLowerCase().includes(q)
      );
    });
  }, [allStudents, enrollments, studentSearch]);

  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const handleSelectAllCandidates = () => {
    if (selectedStudentIds.length === candidateStudents.length) {
      setSelectedStudentIds([]);
    } else {
      setSelectedStudentIds(candidateStudents.map((s) => s.id));
    }
  };

  // Perform Enrollments
  const handleEnrollSelected = async () => {
    if (!selectedSectionId || selectedStudentIds.length === 0) return;

    setEnrollLoading(true);
    setEnrollError(null);
    setEnrollSuccess(null);

    const supabase = getSupabaseClient();
    let successCount = 0;
    const errors: string[] = [];

    for (const studentId of selectedStudentIds) {
      try {
        // Checking if student has a previous enrollment in this section (e.g. was 'retirada')
        const existing = enrollments.find((e) => e.student_id === studentId);

        if (existing) {
          const { error: updErr } = await supabase
            .from('enrollments')
            .update({ status: 'activa' })
            .eq('id', existing.id);

          if (updErr) {
            errors.push(translateSupabaseError(updErr, 'enrollments'));
          } else {
            successCount++;
          }
        } else {
          // IMPORTANT: DO NOT SEND offering_id (calculated by database trigger/rules)
          const { error: insErr } = await supabase
            .from('enrollments')
            .insert({
              student_id: studentId,
              section_id: selectedSectionId,
              status: 'activa',
            });

          if (insErr) {
            errors.push(translateSupabaseError(insErr, 'enrollments'));
          } else {
            successCount++;
          }
        }
      } catch (err: unknown) {
        errors.push(err instanceof Error ? err.message : 'Error inesperado.');
      }
    }

    if (errors.length > 0) {
      setEnrollError(errors[0]); // Muestra el mensaje traducido o real
    }
    if (successCount > 0) {
      setEnrollSuccess(`Se matricularon ${successCount} alumno(s) exitosamente.`);
      setSelectedStudentIds([]);
    }

    setEnrollLoading(false);
    fetchEnrollments();
  };

  // Withdraw student (status = 'retirada', no borrar)
  const handleWithdrawStudent = async () => {
    if (!withdrawingEnrollment) return;
    setWithdrawLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error: updErr } = await supabase
        .from('enrollments')
        .update({ status: 'retirada' })
        .eq('id', withdrawingEnrollment.id);

      if (updErr) {
        setError(translateSupabaseError(updErr, 'enrollments'));
      } else {
        fetchEnrollments();
      }
      setWithdrawingEnrollment(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al retirar matrícula.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  // Reactivate student enrollment
  const handleReactivateStudent = async (enrollmentId: string) => {
    try {
      const supabase = getSupabaseClient();
      const { error: updErr } = await supabase
        .from('enrollments')
        .update({ status: 'activa' })
        .eq('id', enrollmentId);

      if (updErr) {
        setError(translateSupabaseError(updErr, 'enrollments'));
      } else {
        fetchEnrollments();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al reactivar matrícula.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <UserCheck className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Gestión de Matrículas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Inscripción y control de alumnos por periodo, asignatura y sección
          </p>
        </div>

        <button
          onClick={() => {
            fetchInitialData();
            fetchEnrollments();
          }}
          disabled={generalLoading || loadingEnrollments}
          className="self-start sm:self-auto px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:text-[#1F5FA8] hover:bg-slate-50 rounded-lg text-xs font-semibold shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingEnrollments ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar datos</span>
        </button>
      </div>

      {/* Selectors Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">
          1. Selecciona la Sección Académica
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Period selector */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Periodo:</label>
            <select
              value={selectedPeriodId}
              onChange={(e) => setSelectedPeriodId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white font-mono text-slate-900"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status})
                </option>
              ))}
            </select>
          </div>

          {/* Course selector */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Curso / Asignatura:</label>
            <select
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white text-slate-900 truncate"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Section selector */}
          <div>
            <label className="block text-slate-500 font-medium mb-1">Sección:</label>
            <select
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              disabled={availableSections.length === 0}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] bg-white font-mono text-slate-900 disabled:bg-slate-100"
            >
              {availableSections.length === 0 ? (
                <option value="">No hay secciones creadas</option>
              ) : (
                availableSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    Sección {s.name} {s.capacity ? `(Aforo: ${s.capacity})` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Main Content Area */}
      {!selectedSectionId ? (
        <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-12 text-center">
          <Users className="w-10 h-10 text-slate-400 mx-auto mb-2" />
          <h3 className="text-sm font-bold text-slate-800">Ninguna sección seleccionada</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            Selecciona un periodo, curso y sección para ver los alumnos matriculados y registrar nuevas inscripciones.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left / Enrolled List (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Alumnos Matriculados ({activeEnrollmentsCount}{' '}
                  {currentSection?.capacity ? `/ ${currentSection.capacity}` : ''})
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Lista oficial de alumnos inscritos en la sección {currentSection?.name}
                </p>
              </div>

              {/* Capacity indicator */}
              {currentSection?.capacity && (
                <div>
                  {isSectionFull ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3.5 h-3.5" /> Sección Llena
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">
                      Vacantes disponibles:{' '}
                      <strong className="text-emerald-700">
                        {currentSection.capacity - activeEnrollmentsCount}
                      </strong>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
              {loadingEnrollments ? (
                <div className="py-12 text-center">
                  <Loader2 className="w-6 h-6 text-[#1F5FA8] animate-spin mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Cargando matriculados...</p>
                </div>
              ) : enrollments.length === 0 ? (
                <div className="py-12 px-4 text-center">
                  <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-700">Sin alumnos matriculados</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Utiliza el panel lateral para matricular estudiantes en esta sección.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                      <tr>
                        <th className="px-4 py-3">Código</th>
                        <th className="px-4 py-3">Alumno</th>
                        <th className="px-4 py-3">Fecha de Matrícula</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {enrollments.map((e) => (
                        <tr key={e.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 font-mono font-bold text-[#0B2A5B]">
                            {e.student?.code || '-'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            {e.student?.first_names} {e.student?.last_names}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                            {e.enrolled_at ? new Date(e.enrolled_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3">
                            {e.status === 'activa' ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Activa
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                <UserX className="w-3 h-3 text-amber-700" />
                                Retirada
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {e.status === 'activa' ? (
                              <button
                                onClick={() => setWithdrawingEnrollment(e)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors cursor-pointer"
                              >
                                Retirar
                              </button>
                            ) : (
                              <button
                                onClick={() => handleReactivateStudent(e.id)}
                                className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors cursor-pointer"
                              >
                                Reactivar
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Right / Enroll New Students (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                    2. Matricular Alumnos
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Selecciona uno o varios alumnos registrados
                  </p>
                </div>
              </div>

              {/* Warning if section is full */}
              {isSectionFull && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">
                    <strong>Aviso de Aforo:</strong> La sección ha alcanzado su capacidad máxima ({currentSection?.capacity}). Aún puedes matricular bajo criterio administrativo.
                  </div>
                </div>
              )}

              {/* Warning if batch will exceed capacity */}
              {!isSectionFull &&
                currentSection?.capacity &&
                activeEnrollmentsCount + selectedStudentIds.length > currentSection.capacity && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="leading-relaxed">
                      <strong>Advertencia de capacidad:</strong> Estás por matricular {selectedStudentIds.length} alumnos, lo que superará el aforo fijado ({currentSection.capacity}).
                    </div>
                  </div>
                )}

              {/* Success / Error notification */}
              {enrollError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{enrollError}</div>
                </div>
              )}

              {enrollSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-semibold">{enrollSuccess}</div>
                </div>
              )}

              {/* Search candidate students */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar alumno por código o nombre..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8]"
                />
              </div>

              {/* Quick toggle all */}
              {candidateStudents.length > 0 && (
                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                  <span>
                    Seleccionados: <strong className="text-[#1F5FA8]">{selectedStudentIds.length}</strong>
                  </span>
                  <button
                    onClick={handleSelectAllCandidates}
                    className="text-[#1F5FA8] hover:underline font-semibold"
                  >
                    {selectedStudentIds.length === candidateStudents.length
                      ? 'Deseleccionar todos'
                      : 'Seleccionar todos los visibles'}
                  </button>
                </div>
              )}

              {/* Student Candidate List */}
              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
                {candidateStudents.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    {studentSearch
                      ? 'No hay alumnos que coincidan con la búsqueda.'
                      : 'Todos los alumnos registrados ya se encuentran matriculados.'}
                  </div>
                ) : (
                  candidateStudents.map((s) => {
                    const isSelected = selectedStudentIds.includes(s.id);
                    return (
                      <div
                        key={s.id}
                        onClick={() => handleToggleStudent(s.id)}
                        className={`flex items-center justify-between p-2.5 text-xs cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              isSelected
                                ? 'bg-[#1F5FA8] border-[#1F5FA8] text-white'
                                : 'border-slate-300 bg-white'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900 block leading-tight">
                              {s.first_names} {s.last_names}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              Cód: {s.code}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Submit Enrollment Button */}
              <button
                type="button"
                onClick={handleEnrollSelected}
                disabled={enrollLoading || selectedStudentIds.length === 0}
                className="w-full py-2 px-3 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {enrollLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>
                  Matricular {selectedStudentIds.length > 0 ? `(${selectedStudentIds.length})` : ''} Alumno(s)
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Withdraw confirmation modal */}
      <DeleteConfirmModal
        isOpen={Boolean(withdrawingEnrollment)}
        title="Retirar Matrícula"
        message={`¿Estás seguro de que deseas retirar al alumno "${withdrawingEnrollment?.student?.first_names} ${withdrawingEnrollment?.student?.last_names}" de la sección? Su estado cambiará a 'retirada' (no se eliminará el registro histórico).`}
        loading={withdrawLoading}
        onConfirm={handleWithdrawStudent}
        onCancel={() => setWithdrawingEnrollment(null)}
      />
    </div>
  );
};
