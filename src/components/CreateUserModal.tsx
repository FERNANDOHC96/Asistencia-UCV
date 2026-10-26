import React, { useState } from 'react';
import { X, UserPlus, Hash, User, Mail, AlertCircle, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { createUserViaEdgeFunction, getErrorMessageForCode } from '../services/userService';
import { CreateUserPayload } from '../types';

interface CreateUserModalProps {
  isOpen: boolean;
  role: 'alumno' | 'profesor';
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateUserModal: React.FC<CreateUserModalProps> = ({
  isOpen,
  role,
  onClose,
  onSuccess,
}) => {
  const [code, setCode] = useState('');
  const [firstNames, setFirstNames] = useState('');
  const [lastNames, setLastNames] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const roleLabel = role === 'alumno' ? 'Alumno' : 'Profesor';

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permitir hasta 8 dígitos numéricos
    const clean = e.target.value.replace(/\D/g, '').slice(0, 8);
    setCode(clean);
  };

  const resetForm = () => {
    setCode('');
    setFirstNames('');
    setLastNames('');
    setEmail('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanCode = code.trim();
    const cleanFirstNames = firstNames.trim();
    const cleanLastNames = lastNames.trim();
    const cleanEmail = email.trim();

    // Validaciones en pantalla
    if (cleanCode.length !== 8) {
      setErrorMsg('El código universitario debe tener exactamente 8 dígitos numéricos.');
      return;
    }

    if (!cleanFirstNames) {
      setErrorMsg('Debe ingresar los nombres del usuario.');
      return;
    }

    if (!cleanLastNames) {
      setErrorMsg('Debe ingresar los apellidos del usuario.');
      return;
    }

    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setErrorMsg('El formato del correo electrónico no es válido.');
      return;
    }

    setLoading(true);

    try {
      const payload: CreateUserPayload = {
        code: cleanCode,
        first_names: cleanFirstNames,
        last_names: cleanLastNames,
        role,
        email: cleanEmail || undefined,
      };

      const result = await createUserViaEdgeFunction(payload);

      if (result.code === 'success') {
        setSuccessMsg(
          `¡Usuario registrado exitosamente! La contraseña inicial es su código: ${cleanCode}`
        );
        onSuccess();
        setTimeout(() => {
          handleClose();
        }, 1800);
      } else {
        const readable = getErrorMessageForCode(result.code, result.error);
        setErrorMsg(readable);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al procesar la solicitud.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="bg-[#0B2A5B] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <UserPlus className="w-5 h-5 text-red-400" />
            <h3 className="text-base font-bold">Nuevo {roleLabel}</h3>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-slate-300 hover:text-white transition-colors p-1 rounded-md"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Important Notice about initial password */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs flex items-start gap-2.5">
            <KeyRound className="w-4 h-4 text-[#1F5FA8] shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Contraseña inicial:</span>
              <p className="mt-0.5 text-blue-800">
                La contraseña inicial del {roleLabel.toLowerCase()} será su mismo código universitario (8 dígitos).
              </p>
            </div>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-semibold leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* Código */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="create-code"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
              >
                Código Universitario *
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
                id="create-code"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder="Ej: 70029538"
                value={code}
                onChange={handleCodeChange}
                required
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 text-sm font-mono tracking-wider border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-transparent"
              />
            </div>
          </div>

          {/* Nombres */}
          <div>
            <label
              htmlFor="create-first-names"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1"
            >
              Nombres *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="create-first-names"
                type="text"
                placeholder="Ej: Carlos Eduardo"
                value={firstNames}
                onChange={(e) => setFirstNames(e.target.value)}
                required
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-transparent"
              />
            </div>
          </div>

          {/* Apellidos */}
          <div>
            <label
              htmlFor="create-last-names"
              className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1"
            >
              Apellidos *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                id="create-last-names"
                type="text"
                placeholder="Ej: Mendoza Ramos"
                value={lastNames}
                onChange={(e) => setLastNames(e.target.value)}
                required
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-transparent"
              />
            </div>
          </div>

          {/* Correo (opcional) */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label
                htmlFor="create-email"
                className="block text-xs font-bold text-slate-700 uppercase tracking-wide"
              >
                Correo Electrónico
              </label>
              <span className="text-[11px] text-slate-400">Opcional</span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                id="create-email"
                type="email"
                placeholder="usuario@ucvvirtual.edu.pe"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1F5FA8] focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || code.length !== 8 || !firstNames.trim() || !lastNames.trim()}
              className="px-4 py-2 text-xs font-bold text-white bg-[#1F5FA8] hover:bg-[#174B88] rounded-lg transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Registrando...</span>
                </>
              ) : (
                <span>Crear {roleLabel}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
