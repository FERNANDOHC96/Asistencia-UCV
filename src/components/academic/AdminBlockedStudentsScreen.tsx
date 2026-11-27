import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ShieldBan,
  ShieldCheck,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Loader2,
  History,
  UserCheck,
  X,
  BookOpen,
  Layers,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { formatLimaDateTime } from '../../lib/dateUtils';
import {
  fetchAllStudentSectionBlocks,
  unblockStudentSection,
} from '../../services/blockService';
import { StudentBlockRecordWithDetails } from '../../types';
import { ActionButton, IconActionButton, SectionIconBadge } from '../ui';

type ViewFilter = 'activos' | 'rehabilitados' | 'todos';

export const AdminBlockedStudentsScreen: React.FC = () => {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'administrador';

  const [blocks, setBlocks] = useState<StudentBlockRecordWithDetails[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCourseId, setSelectedCourseId] = useState<string>('all');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('all');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('activos');

  const [unblockTarget, setUnblockTarget] = useState<StudentBlockRecordWithDetails | null>(null);
  const [unblockReason, setUnblockReason] = useState<string>('');
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<boolean>(false);

  const loadBlocks = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchAllStudentSectionBlocks();
      setBlocks(data);
    } catch (err: unknown) {
      setError(translateSupabaseError(err));
      setBlocks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBlocks();
  }, [loadBlocks]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel('admin-student-section-blocks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_section_blocks' },
        () => {
          loadBlocks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBlocks]);

  const courseOptions = useMemo(() => {
    const map = new Map<string, { id: string; code: string; name: string }>();
    blocks.forEach((b) => {
      if (b.courseId && !map.has(b.courseId)) {
        map.set(b.courseId, {
          id: b.courseId,
          code: b.courseCode,
          name: b.courseName,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [blocks]);

  const sectionOptions = useMemo(() => {
    const map = new Map<string, { id: string; label: string; courseId: string }>();
    blocks.forEach((b) => {
      if (selectedCourseId !== 'all' && b.courseId !== selectedCourseId) return;
      if (b.section_id && !map.has(b.section_id)) {
        map.set(b.section_id, {
          id: b.section_id,
          label: `${b.courseCode} · Sec. ${b.sectionName}`,
          courseId: b.courseId,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [blocks, selectedCourseId]);

  useEffect(() => {
    if (
      selectedSectionId !== 'all' &&
      !sectionOptions.some((sec) => sec.id === selectedSectionId)
    ) {
      setSelectedSectionId('all');
    }
  }, [sectionOptions, selectedSectionId]);

  const activeCount = useMemo(
    () => blocks.filter((b) => b.isActive).length,
    [blocks]
  );

  const historyCount = useMemo(
    () => blocks.filter((b) => !b.isActive).length,
    [blocks]
  );

  const filteredBlocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return blocks.filter((b) => {
      if (viewFilter === 'activos' && !b.isActive) return false;
      if (viewFilter === 'rehabilitados' && b.isActive) return false;
      if (selectedCourseId !== 'all' && b.courseId !== selectedCourseId) return false;
      if (selectedSectionId !== 'all' && b.section_id !== selectedSectionId) return false;

      if (q) {
        const nameMatch = b.studentName.toLowerCase().includes(q);
        const codeMatch = b.studentCode.toLowerCase().includes(q);
        const courseMatch = `${b.courseCode} ${b.courseName}`.toLowerCase().includes(q);
        const sectionMatch = b.sectionName.toLowerCase().includes(q);
        const reasonMatch = (b.reason || '').toLowerCase().includes(q);
        return nameMatch || codeMatch || courseMatch || sectionMatch || reasonMatch;
      }

      return true;
    });
  }, [blocks, viewFilter, selectedCourseId, selectedSectionId, searchQuery]);

  const handleOpenUnblockModal = (record: StudentBlockRecordWithDetails) => {
    if (!isAdmin || !record.isActive) return;
    setUnblockTarget(record);
    setUnblockReason('');
    setUnblockError(null);
  };

  const handleCloseUnblockModal = () => {
    if (unblocking) return;
    setUnblockTarget(null);
    setUnblockReason('');
    setUnblockError(null);
  };

  const handleConfirmUnblock = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAdmin || !unblockTarget) return;

    const trimmed = unblockReason.trim();
    if (!trimmed) {
      setUnblockError('Debes ingresar el motivo de la rehabilitación.');
      return;
    }

    setUnblocking(true);
    setUnblockError(null);
    setActionSuccess(null);

    try {
      await unblockStudentSection({
        studentId: unblockTarget.student_id,
        sectionId: unblockTarget.section_id,
        reason: trimmed,
      });

      const targetName = unblockTarget.studentName;
      const targetCourse = `${unblockTarget.courseCode} (Sec. ${unblockTarget.sectionName})`;
      setUnblockTarget(null);
      setUnblockReason('');
      setActionSuccess(
        `Alumno ${targetName} rehabilitado correctamente en ${targetCourse}.`
      );
      await loadBlocks();
    } catch (err: unknown) {
      setUnblockError(
        err instanceof Error ? err.message : 'No se pudo rehabilitar al alumno.'
      );
    } finally {
      setUnblocking(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <SectionIconBadge icon={ShieldBan} variant="red" size="md" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B] tracking-[-0.02em]">
              Alumnos inhabilitados
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Control de inhabilitaciones por acumulación de 3 faltas por curso, historial y rehabilitación administrativa.
            </p>
          </div>
        </div>

        <ActionButton
          icon={RefreshCw}
          variant="secondary"
          size="sm"
          spinningIcon={loading}
          disabled={loading}
          onClick={loadBlocks}
          className="self-start sm:self-auto"
        >
          Actualizar
        </ActionButton>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="ucv-card rounded-2xl p-4.5 border-t-2 border-t-[#C8102E] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Inhabilitaciones activas
            </span>
            <p className="text-2xl font-bold text-[#C8102E] font-mono tabular-nums mt-1">
              {loading ? '...' : activeCount}
            </p>
          </div>
          <SectionIconBadge icon={ShieldBan} variant="red" size="md" />
        </div>

        <div className="ucv-card rounded-2xl p-4.5 border-t-2 border-t-emerald-600 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Rehabilitados (Historial)
            </span>
            <p className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
              {loading ? '...' : historyCount}
            </p>
          </div>
          <SectionIconBadge icon={ShieldCheck} variant="emerald" size="md" />
        </div>

        <div className="ucv-card rounded-2xl p-4.5 border-t-2 border-t-[#1F5FA8] flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-500">
              Total en historial
            </span>
            <p className="text-2xl font-bold text-[#0B2A5B] font-mono tabular-nums mt-1">
              {loading ? '...' : blocks.length}
            </p>
          </div>
          <SectionIconBadge icon={History} variant="blue" size="md" />
        </div>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-2.5 ucv-slide-down">
          <div className="flex items-center gap-2.5 font-semibold">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={1.9} />
            <span>{actionSuccess}</span>
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
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      <div className="ucv-card rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setViewFilter('activos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewFilter === 'activos'
                ? 'bg-[#C8102E] text-white shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <ShieldBan className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Inhabilitados activos ({activeCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('rehabilitados')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewFilter === 'rehabilitados'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Rehabilitados ({historyCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setViewFilter('todos')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
              viewFilter === 'todos'
                ? 'bg-[#0B2A5B] text-white shadow-xs'
                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200/70'
            }`}
          >
            <History className="w-3.5 h-3.5" strokeWidth={1.85} />
            <span>Historial completo ({blocks.length})</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 text-xs">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.85} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre, código, curso o motivo..."
              className="w-full h-10 pl-10 pr-3.5 text-xs border border-slate-200 bg-slate-50/60 focus:bg-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/20 focus:border-[#1F5FA8] transition-all"
            />
          </div>

          <div className="md:col-span-4">
            <select
              aria-label="Filtrar por curso"
              value={selectedCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
              className="w-full h-10 px-3 text-xs font-medium text-slate-700 bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 focus:outline-hidden cursor-pointer transition-all"
            >
              <option value="all">Todos los cursos ({courseOptions.length})</option>
              {courseOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} - {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              aria-label="Filtrar por sección"
              value={selectedSectionId}
              onChange={(e) => setSelectedSectionId(e.target.value)}
              className="w-full h-10 px-3 text-xs font-medium text-slate-700 bg-slate-50/60 border border-slate-200 rounded-xl focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 focus:outline-hidden cursor-pointer transition-all"
            >
              <option value="all">Todas las secciones ({sectionOptions.length})</option>
              {sectionOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="ucv-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">
              Consultando registros de inhabilitación...
            </p>
          </div>
        ) : filteredBlocks.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {blocks.length === 0
                ? 'No hay alumnos inhabilitados registrados'
                : 'No se encontraron registros para los filtros seleccionados'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              {blocks.length === 0
                ? 'Cuando un alumno acumule 3 faltas en una sección, aparecerá aquí automáticamente.'
                : 'Prueba limpiando el buscador o cambiando el filtro de curso, sección o estado.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-500 uppercase tracking-[0.06em] font-semibold text-[11px]">
                <tr>
                  <th className="px-4 py-3.5">Código</th>
                  <th className="px-4 py-3.5">Alumno</th>
                  <th className="px-4 py-3.5">Curso y Sección</th>
                  <th className="px-4 py-3.5 text-center">Faltas</th>
                  <th className="px-4 py-3.5">Fecha de inhabilitación</th>
                  <th className="px-4 py-3.5">Motivo</th>
                  <th className="px-4 py-3.5 text-center">Estado actual</th>
                  {isAdmin && <th className="px-4 py-3.5 text-right">Acción</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredBlocks.map((row) => (
                  <tr
                    key={`${row.student_id}-${row.section_id}-${row.blocked_at}`}
                    className={`transition-colors ${
                      row.isActive ? 'bg-red-50/20 hover:bg-red-50/40' : 'hover:bg-slate-50/85'
                    }`}
                  >
                    <td className="px-4 py-3.5 font-mono font-semibold text-[#0B2A5B] whitespace-nowrap">
                      <span className="bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80">
                        {row.studentCode}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-semibold text-slate-900">
                      {row.studentName}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-semibold text-[#0B2A5B] flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#1F5FA8] shrink-0" strokeWidth={1.85} />
                        <span>
                          {row.courseCode} · {row.courseName}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1 font-mono">
                        <Layers className="w-3 h-3 text-[#C8102E]" strokeWidth={1.85} />
                        <span>
                          Sección {row.sectionName}
                          {row.periodName ? ` (${row.periodName})` : ''}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-md font-mono text-[11px] font-bold border ${
                          row.isActive
                            ? 'bg-red-50 text-[#B80E29] border-red-200/85'
                            : 'bg-amber-50 text-amber-800 border-amber-200/85'
                        }`}
                      >
                        {row.totalAbsences} falta(s)
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                      <div>{formatLimaDateTime(row.blocked_at)}</div>
                      {!row.isActive && row.unblocked_at && (
                        <div className="text-emerald-700 font-semibold mt-0.5">
                          Rehab.: {formatLimaDateTime(row.unblocked_at)}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5 max-w-xs">
                      <p className="text-slate-700 leading-snug">
                        {row.reason || 'Acumulación de faltas'}
                      </p>
                      {!row.isActive && row.unblock_reason && (
                        <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 mt-1">
                          <strong className="font-semibold">Rehabilitación:</strong>{' '}
                          {row.unblock_reason}
                          {row.absences_at_unblock !== null &&
                            row.absences_at_unblock !== undefined && (
                              <span className="font-mono text-emerald-700">
                                {' '}
                                (faltas previas: {row.absences_at_unblock})
                              </span>
                            )}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-center whitespace-nowrap">
                      {row.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 text-[#B80E29] border border-red-200/85">
                          <ShieldBan className="w-3 h-3" strokeWidth={1.9} />
                          <span>INHABILITADO</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/85">
                          <ShieldCheck className="w-3 h-3" strokeWidth={1.9} />
                          <span>HABILITADO</span>
                        </span>
                      )}
                    </td>

                    {isAdmin && (
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        {row.isActive ? (
                          <ActionButton
                            icon={UserCheck}
                            variant="confirm"
                            size="xs"
                            onClick={() => handleOpenUnblockModal(row)}
                            className="uppercase tracking-wide font-bold"
                          >
                            REHABILITAR ALUMNO
                          </ActionButton>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            Rehabilitado
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {unblockTarget && isAdmin && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar rehabilitación de alumno"
          onClick={handleCloseUnblockModal}
          className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleConfirmUnblock}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg ucv-card ucv-scale-in rounded-2xl overflow-hidden bg-white shadow-2xl border border-slate-200"
          >
            <div className="h-1.5 w-full ucv-topbar-split" />

            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <SectionIconBadge icon={UserCheck} variant="emerald" size="sm" />
                <div>
                  <h2 className="text-sm font-extrabold text-[#0B2A5B]">
                    Confirmar rehabilitación de alumno
                  </h2>
                  <p className="text-[11px] text-slate-500">
                    Habilita nuevamente el registro QR y Bluetooth en esta sección
                  </p>
                </div>
              </div>
              <IconActionButton
                icon={X}
                label="Cerrar modal"
                variant="neutral"
                size="sm"
                disabled={unblocking}
                onClick={handleCloseUnblockModal}
              />
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[#0B2A5B] text-sm">
                    {unblockTarget.studentName}
                  </span>
                  <span className="font-mono font-bold text-[#0B2A5B] bg-white px-2 py-0.5 rounded border border-slate-200">
                    {unblockTarget.studentCode}
                  </span>
                </div>
                <p className="text-slate-600 font-medium">
                  {unblockTarget.courseCode} · {unblockTarget.courseName} — Sección{' '}
                  {unblockTarget.sectionName}
                </p>
                <p className="text-[11px] text-[#C8102E] font-semibold">
                  Faltas registradas: {unblockTarget.totalAbsences} · Motivo bloqueo:{' '}
                  {unblockTarget.reason || 'Acumulación de faltas'}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.9} />
                <span>
                  La rehabilitación conserva el historial de faltas anteriores. El alumno volverá a quedar inhabilitado si acumula{' '}
                  <strong>3 nuevas faltas</strong> en este curso.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Motivo de rehabilitación *
                </label>
                <textarea
                  rows={3}
                  required
                  value={unblockReason}
                  onChange={(e) => setUnblockReason(e.target.value)}
                  disabled={unblocking}
                  placeholder="Ej: Justificación médica aprobada por coordinación académica..."
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-slate-50 focus:bg-white focus:border-[#1F5FA8] focus:ring-2 focus:ring-[#1F5FA8]/20 outline-none resize-none"
                />
              </div>

              {unblockError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-[#C8102E] text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.9} />
                  <span>{unblockError}</span>
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
              <ActionButton
                variant="secondary"
                size="sm"
                onClick={handleCloseUnblockModal}
                disabled={unblocking}
              >
                Cancelar
              </ActionButton>
              <ActionButton
                type="submit"
                icon={UserCheck}
                variant="confirm"
                size="sm"
                loading={unblocking}
                className="uppercase tracking-wide font-extrabold"
              >
                {unblocking ? 'Rehabilitando...' : 'REHABILITAR ALUMNO'}
              </ActionButton>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
