import React from 'react';
import { User, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const StudentTeacherDashboard: React.FC = () => {
  const { profile } = useAuth();

  if (!profile) return null;

  const roleLabel =
    profile.role === 'profesor'
      ? 'Profesor / Docente'
      : profile.role === 'alumno'
      ? 'Alumno / Estudiante'
      : 'Administrador';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Title area */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[#0B2A5B]">
          Bienvenido(a), {profile.first_names}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Plataforma de asistencia académica con QR
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full bg-[#EEF2F7] border-2 border-blue-200 flex items-center justify-center text-[#1F5FA8] shadow-inner">
              <User className="w-12 h-12 text-[#1F5FA8]" />
            </div>
            {profile.active && (
              <span
                className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full flex items-center justify-center text-white"
                title="Cuenta Activa"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
              </span>
            )}
          </div>

          <h2 className="text-base font-bold text-slate-900 uppercase tracking-tight">
            {profile.first_names} {profile.last_names}
          </h2>
          <div className="mt-1 font-mono text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
            Código: {profile.code}
          </div>

          <div className="w-full mt-6 pt-5 border-t border-slate-100 space-y-3 text-left text-xs">
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Rol Institucional:</span>
              <span className="font-bold text-[#1F5FA8]">{roleLabel}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-slate-500 font-medium">Estado de la cuenta:</span>
              <span className="inline-flex items-center gap-1 font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <CheckCircle2 className="w-3.5 h-3.5" /> Activo
              </span>
            </div>
          </div>
        </div>

        {/* Informative notice card */}
        <div className="md:col-span-2 space-y-5">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
            <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1F5FA8] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Información del Perfil</h3>
                <span className="text-[11px] text-slate-500">Credenciales verificadas</span>
              </div>
            </div>

            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
              <p className="text-xs leading-relaxed">
                Tu cuenta y credenciales universitarias están activas en la plataforma institucional.
                Utiliza las opciones del menú superior para acceder a tus módulos y registrar asistencia.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
