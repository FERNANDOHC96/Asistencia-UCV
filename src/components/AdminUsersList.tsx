import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  GraduationCap,
  Loader2,
  Trash2,
  Check,
  X,
  ScanFace
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { Profile, FaceStatus } from '../types';
import { formatLimaDate, formatLimaDateTime } from '../lib/dateUtils';
import { CreateUserModal } from './CreateUserModal';
import { FaceSettingsCard } from './FaceSettingsCard';

interface AdminUsersListProps {
  role: 'alumno' | 'profesor';
}

export const AdminUsersList: React.FC<AdminUsersListProps> = ({ role }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [faceStatusMap, setFaceStatusMap] = useState<Record<string, FaceStatus>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [faceFilter, setFaceFilter] = useState<'all' | 'registrado' | 'sin_registrar'>('all');

  // Modales y acciones
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [studentToDeleteFace, setStudentToDeleteFace] = useState<{ id: string; name: string; code: string } | null>(null);
  const [deletingFace, setDeletingFace] = useState<boolean>(false);
  const [faceActionSuccess, setFaceActionSuccess] = useState<string | null>(null);
  const [faceActionError, setFaceActionError] = useState<string | null>(null);

  const roleTitle = role === 'alumno' ? 'Alumnos' : 'Profesores';
  const roleSingle = role === 'alumno' ? 'alumno' : 'profesor';
  const RoleIcon = role === 'alumno' ? Users : GraduationCap;

  const fetchUsers = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setError('No se pudo conectar con el servicio. Contacta al administrador.');
      setLoading(false);
      setUsers([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();

      // 1. Consulta perfiles del rol seleccionado sin selects anidados
      const { data, error: sbError } = await supabase
        .from('profiles')
        .select('id, code, first_names, last_names, role, active')
        .eq('role', role)
        .order('last_names', { ascending: true });

      if (sbError) {
        setError(`Error al consultar la tabla "profiles": ${sbError.message}`);
        setUsers([]);
        return;
      }

      const profileList = (data as Profile[]) || [];
      setUsers(profileList);

      // 2. Si es alumno, consulta la vista face_status
      if (role === 'alumno') {
        const { data: faceData, error: faceError } = await supabase
          .from('face_status')
          .select('student_id, registered, model, registered_at, last_pass, enrollment_open_until');

        if (faceError) {
          // Vista face_status solo legible por administrador
          console.warn('Advertencia al consultar face_status:', faceError.message);
        } else if (faceData) {
          const map: Record<string, FaceStatus> = {};
          faceData.forEach((f: any) => {
            map[f.student_id] = f;
          });
          setFaceStatusMap(map);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al conectar con la base de datos.';
      setError(msg);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Contadores para el panel de ajustes de rostro
  const activeStudentsCount = useMemo(() => {
    return users.filter((u) => u.active).length;
  }, [users]);

  const registeredCount = useMemo(() => {
    return users.filter((u) => u.active && faceStatusMap[u.id]?.registered).length;
  }, [users, faceStatusMap]);

  // Filtrado en memoria de búsqueda por código, nombres, apellidos y estado de rostro
  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return users.filter((u) => {
      // Filtro de rostro
      if (role === 'alumno' && faceFilter !== 'all') {
        const isReg = Boolean(faceStatusMap[u.id]?.registered);
        if (faceFilter === 'registrado' && !isReg) return false;
        if (faceFilter === 'sin_registrar' && isReg) return false;
      }

      // Filtro de texto
      if (!q) return true;
      const codeMatch = (u.code || '').toLowerCase().includes(q);
      const nameMatch = (u.first_names || '').toLowerCase().includes(q);
      const lastMatch = (u.last_names || '').toLowerCase().includes(q);
      const fullMatch = `${u.first_names || ''} ${u.last_names || ''}`.toLowerCase().includes(q);
      return codeMatch || nameMatch || lastMatch || fullMatch;
    });
  }, [users, searchQuery, role, faceFilter, faceStatusMap]);

  // 2. BORRAR ROSTRO: llama a supabase.rpc('reset_face', { p_student })
  const handleConfirmDeleteFace = async () => {
    if (!studentToDeleteFace) return;
    setDeletingFace(true);
    setFaceActionError(null);
    setFaceActionSuccess(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error: rpcErr } = await supabase.rpc('reset_face', {
        p_student: studentToDeleteFace.id,
      });

      if (rpcErr) {
        setFaceActionError(rpcErr.message || 'Error al borrar rostro.');
        return;
      }

      const code = typeof data === 'string' ? data : data?.code || data?.status || (data === true ? 'success' : '');

      if (code === 'success' || data === 'success') {
        setFaceActionSuccess('Rostro borrado');
        setStudentToDeleteFace(null);
        await fetchUsers();
      } else if (code === 'unauthorized' || data === 'unauthorized') {
        setFaceActionError('No tienes permiso');
      } else {
        const errMsg = typeof data === 'string' ? data : data?.message || data?.error || 'Error al borrar rostro del alumno.';
        setFaceActionError(errMsg);
      }
    } catch (err: any) {
      setFaceActionError(err?.message || 'Error al conectar con el servidor.');
    } finally {
      setDeletingFace(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-[#1F5FA8] flex items-center justify-center">
              <RoleIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
              Gestión de {roleTitle}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Registro y control de acceso institucional para {roleTitle.toLowerCase()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsers()}
            disabled={loading}
            className="p-2 text-slate-600 hover:text-[#1F5FA8] bg-white border border-slate-200 hover:bg-slate-50 rounded-lg shadow-2xs transition-colors cursor-pointer"
            title="Recargar lista"
            aria-label="Recargar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo {roleSingle}</span>
          </button>
        </div>
      </div>

      {/* PANEL AJUSTES DE ROSTRO (Solo visible arriba de Alumnos) */}
      {role === 'alumno' && (
        <FaceSettingsCard
          registeredCount={registeredCount}
          activeStudentsCount={activeStudentsCount}
          onSettingsChanged={fetchUsers}
        />
      )}

      {/* Banner de feedback para acciones de rostro */}
      {faceActionSuccess && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{faceActionSuccess}</span>
          </div>
          <button
            onClick={() => setFaceActionSuccess(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {faceActionError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-center justify-between gap-2 animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{faceActionError}</span>
          </div>
          <button
            onClick={() => setFaceActionError(null)}
            className="text-red-700 hover:text-red-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Search Bar & Filtros */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">
          {/* Buscador de texto */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder={`Buscar por código, nombres o apellidos...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
            />
          </div>

          {/* Filtro por Rostro (Solo Alumnos) */}
          {role === 'alumno' && (
            <div className="sm:w-48">
              <select
                value={faceFilter}
                onChange={(e) => setFaceFilter(e.target.value as any)}
                className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-300 rounded-lg bg-slate-50 font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
              >
                <option value="all">Rostro: Todos</option>
                <option value="registrado">Rostro: Registrado ({registeredCount})</option>
                <option value="sin_registrar">Rostro: Sin registrar ({users.length - registeredCount})</option>
              </select>
            </div>
          )}
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
          <span>Registros: <strong className="text-slate-800">{filteredUsers.length}</strong> de {users.length}</span>
        </div>
      </div>

      {/* Error Notice */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 animate-in fade-in">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="w-8 h-8 text-[#1F5FA8] animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500 font-medium">Cargando catálogo de {roleTitle.toLowerCase()}...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mx-auto mb-3">
              <RoleIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">
              {searchQuery || (role === 'alumno' && faceFilter !== 'all')
                ? 'No se encontraron coincidencias'
                : `No hay ${roleTitle.toLowerCase()} registrados`}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              {searchQuery || (role === 'alumno' && faceFilter !== 'all')
                ? `No existen ${roleTitle.toLowerCase()} que coincidan con los filtros aplicados.`
                : `Aún no se han registrado perfiles de ${roleTitle.toLowerCase()} en la base de datos de Supabase. Utiliza el botón "Nuevo ${roleSingle}" para registrar uno.`}
            </p>
            {!searchQuery && faceFilter === 'all' && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#174B88] text-white text-xs font-bold rounded-lg shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Registrar primer {roleSingle}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-semibold">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Código</th>
                  <th scope="col" className="px-6 py-3.5">Nombres</th>
                  <th scope="col" className="px-6 py-3.5">Apellidos</th>
                  {role === 'alumno' && (
                    <th scope="col" className="px-6 py-3.5">Rostro</th>
                  )}
                  {role === 'profesor' && (
                    <th scope="col" className="px-6 py-3.5">Rol</th>
                  )}
                  <th scope="col" className="px-6 py-3.5">Estado</th>
                  {role === 'alumno' && (
                    <th scope="col" className="px-6 py-3.5 text-right">Acciones</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((item) => {
                  const face = faceStatusMap[item.id];
                  const hasFace = Boolean(face?.registered);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Código */}
                      <td className="px-6 py-3.5 font-mono font-bold text-[#0B2A5B]">
                        <span className="bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {item.code}
                        </span>
                      </td>

                      {/* Nombres */}
                      <td className="px-6 py-3.5 font-semibold text-slate-900">
                        {item.first_names}
                      </td>

                      {/* Apellidos */}
                      <td className="px-6 py-3.5 font-semibold text-slate-900">
                        {item.last_names}
                      </td>

                      {/* Columna Rostro (Solo para Alumnos) */}
                      {role === 'alumno' && (
                        <td className="px-6 py-3.5">
                          {hasFace ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span>Registrado</span>
                              </span>
                              {face?.registered_at && (
                                <div className="text-[10px] text-slate-500 font-mono">
                                  Reg: {formatLimaDate(face.registered_at)}
                                </div>
                              )}
                              {face?.last_pass && (
                                <div className="text-[10px] text-slate-600 font-mono">
                                  Última verificación: {formatLimaDateTime(face.last_pass)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                              <XCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>Sin registrar</span>
                            </span>
                          )}
                        </td>
                      )}

                      {/* Rol (Solo para Profesores) */}
                      {role === 'profesor' && (
                        <td className="px-6 py-3.5 capitalize text-slate-600">
                          {item.role}
                        </td>
                      )}

                      {/* Estado con texto e icono */}
                      <td className="px-6 py-3.5">
                        {item.active ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Activo
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 border border-red-200 px-2.5 py-0.5 rounded-full">
                            <XCircle className="w-3.5 h-3.5 text-red-600" />
                            Inactivo
                          </span>
                        )}
                      </td>

                      {/* Acciones: Borrar rostro (Solo para Alumnos) */}
                      {role === 'alumno' && (
                        <td className="px-6 py-3.5 text-right">
                          {hasFace ? (
                            <button
                              type="button"
                              onClick={() => setStudentToDeleteFace({
                                id: item.id,
                                name: `${item.last_names}, ${item.first_names}`,
                                code: item.code
                              })}
                              className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-red-200 text-red-700 bg-red-50/50 hover:bg-red-100 hover:text-red-900 transition-colors cursor-pointer inline-flex items-center gap-1"
                              title="Borrar registro facial del alumno"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Borrar rostro</span>
                            </button>
                          ) : (
                            <span className="text-slate-300 font-mono">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmación: Borrar Rostro */}
      {studentToDeleteFace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                ¿Borrar rostro del alumno?
              </h3>
              <p className="text-xs text-slate-700 font-semibold mt-1">
                {studentToDeleteFace.name} ({studentToDeleteFace.code})
              </p>
              <p className="text-xs text-slate-500 mt-2 leading-relaxed">
                El alumno tendrá que registrar su rostro de nuevo.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStudentToDeleteFace(null)}
                disabled={deletingFace}
                className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteFace}
                disabled={deletingFace}
                className="flex-1 py-2 px-3 bg-[#C8102E] hover:bg-red-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {deletingFace ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Sí, borrar rostro</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Creación de Perfil */}
      <CreateUserModal
        isOpen={isModalOpen}
        role={role}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          fetchUsers();
        }}
      />
    </div>
  );
};
