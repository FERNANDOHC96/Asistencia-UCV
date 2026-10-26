import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Layers, Plus, Edit2, Archive, UserCheck, UserMinus, RefreshCw, AlertCircle, Loader2, X, Filter, CheckCircle2 } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { Period, Course, Section, Profile } from '../../types';
import { fetchProfilesMapByIds } from '../../lib/profileHelper';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

interface SectionExtended extends Section {
  offering?: {
    id: string;
    course_id: string;
    period_id: string;
    course?: { id: string; code: string; name: string };
    period?: { id: string; name: string };
  };
  teachers?: {
    id: string;
    teacher_id: string;
    teacher?: { id: string; first_names: string; last_names: string; code: string };
  }[];
  activeEnrollmentsCount?: number;
}

export const SectionsScreen: React.FC = () => {
  const [sections, setSections] = useState<SectionExtended[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [teachersList, setTeachersList] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterPeriodId, setFilterPeriodId] = useState<string>('all');
  const [filterCourseId, setFilterCourseId] = useState<string>('all');

  // Create / Edit modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<SectionExtended | null>(null);
  const [formData, setFormData] = useState({
    period_id: '',
    course_id: '',
    name: '',
    capacity: '' as string | number,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Teacher assignment modal
  const [assignModalSection, setAssignModalSection] = useState<SectionExtended | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);

  // Archive modal
  const [archivingSection, setArchivingSection] = useState<SectionExtended | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);

  // Remove teacher confirmation modal
  const [removingTeacherAssignment, setRemovingTeacherAssignment] = useState<{
    section: SectionExtended;
    assignmentId: string;
    teacherName: string;
  } | null>(null);
  const [removeTeacherLoading, setRemoveTeacherLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // 1. Fetch periods (only non-archived)
      const { data: periodsData, error: pErr } = await supabase
        .from('periods')
        .select('id, name, starts_on, ends_on, status')
        .is('archived_at', null)
        .order('starts_on', { ascending: false });
      if (pErr) throw pErr;
      setPeriods(periodsData || []);

      // 2. Fetch courses (only non-archived)
      const { data: coursesData, error: cErr } = await supabase
        .from('courses')
        .select('id, code, name, credits')
        .is('archived_at', null)
        .order('name', { ascending: true });
      if (cErr) throw cErr;
      setCourses(coursesData || []);

      // 3. Fetch teachers (profiles where role = 'profesor')
      const { data: teachersData, error: tErr } = await supabase
        .from('profiles')
        .select('id, code, first_names, last_names, role, active')
        .eq('role', 'profesor')
        .eq('active', true)
        .order('last_names', { ascending: true });
      if (tErr) throw tErr;
      setTeachersList((teachersData as Profile[]) || []);

      // 4. Fetch sections with offering -> course and period (only non-archived)
      const { data: sectionsData, error: sErr } = await supabase
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

      // 5. Fetch teaching assignments (sin join anidado hacia profiles)
      const { data: assignData, error: aErr } = await supabase
        .from('teaching_assignments')
        .select('id, section_id, teacher_id');
      if (aErr) throw aErr;

      // Reúne los teacher_id y consulta profiles con .in('id', ...)
      const teacherIds = (assignData || []).map((row: any) => row.teacher_id);
      const teacherProfilesMap = await fetchProfilesMapByIds(teacherIds);

      // Une ambos resultados en el código de la web
      const assignmentsBySection: Record<string, SectionExtended['teachers']> = {};
      (assignData || []).forEach((row: any) => {
        if (!assignmentsBySection[row.section_id]) {
          assignmentsBySection[row.section_id] = [];
        }
        assignmentsBySection[row.section_id]!.push({
          id: row.id,
          teacher_id: row.teacher_id,
          teacher: teacherProfilesMap[row.teacher_id],
        });
      });

      // 6. Fetch active enrollments counts
      const { data: enrollData, error: eErr } = await supabase
        .from('enrollments')
        .select('section_id, status')
        .eq('status', 'activa');
      if (eErr) throw eErr;

      const enrollCountsBySection: Record<string, number> = {};
      (enrollData || []).forEach((row: any) => {
        enrollCountsBySection[row.section_id] = (enrollCountsBySection[row.section_id] || 0) + 1;
      });

      // Filter out sections where parent course or period is archived
      const validSectionsData = (sectionsData || []).filter((sec: any) => {
        const off = Array.isArray(sec.offering) ? sec.offering[0] : sec.offering;
        const crs = off && Array.isArray(off.course) ? off.course[0] : off?.course;
        const per = off && Array.isArray(off.period) ? off.period[0] : off?.period;
        if (!crs || crs.archived_at) return false;
        if (!per || per.archived_at) return false;
        return true;
      });

      const combined: SectionExtended[] = validSectionsData.map((sec: any) => ({
        ...sec,
        teachers: assignmentsBySection[sec.id] || [],
        activeEnrollmentsCount: enrollCountsBySection[sec.id] || 0,
      }));

      setSections(combined);
    } catch (err: unknown) {
      setError(translateSupabaseError(err, 'sections'));
      setSections([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filtered sections
  const filteredSections = useMemo(() => {
    return sections.filter((s) => {
      if (filterPeriodId !== 'all' && s.offering?.period_id !== filterPeriodId) {
        return false;
      }
      if (filterCourseId !== 'all' && s.offering?.course_id !== filterCourseId) {
        return false;
      }
      return true;
    });
  }, [sections, filterPeriodId, filterCourseId]);

  const handleOpenCreate = () => {
    setEditingSection(null);
    setFormData({
      period_id: periods[0]?.id || '',
      course_id: courses[0]?.id || '',
      name: '',
      capacity: '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (s: SectionExtended) => {
    setEditingSection(s);
    setFormData({
      period_id: s.offering?.period_id || '',
      course_id: s.offering?.course_id || '',
      name: s.name,
      capacity: s.capacity ?? '',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSaveSection = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const name = formData.name.trim().toUpperCase();
    const periodId = formData.period_id;
    const courseId = formData.course_id;
    const capacityVal = formData.capacity === '' ? null : Number(formData.capacity);

    if (!name) {
      setFormError('El nombre de la sección es obligatorio (ej: A1, 101).');
      return;
    }

    if (!periodId || !courseId) {
      setFormError('Debe seleccionar el periodo y el curso.');
      return;
    }

    if (capacityVal !== null && (isNaN(capacityVal) || capacityVal <= 0)) {
      setFormError('La capacidad debe ser un número entero mayor que cero.');
      return;
    }

    setFormLoading(true);
    try {
      const supabase = getSupabaseClient();

      if (editingSection) {
        // Edit section name and capacity
        const { error: updError } = await supabase
          .from('sections')
          .update({
            name,
            capacity: capacityVal,
          })
          .eq('id', editingSection.id);

        if (updError) {
          setFormError(translateSupabaseError(updError, 'sections'));
          return;
        }
      } else {
        // Create: first ensure offering exists for (course_id, period_id)
        let offeringId: string | null = null;

        const { data: existingOffering, error: offFindErr } = await supabase
          .from('course_offerings')
          .select('id')
          .eq('course_id', courseId)
          .eq('period_id', periodId)
          .maybeSingle();

        if (offFindErr) {
          setFormError(translateSupabaseError(offFindErr, 'sections'));
          return;
        }

        if (existingOffering) {
          offeringId = existingOffering.id;
        } else {
          // Create the course_offerings row automatically as requested
          const { data: newOffering, error: offCreateErr } = await supabase
            .from('course_offerings')
            .insert({
              course_id: courseId,
              period_id: periodId,
            })
            .select('id')
            .single();

          if (offCreateErr) {
            setFormError(translateSupabaseError(offCreateErr, 'sections'));
            return;
          }
          offeringId = newOffering.id;
        }

        // Insert section
        const { error: secInsErr } = await supabase
          .from('sections')
          .insert({
            offering_id: offeringId,
            name,
            capacity: capacityVal,
          });

        if (secInsErr) {
          setFormError(translateSupabaseError(secInsErr, 'sections'));
          return;
        }
      }

      setIsFormOpen(false);
      fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar sección.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchiveSection = async () => {
    if (!archivingSection) return;
    setArchiveLoading(true);
    setArchiveSuccess(null);
    try {
      const supabase = getSupabaseClient();
      const { error: arcError } = await supabase
        .from('sections')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', archivingSection.id);

      if (arcError) {
        setError(translateSupabaseError(arcError, 'sections'));
      } else {
        setArchiveSuccess('Archivado');
        setTimeout(() => setArchiveSuccess(null), 4000);
        fetchData();
      }
      setArchivingSection(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al archivar sección.');
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleOpenAssignTeacher = (s: SectionExtended) => {
    setAssignModalSection(s);
    setSelectedTeacherId(teachersList[0]?.id || '');
    setAssignError(null);
  };

  const handleSaveTeacherAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalSection || !selectedTeacherId) return;

    setAssignLoading(true);
    setAssignError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: insErr } = await supabase
        .from('teaching_assignments')
        .insert({
          section_id: assignModalSection.id,
          teacher_id: selectedTeacherId,
        });

      if (insErr) {
        setAssignError(translateSupabaseError(insErr, 'teaching_assignments'));
        return;
      }

      setAssignModalSection(null);
      fetchData();
    } catch (err: unknown) {
      setAssignError(err instanceof Error ? err.message : 'Error al asignar profesor.');
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveTeacher = async () => {
    if (!removingTeacherAssignment) return;
    setRemoveTeacherLoading(true);

    try {
      const supabase = getSupabaseClient();
      const { error: delErr } = await supabase
        .from('teaching_assignments')
        .delete()
        .eq('id', removingTeacherAssignment.assignmentId);

      if (delErr) {
        setError(translateSupabaseError(delErr, 'teaching_assignments'));
      } else {
        fetchData();
      }
      setRemovingTeacherAssignment(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al quitar profesor.');
    } finally {
      setRemoveTeacherLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Secciones Académicas
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Gestión de secciones, ofertas de cursos, asignación docente y aforos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar secciones"
            aria-label="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            disabled={periods.length === 0 || courses.length === 0}
            className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva sección</span>
          </button>
        </div>
      </div>

      {/* Warnings if no periods or courses exist */}
      {(!loading && (periods.length === 0 || courses.length === 0)) && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <strong>Requisito previo:</strong> Para crear secciones primero necesitas registrar al menos un{' '}
            {periods.length === 0 ? 'Periodo Académico' : ''}
            {periods.length === 0 && courses.length === 0 ? ' y un ' : ''}
            {courses.length === 0 ? 'Curso' : ''} en el sistema.
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-bold text-slate-700">Filtros:</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Periodo:</span>
            <select
              value={filterPeriodId}
              onChange={(e) => setFilterPeriodId(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5FA8] bg-white text-slate-800"
            >
              <option value="all">Todos los periodos</option>
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Curso:</span>
            <select
              value={filterCourseId}
              onChange={(e) => setFilterCourseId(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#1F5FA8] bg-white text-slate-800 max-w-xs truncate"
            >
              <option value="all">Todos los cursos</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="text-slate-500 font-medium">
          Mostrando <strong className="text-slate-800">{filteredSections.length}</strong> de {sections.length} secciones
        </div>
      </div>

      {/* Archive Success Banner */}
      {archiveSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 flex items-center gap-2 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{archiveSuccess}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Cargando secciones académicas...</p>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No se encontraron secciones</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              {filterPeriodId !== 'all' || filterCourseId !== 'all'
                ? 'No existen secciones con los filtros aplicados. Cambia los filtros o crea una nueva sección.'
                : 'Aún no se han configurado secciones universitarias en Supabase. Registra la primera para asignar profesores y matricular alumnos.'}
            </p>
            {periods.length > 0 && courses.length > 0 && (
              <button
                onClick={handleOpenCreate}
                className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Crear primera sección</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Sección</th>
                  <th scope="col" className="px-6 py-3.5">Asignatura</th>
                  <th scope="col" className="px-6 py-3.5">Periodo</th>
                  <th scope="col" className="px-6 py-3.5">Capacidad / Matriculados</th>
                  <th scope="col" className="px-6 py-3.5">Docente Asignado</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredSections.map((sec) => {
                  const courseName = sec.offering?.course?.name || 'Curso no identificado';
                  const courseCode = sec.offering?.course?.code || '';
                  const periodName = sec.offering?.period?.name || 'Periodo no identificado';
                  const isFull = sec.capacity ? (sec.activeEnrollmentsCount || 0) >= sec.capacity : false;

                  return (
                    <tr key={sec.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sección */}
                      <td className="px-6 py-3.5 font-bold font-mono text-[#0B2A5B]">
                        <span className="bg-blue-50 text-[#1F5FA8] border border-blue-200 px-2.5 py-0.5 rounded-md">
                          {sec.name}
                        </span>
                      </td>

                      {/* Asignatura */}
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-900">{courseName}</div>
                        {courseCode && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Cód: {courseCode}
                          </span>
                        )}
                      </td>

                      {/* Periodo */}
                      <td className="px-6 py-3.5 font-medium text-slate-700 font-mono">
                        {periodName}
                      </td>

                      {/* Capacidad / Matriculados */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900">
                            {sec.activeEnrollmentsCount ?? 0}
                          </span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-600">
                            {sec.capacity ? sec.capacity : 'Sin límite'}
                          </span>
                          {isFull && (
                            <span className="text-[10px] font-bold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded">
                              Lleno
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Docente Asignado */}
                      <td className="px-6 py-3.5">
                        {sec.teachers && sec.teachers.length > 0 ? (
                          <div className="space-y-1">
                            {sec.teachers.map((t) => (
                              <div key={t.id} className="flex items-center justify-between gap-2 max-w-xs bg-slate-50 px-2 py-1 rounded border border-slate-200">
                                <span className="font-semibold text-slate-800 truncate">
                                  {t.teacher?.first_names} {t.teacher?.last_names}
                                </span>
                                <button
                                  onClick={() =>
                                    setRemovingTeacherAssignment({
                                      section: sec,
                                      assignmentId: t.id,
                                      teacherName: `${t.teacher?.first_names} ${t.teacher?.last_names}`,
                                    })
                                  }
                                  className="text-slate-400 hover:text-red-600 p-0.5 transition-colors"
                                  title="Quitar docente de esta sección"
                                >
                                  <UserMinus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 italic text-[11px]">Sin asignar</span>
                            <button
                              onClick={() => handleOpenAssignTeacher(sec)}
                              className="text-[11px] font-bold text-[#1F5FA8] hover:text-[#0B2A5B] flex items-center gap-1"
                            >
                              <UserCheck className="w-3 h-3" />
                              Asignar
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="px-6 py-3.5 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => handleOpenAssignTeacher(sec)}
                          className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                          title="Asignar profesor adicional"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(sec)}
                          className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                          title="Editar sección"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setArchivingSection(sec)}
                          className="px-2 py-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                          title="Archivar"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          <span className="text-xs font-semibold">Archivar</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal (Create / Edit Section) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingSection ? 'Editar Sección' : 'Nueva Sección'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                disabled={formLoading}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSection} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{formError}</div>
                </div>
              )}

              {/* Notice about auto creation of course_offerings */}
              {!editingSection && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-[11px] leading-relaxed">
                  💡 Si el curso no está ofertado en el periodo elegido, el sistema generará automáticamente la oferta correspondiente (<code className="font-mono">course_offerings</code>).
                </div>
              )}

              {/* Periodo */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Periodo Académico *
                </label>
                <select
                  value={formData.period_id}
                  onChange={(e) => setFormData({ ...formData, period_id: e.target.value })}
                  disabled={Boolean(editingSection) || formLoading}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] disabled:bg-slate-100 text-slate-900"
                >
                  {periods.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Curso */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Asignatura / Curso *
                </label>
                <select
                  value={formData.course_id}
                  onChange={(e) => setFormData({ ...formData, course_id: e.target.value })}
                  disabled={Boolean(editingSection) || formLoading}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] disabled:bg-slate-100 text-slate-900"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name} ({c.credits} cr.)
                    </option>
                  ))}
                </select>
              </div>

              {/* Nombre de la sección */}
              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nombre de la sección *
                </label>
                <input
                  type="text"
                  placeholder="Ej: A1, B2 o 201"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono uppercase text-slate-900"
                />
              </div>

              {/* Capacidad */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block font-bold text-slate-700 uppercase tracking-wide">
                    Capacidad Máxima de Alumnos
                  </label>
                  <span className="text-slate-400 text-[11px]">Opcional</span>
                </div>
                <input
                  type="number"
                  min="1"
                  placeholder="Ej: 35 (deja vacío para sin límite)"
                  value={formData.capacity}
                  onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={formLoading}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F5FA8] hover:bg-[#174B88] rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {formLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{editingSection ? 'Guardar cambios' : 'Crear sección'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Assignment Modal */}
      {assignModalSection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-blue-200" />
                <h3 className="text-base font-bold">Asignar Docente a Sección</h3>
              </div>
              <button
                onClick={() => setAssignModalSection(null)}
                disabled={assignLoading}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacherAssignment} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <div>
                  <span className="text-slate-500 font-medium">Asignatura:</span>{' '}
                  <strong className="text-slate-900">{assignModalSection.offering?.course?.name}</strong>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Sección:</span>{' '}
                  <strong className="text-[#1F5FA8] font-mono">{assignModalSection.name}</strong>{' '}
                  ({assignModalSection.offering?.period?.name})
                </div>
              </div>

              {assignError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{assignError}</div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Profesor Registrado *
                </label>
                {teachersList.length === 0 ? (
                  <p className="text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                    No hay profesores registrados con cuenta activa en Supabase. Regístralos en la sección Profesores.
                  </p>
                ) : (
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    required
                    disabled={assignLoading}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                  >
                    {teachersList.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.first_names} {t.last_names} (Cód: {t.code})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setAssignModalSection(null)}
                  disabled={assignLoading}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || teachersList.length === 0}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#1F5FA8] hover:bg-[#174B88] rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {assignLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirmar Asignación</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Section Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(archivingSection)}
        title="Archivar Sección"
        message="Se ocultará de la web. Los datos se conservan en la base de datos."
        loading={archiveLoading}
        confirmLabel="Archivar"
        onConfirm={handleArchiveSection}
        onCancel={() => setArchivingSection(null)}
      />

      {/* Remove Teacher Assignment Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(removingTeacherAssignment)}
        title="Quitar Asignación Docente"
        message={`¿Deseas desvincular al docente ${removingTeacherAssignment?.teacherName} de la sección ${removingTeacherAssignment?.section.name}?`}
        loading={removeTeacherLoading}
        onConfirm={handleRemoveTeacher}
        onCancel={() => setRemovingTeacherAssignment(null)}
      />
    </div>
  );
};
