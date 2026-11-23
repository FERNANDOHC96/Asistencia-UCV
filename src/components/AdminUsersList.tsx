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
} from 'lucide-react';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { Profile } from '../types';
import { CreateUserModal } from './CreateUserModal';

interface AdminUsersListProps {
  role: 'alumno' | 'profesor';
}

export const AdminUsersList: React.FC<AdminUsersListProps> = ({ role }) => {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

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

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const codeMatch = (u.code || '').toLowerCase().includes(q);
      const nameMatch = (u.first_names || '').toLowerCase().includes(q);
      const lastMatch = (u.last_names || '').toLowerCase().includes(q);
      const fullMatch = `${u.first_names || ''} ${u.last_names || ''}`.toLowerCase().includes(q);
      return codeMatch || nameMatch || lastMatch || fullMatch;
    });
  }, [users, searchQuery]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 ucv-animate-in">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
              role === 'profesor'
                ? 'bg-red-50 border-red-100 text-[#C8102E]'
                : 'bg-blue-50 border-blue-100 text-[#1F5FA8]'
            }`}>
              <RoleIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#0B2A5B] tracking-tight">
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
            className="p-2 text-slate-600 hover:text-[#0B2A5B] bg-white border border-slate-200/90 hover:bg-slate-50 rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
            title="Recargar lista"
            aria-label="Recargar lista"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#C8102E]' : 'text-[#1F5FA8]'}`} />
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className={`px-4 py-2 text-white text-xs sm:text-sm font-bold rounded-xl shadow-sm transition-all duration-150 active:scale-[0.98] flex items-center gap-2 cursor-pointer ${
              role === 'profesor'
                ? 'bg-[#C8102E] hover:bg-[#A50D25]'
                : 'bg-[#1F5FA8] hover:bg-[#0B2A5B]'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo {roleSingle}</span>
          </button>
        </div>
      </div>

      <div className="ucv-card rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-xl">

          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              placeholder={`Buscar por código, nombres o apellidos...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 bg-slate-50/70 focus:bg-white rounded-xl focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]/30 focus:border-[#1F5FA8] transition-all"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
          <span>Registros: <strong className="text-[#0B2A5B] font-mono">{filteredUsers.length}</strong> de <span className="font-mono">{users.length}</span></span>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center gap-2.5 ucv-slide-down">
          <AlertCircle className="w-5 h-5 text-[#C8102E] shrink-0" />
          <div className="font-semibold">{error}</div>
        </div>
      )}

      <div className="ucv-card rounded-2xl overflow-hidden">
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
              {searchQuery
                ? 'No se encontraron coincidencias'
                : `No hay ${roleTitle.toLowerCase()} registrados`}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 leading-relaxed">
              {searchQuery
                ? `No existen ${roleTitle.toLowerCase()} que coincidan con la búsqueda.`
                : `Aún no se han registrado perfiles de ${roleTitle.toLowerCase()} en la base de datos de Supabase. Utiliza el botón "Nuevo ${roleSingle}" para registrar uno.`}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="mt-4 px-4 py-2 bg-[#1F5FA8] hover:bg-[#0B2A5B] text-white text-xs font-bold rounded-xl shadow-xs transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                Registrar primer {roleSingle}
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-slate-600 uppercase tracking-wider font-bold text-[10px]">
                <tr>
                  <th scope="col" className="px-6 py-3.5">Código</th>
                  <th scope="col" className="px-6 py-3.5">Nombres</th>
                  <th scope="col" className="px-6 py-3.5">Apellidos</th>
                  {role === 'profesor' && (
                    <th scope="col" className="px-6 py-3.5">Rol</th>
                  )}
                  <th scope="col" className="px-6 py-3.5">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredUsers.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/90 transition-colors">

                    <td className="px-6 py-3.5 font-mono font-bold text-[#0B2A5B]">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                        {item.code}
                      </span>
                    </td>

                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      {item.first_names}
                    </td>

                    <td className="px-6 py-3.5 font-semibold text-slate-900">
                      {item.last_names}
                    </td>

                    {role === 'profesor' && (
                      <td className="px-6 py-3.5 capitalize text-slate-600">
                        {item.role}
                      </td>
                    )}

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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
