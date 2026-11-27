import React, { useState, useEffect } from 'react';
import {
  Shield,
  GraduationCap,
  Users,
  Eye,
  EyeOff,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  HelpCircle,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { UserRole } from '../types';

const REMEMBER_CODE_KEY = 'ucvgo_saved_code';
const REMEMBER_ROLE_KEY = 'ucvgo_saved_role';

export const LoginScreen: React.FC = () => {
  const { login, authError, setAuthError } = useAuth();

  const [selectedRole, setSelectedRole] = useState<UserRole>(() => {
    if (typeof window === 'undefined') return 'administrador';
    const saved = window.localStorage.getItem(REMEMBER_ROLE_KEY);
    if (saved === 'administrador' || saved === 'profesor' || saved === 'alumno') {
      return saved;
    }
    return 'administrador';
  });

  const [code, setCode] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return window.localStorage.getItem(REMEMBER_CODE_KEY) || '';
  });

  const [rememberCode, setRememberCode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(window.localStorage.getItem(REMEMBER_CODE_KEY));
  });

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showHelpNote, setShowHelpNote] = useState(false);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!rememberCode) {
      window.localStorage.removeItem(REMEMBER_CODE_KEY);
      window.localStorage.removeItem(REMEMBER_ROLE_KEY);
    }
  }, [rememberCode]);

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setAuthError(null);
  };

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const clean = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCode(clean);
    if (authError) setAuthError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code || code.length !== 8) {
      setAuthError('El código universitario debe tener exactamente 8 dígitos numéricos.');
      return;
    }

    if (!password) {
      setAuthError('Por favor ingresa tu contraseña.');
      return;
    }

    if (typeof window !== 'undefined') {
      if (rememberCode) {
        window.localStorage.setItem(REMEMBER_CODE_KEY, code);
        window.localStorage.setItem(REMEMBER_ROLE_KEY, selectedRole);
      } else {
        window.localStorage.removeItem(REMEMBER_CODE_KEY);
        window.localStorage.removeItem(REMEMBER_ROLE_KEY);
      }
    }

    setLoading(true);
    try {
      await login(code, password, selectedRole);
    } finally {
      setLoading(false);
    }
  };

  const roles: {
    id: UserRole;
    title: string;
    subtitle: string;
    icon: React.FC<{ className?: string; strokeWidth?: number }>;
  }[] = [
    {
      id: 'administrador',
      title: 'Administrador',
      subtitle: 'Gestión y control',
      icon: Shield,
    },
    {
      id: 'profesor',
      title: 'Docente',
      subtitle: 'Gestión académica',
      icon: GraduationCap,
    },
    {
      id: 'alumno',
      title: 'Estudiante',
      subtitle: 'Accede a tus cursos',
      icon: Users,
    },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#F4F7FC] flex flex-col justify-center items-center p-4 sm:p-6 lg:p-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#0B2A5B]/[0.06] blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full bg-[#1F5FA8]/[0.07] blur-3xl" />
        <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#C8102E]/[0.05] blur-3xl" />
      </div>

      <main className="relative z-10 w-full max-w-[960px] ucv-animate-in">
        <div className="rounded-[24px] overflow-hidden bg-white border border-slate-200/90 shadow-[0_24px_60px_-15px_rgba(11,42,91,0.22)] grid grid-cols-1 lg:grid-cols-12">

          <aside className="lg:col-span-5 relative overflow-hidden bg-[#082047] text-white px-7 py-9 sm:px-9 sm:py-12 flex flex-col items-center justify-center text-center min-h-[250px] lg:min-h-[540px]">
            <div
              className="pointer-events-none absolute inset-0 bg-[url('/assets/aistudio/Edificio_universitario_moderno_en_azul_ab700778.png')] bg-cover bg-center bg-no-repeat"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-[#0B2A5B]/50"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#051636]/95 via-[#082047]/55 to-[#0B2A5B]/30"
              aria-hidden="true"
            />

            <div className="relative z-10 flex flex-col items-center max-w-xs">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-[22px] bg-white p-2.5 shadow-[0_14px_30px_-8px_rgba(0,0,0,0.35)] flex items-center justify-center transition-transform duration-200 hover:scale-[1.02]">
                <img
                  src="/logo-ucvgo.png"
                  alt="Logo de UCVGO"
                  className="w-full h-full object-contain"
                />
              </div>

              <h1 className="mt-5 text-3xl sm:text-4xl font-extrabold tracking-[-0.03em] leading-none drop-shadow-sm">
                <span className="text-white">UCV</span>
                <span className="text-[#EE273E]">GO</span>
              </h1>

              <p className="mt-2.5 text-xs sm:text-[13px] text-white/95 font-medium leading-snug drop-shadow-xs">
                Plataforma de asistencia académica con QR
              </p>

              <div className="w-40 h-1 rounded-full overflow-hidden flex my-4 shadow-2xs" aria-hidden="true">
                <span className="w-1/3 h-full bg-[#1F5FA8]" />
                <span className="w-1/3 h-full bg-white" />
                <span className="w-1/3 h-full bg-[#E61934]" />
              </div>

              <p className="text-sm sm:text-[15px] text-white/95 font-medium tracking-[-0.01em] drop-shadow-xs">
                Tu asistencia, más cerca
              </p>
            </div>
          </aside>

          <section className="lg:col-span-7 bg-white px-6 py-8 sm:px-10 sm:py-10 flex flex-col justify-center">
            <div className="max-w-md w-full mx-auto">
              <div className="text-center mb-6">
                <h2 className="text-2xl sm:text-[26px] font-bold text-[#0B2A5B] tracking-[-0.02em]">
                  Selecciona tu rol
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  Ingresa con tu cuenta según tu perfil
                </p>
              </div>

              {!configured && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 flex items-center gap-2.5 ucv-slide-down">
                  <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0" strokeWidth={1.9} />
                  <span className="text-xs font-medium">
                    No se pudo conectar con el servicio. Contacta al administrador.
                  </span>
                </div>
              )}

              {authError && (
                <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-2.5 ucv-slide-down">
                  <AlertCircle className="w-4 h-4 text-[#C8102E] shrink-0 mt-0.5" strokeWidth={1.9} />
                  <div className="text-xs leading-relaxed">
                    <span className="font-bold block">Atención</span>
                    {authError}
                  </div>
                </div>
              )}

              <div
                role="radiogroup"
                aria-label="Selecciona tu rol institucional"
                className="grid grid-cols-3 gap-2.5 sm:gap-3 mb-6"
              >
                {roles.map((item) => {
                  const Icon = item.icon;
                  const isActive = selectedRole === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={isActive}
                      onClick={() => handleRoleSelect(item.id)}
                      className={`relative rounded-xl p-3 sm:p-3.5 text-center transition-all duration-150 cursor-pointer select-none flex flex-col items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5FA8]/45 ${
                        isActive
                          ? 'border-2 border-[#1F5FA8] bg-[#F4F8FF] shadow-[0_6px_16px_-8px_rgba(31,95,168,0.28)]'
                          : 'border border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/70'
                      }`}
                    >
                      {isActive && (
                        <span
                          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#0B2A5B] text-white border-2 border-white flex items-center justify-center shadow-xs"
                          aria-hidden="true"
                        >
                          <Check className="w-3 h-3" strokeWidth={2.75} />
                        </span>
                      )}

                      <Icon
                        className={`w-6 h-6 sm:w-7 sm:h-7 mb-2 transition-colors ${
                          isActive ? 'text-[#0B2A5B]' : 'text-[#0B2A5B]/85'
                        }`}
                        strokeWidth={1.85}
                        aria-hidden="true"
                      />
                      <span className="text-[12px] sm:text-[13px] font-bold text-[#0B2A5B] leading-tight">
                        {item.title}
                      </span>
                      <span className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5 leading-tight hidden sm:block">
                        {item.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>

              <form onSubmit={handleSubmit} className="space-y-3.5">
                <div>
                  <label htmlFor="user-code" className="sr-only">
                    Código universitario (8 dígitos)
                  </label>
                  <div className="h-12 rounded-xl border border-slate-200/90 bg-[#F8FAFD] focus-within:bg-white focus-within:border-[#1F5FA8] focus-within:ring-2 focus-within:ring-[#1F5FA8]/15 transition-all flex items-center px-3.5">
                    <div className="pr-3 mr-3 border-r border-slate-200/90 text-[#0B2A5B]/75 flex items-center">
                      <User className="w-4 h-4" strokeWidth={1.85} aria-hidden="true" />
                    </div>
                    <input
                      id="user-code"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={8}
                      placeholder="Código universitario (8 dígitos)"
                      value={code}
                      onChange={handleCodeChange}
                      required
                      autoFocus
                      disabled={loading}
                      className="w-full bg-transparent text-sm font-mono tracking-wide text-slate-900 placeholder:font-sans placeholder:tracking-normal placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                    />
                    <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0 ml-2">
                      {code.length}/8
                    </span>
                  </div>
                </div>

                <div>
                  <label htmlFor="user-password" className="sr-only">
                    Contraseña
                  </label>
                  <div className="h-12 rounded-xl border border-slate-200/90 bg-[#F8FAFD] focus-within:bg-white focus-within:border-[#1F5FA8] focus-within:ring-2 focus-within:ring-[#1F5FA8]/15 transition-all flex items-center px-3.5">
                    <div className="pr-3 mr-3 border-r border-slate-200/90 text-[#0B2A5B]/75 flex items-center">
                      <Lock className="w-4 h-4" strokeWidth={1.85} aria-hidden="true" />
                    </div>
                    <input
                      id="user-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Contraseña"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (authError) setAuthError(null);
                      }}
                      required
                      disabled={loading}
                      className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="pl-2 text-slate-400 hover:text-[#0B2A5B] transition-colors cursor-pointer focus-visible:outline-none"
                      aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" strokeWidth={1.85} />
                      ) : (
                        <Eye className="w-4 h-4" strokeWidth={1.85} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5 text-xs">
                  <label className="inline-flex items-center gap-2 text-slate-700 font-medium cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={rememberCode}
                      onChange={(e) => setRememberCode(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-[#0B2A5B] accent-[#0B2A5B] cursor-pointer"
                    />
                    <span>Recordar mi código</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setShowHelpNote((prev) => !prev)}
                    className="text-[#1F5FA8] hover:text-[#0B2A5B] font-medium hover:underline cursor-pointer"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 mt-1 px-5 rounded-xl bg-[#0B2A5B] hover:bg-[#133A78] active:scale-[0.99] text-white text-sm font-semibold tracking-[-0.01em] shadow-[0_10px_22px_-8px_rgba(11,42,91,0.48)] transition-all duration-150 flex items-center justify-center gap-2 disabled:opacity-55 disabled:cursor-not-allowed cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1F5FA8]/45 focus-visible:ring-offset-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" strokeWidth={2} />
                      <span>Validando credenciales...</span>
                    </>
                  ) : (
                    <>
                      <span>Iniciar sesión</span>
                      <ArrowRight className="w-4 h-4" strokeWidth={2} aria-hidden="true" />
                    </>
                  )}
                </button>
              </form>

              {showHelpNote && (
                <div className="mt-4 p-3.5 rounded-xl bg-blue-50/85 border border-blue-200/85 text-xs text-[#0B2A5B] flex items-start gap-2.5 ucv-slide-down">
                  <Info className="w-4 h-4 text-[#1F5FA8] shrink-0 mt-0.5" strokeWidth={1.85} />
                  <div className="space-y-1 leading-relaxed">
                    <p className="font-semibold">Ayuda de acceso institucional</p>
                    <p className="text-slate-600">
                      Para cuentas nuevas, la contraseña inicial es tu mismo código universitario de 8 dígitos. Si olvidaste tu clave o tienes problemas de acceso, comunícate con el administrador del sistema.
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowHelpNote(false)}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F5FA8] hover:text-[#0B2A5B] cursor-pointer pt-0.5"
                    >
                      <ArrowLeft className="w-3 h-3" strokeWidth={2} />
                      Ocultar aviso
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                <HelpCircle className="w-4 h-4 text-[#1F5FA8] shrink-0" strokeWidth={1.85} aria-hidden="true" />
                <span>¿Problemas de acceso?</span>
                <button
                  type="button"
                  onClick={() => setShowHelpNote(true)}
                  className="font-semibold text-[#1F5FA8] hover:text-[#0B2A5B] hover:underline cursor-pointer"
                >
                  Contacta al administrador
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};
