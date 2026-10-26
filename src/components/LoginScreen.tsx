import React, { useState } from 'react';
import { Shield, GraduationCap, Users, Eye, EyeOff, Lock, Hash, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types';

export const LoginScreen: React.FC = () => {
  const { login, authError, setAuthError } = useAuth();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setAuthError(null);
    setCode('');
    setPassword('');
  };

  const handleBackToRoleSelection = () => {
    setSelectedRole(null);
    setAuthError(null);
    setCode('');
    setPassword('');
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir dígitos y longitud máxima de 8
    const clean = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCode(clean);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;

    if (!code || code.length !== 8) {
      setAuthError('El código universitario debe tener exactamente 8 dígitos numéricos.');
      return;
    }

    if (!password) {
      setAuthError('Por favor ingresa tu contraseña.');
      return;
    }

    setLoading(true);
    try {
      await login(code, password, selectedRole);
    } finally {
      setLoading(false);
    }
  };

  const roleMeta: Record<
    UserRole,
    { title: string; subtitle: string; icon: React.ReactNode; color: string; badge: string }
  > = {
    administrador: {
      title: 'Administrador',
      subtitle: 'Gestión global de alumnos, profesores y métricas',
      icon: <Shield className="w-8 h-8 text-[#C8102E]" />,
      color: 'hover:border-[#C8102E]',
      badge: 'Acceso Administrativo',
    },
    profesor: {
      title: 'Profesor',
      subtitle: 'Docentes titulares y auxiliares de cátedra',
      icon: <GraduationCap className="w-8 h-8 text-[#1F5FA8]" />,
      color: 'hover:border-[#1F5FA8]',
      badge: 'Acceso Docente',
    },
    alumno: {
      title: 'Alumno',
      subtitle: 'Estudiantes de pregrado y posgrado',
      icon: <Users className="w-8 h-8 text-emerald-600" />,
      color: 'hover:border-emerald-600',
      badge: 'Acceso Estudiantil',
    },
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#EEF2F7]">
      {/* Top red border accent */}
      <div className="h-1 bg-[#C8102E] w-full" />

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-xl">
          {/* Institutional Header Card */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0B2A5B] text-white shadow-md mb-3">
              <span className="font-extrabold text-2xl tracking-wider">QR</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0B2A5B] tracking-tight">
              AsisQR UCV
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 font-medium mt-1">
              Plataforma de asistencia académica con QR
            </p>
          </div>

          {/* Database connection banner if not configured */}
          {!configured && (
            <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 shadow-xs flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="text-xs font-medium">
                No se pudo conectar con el servicio. Contacta al administrador.
              </span>
            </div>
          )}

          {/* Error Alert */}
          {authError && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 shadow-xs flex items-start gap-3 animate-in fade-in">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs leading-relaxed">
                <span className="font-bold block mb-0.5">Atención</span>
                {authError}
              </div>
            </div>
          )}

          {/* Step 1: Select Role */}
          {!selectedRole ? (
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  Selecciona tu tipo de perfil
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Elige la categoría con la que estás registrado en la universidad
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3.5">
                {(['administrador', 'profesor', 'alumno'] as UserRole[]).map((role) => {
                  const meta = roleMeta[role];
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleSelect(role)}
                      className={`w-full flex items-center p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white text-left transition-all duration-150 shadow-2xs hover:shadow-md group cursor-pointer ${meta.color}`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0 mr-4 group-hover:scale-105 transition-transform">
                        {meta.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-bold text-slate-900 group-hover:text-[#1F5FA8] transition-colors">
                            {meta.title}
                          </h3>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700">
                            {meta.badge}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                          {meta.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center text-xs text-slate-500">
                <span>¿Problemas de acceso? Contacta al administrador.</span>
              </div>
            </div>
          ) : (
            /* Step 2: Login Form */
            <div className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
              {/* Card top banner for selected role */}
              <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                    {roleMeta[selectedRole].icon}
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200">
                      Iniciar sesión como
                    </span>
                    <h2 className="text-base font-bold leading-tight">
                      {roleMeta[selectedRole].title}
                    </h2>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBackToRoleSelection}
                  className="inline-flex items-center gap-1 text-xs text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cambiar
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
                {/* Código universitario */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label
                      htmlFor="user-code"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
                    >
                      Código Universitario
                    </label>
                    <span className="text-[11px] font-mono text-slate-400">
                      {code.length}/8 dígitos
                    </span>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <input
                      id="user-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="Ej: 70029537"
                      value={code}
                      onChange={handleCodeChange}
                      required
                      autoFocus
                      disabled={loading}
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-wider border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-transparent text-slate-800 disabled:bg-slate-50"
                    />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Debe contener exactamente 8 dígitos numéricos.
                  </p>
                </div>

                {/* Contraseña */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label
                      htmlFor="user-password"
                      className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
                    >
                      Contraseña
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      id="user-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="w-full pl-9 pr-11 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-transparent text-slate-800 disabled:bg-slate-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Para cuentas nuevas, la contraseña inicial es tu mismo código universitario.
                  </p>
                </div>

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={loading || code.length !== 8 || !password}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#1F5FA8] hover:bg-[#174B88] text-white text-sm font-bold tracking-wide shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando credenciales...</span>
                    </>
                  ) : (
                    <span>Iniciar sesión</span>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-3 text-[11px] text-slate-500 border-t border-slate-200 bg-white">
        AsisQR UCV · Proyecto universitario, no oficial
      </footer>
    </div>
  );
};
