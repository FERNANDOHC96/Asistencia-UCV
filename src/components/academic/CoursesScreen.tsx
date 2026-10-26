import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { BookOpen, Plus, Edit2, Archive, Search, RefreshCw, AlertCircle, Loader2, X, CheckCircle2 } from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { translateSupabaseError } from '../../lib/supabaseErrors';
import { Course } from '../../types';
import { DeleteConfirmModal } from '../DeleteConfirmModal';

export const CoursesScreen: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [archiveSuccess, setArchiveSuccess] = useState<string | null>(null);

  // Form modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    credits: 4,
  });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Archive modal
  const [archivingCourse, setArchivingCourse] = useState<Course | null>(null);
  const [archiveLoading, setArchiveLoading] = useState(false);

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
        .from('courses')
        .select('id, code, name, credits')
        .is('archived_at', null)
        .order('name', { ascending: true });

      if (sbError) {
        setError(translateSupabaseError(sbError, 'courses'));
        setCourses([]);
      } else {
        setCourses(data || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al conectar con Supabase.');
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((c) =>
      c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

  const handleOpenCreate = () => {
    setEditingCourse(null);
    setFormData({
      code: '',
      name: '',
      credits: 4,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (c: Course) => {
    setEditingCourse(c);
    setFormData({
      code: c.code,
      name: c.name,
      credits: c.credits,
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const code = formData.code.trim().toUpperCase();
    const name = formData.name.trim();
    const credits = Number(formData.credits);

    if (!code) {
      setFormError('El código del curso es obligatorio.');
      return;
    }
    if (!name) {
      setFormError('El nombre del curso es obligatorio.');
      return;
    }
    if (isNaN(credits) || credits < 0) {
      setFormError('Los créditos deben ser un valor numérico positivo o cero.');
      return;
    }

    setFormLoading(true);
    try {
      const supabase = getSupabaseClient();
      if (editingCourse) {
        const { error: updError } = await supabase
          .from('courses')
          .update({
            code,
            name,
            credits,
          })
          .eq('id', editingCourse.id);

        if (updError) {
          setFormError(translateSupabaseError(updError, 'courses'));
          return;
        }
      } else {
        const { error: insError } = await supabase
          .from('courses')
          .insert({
            code,
            name,
            credits,
          });

        if (insError) {
          setFormError(translateSupabaseError(insError, 'courses'));
          return;
        }
      }

      setIsFormOpen(false);
      fetchCourses();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error inesperado al guardar.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archivingCourse) return;
    setArchiveLoading(true);
    setArchiveSuccess(null);
    try {
      const supabase = getSupabaseClient();
      const { error: arcError } = await supabase
        .from('courses')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', archivingCourse.id);

      if (arcError) {
        setError(translateSupabaseError(arcError, 'courses'));
      } else {
        setArchiveSuccess('Archivado');
        setTimeout(() => setArchiveSuccess(null), 4000);
        fetchCourses();
      }
      setArchivingCourse(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al archivar curso.');
    } finally {
      setArchiveLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Catálogo de Cursos
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Planes de estudio y asignaturas universitarias
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchCourses}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar cursos"
            aria-label="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo curso</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Summary */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            placeholder="Buscar por código o nombre de curso..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8]"
          />
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Mostrando <strong className="text-slate-800">{filteredCourses.length}</strong> de {courses.length} cursos
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
            <p className="text-xs text-slate-500 font-medium">Cargando cursos...</p>
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery ? 'No se encontraron coincidencias' : 'No hay cursos registrados'}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              {searchQuery
                ? `No se encontraron cursos que coincidan con "${searchQuery}".`
                : 'Registra el primer curso de la malla curricular universitaria.'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenCreate}
                className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Crear primer curso</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Código</th>
                  <th scope="col" className="px-6 py-3.5">Nombre de la Asignatura</th>
                  <th scope="col" className="px-6 py-3.5">Créditos</th>
                  <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredCourses.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-6 py-3.5 font-bold text-[#0B2A5B] font-mono">
                      <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {c.code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      {c.name}
                    </td>
                    <td className="px-6 py-3.5 text-slate-600 font-medium">
                      {c.credits} {c.credits === 1 ? 'crédito' : 'créditos'}
                    </td>
                    <td className="px-6 py-3.5 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1.5 text-slate-500 hover:text-[#1F5FA8] hover:bg-slate-100 rounded-md transition-colors"
                        title="Editar curso"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setArchivingCourse(c)}
                        className="px-2 py-1 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer"
                        title="Archivar"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span className="text-xs font-semibold">Archivar</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal (Create / Edit) */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingCourse ? 'Editar Curso' : 'Nuevo Curso'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                disabled={formLoading}
                className="text-slate-300 hover:text-white p-1 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 text-xs">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed">{formError}</div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Código del Curso *
                </label>
                <input
                  type="text"
                  placeholder="Ej: ING-401 o CS101"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  required
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] font-mono uppercase text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Nombre de la Asignatura *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Ingeniería de Software I"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={formLoading}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 uppercase tracking-wide mb-1">
                  Créditos *
                </label>
                <input
                  type="number"
                  min="0"
                  max="20"
                  value={formData.credits}
                  onChange={(e) => setFormData({ ...formData, credits: parseInt(e.target.value) || 0 })}
                  required
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
                  <span>{editingCourse ? 'Guardar cambios' : 'Crear curso'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={Boolean(archivingCourse)}
        title="Archivar Curso"
        message="Se ocultará de la web. Los datos se conservan en la base de datos."
        loading={archiveLoading}
        confirmLabel="Archivar"
        onConfirm={handleArchive}
        onCancel={() => setArchivingCourse(null)}
      />
    </div>
  );
};
