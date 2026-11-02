import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Check,
  Save,
  Sliders,
  Eye,
  Lock,
  Info,
  X
} from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';

interface FaceSettingsCardProps {
  registeredCount: number;
  activeStudentsCount: number;
  onSettingsChanged?: () => void;
}

export const FaceSettingsCard: React.FC<FaceSettingsCardProps> = ({
  registeredCount,
  activeStudentsCount,
  onSettingsChanged,
}) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Claves de settings
  const [faceRequired, setFaceRequired] = useState<boolean>(false);
  const [enrollmentSupervised, setEnrollmentSupervised] = useState<boolean>(false);

  // Umbrales biométricos
  const [threshold, setThreshold] = useState<string>('0.60');
  const [thresholdTurn, setThresholdTurn] = useState<string>('0.50');
  const [pairMin, setPairMin] = useState<string>('0.55');
  const [pairMax, setPairMax] = useState<string>('0.97');

  const [savingThresholds, setSavingThresholds] = useState<boolean>(false);
  const [thresholdsError, setThresholdsError] = useState<string | null>(null);

  // Modal de confirmación para "Exigir verificación facial"
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [savingFaceRequired, setSavingFaceRequired] = useState<boolean>(false);
  const [savingSupervised, setSavingSupervised] = useState<boolean>(false);

  // Helper para actualizar o insertar en la tabla settings con valor JSON
  const saveSettingRow = async (key: string, value: any) => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('settings')
      .update({ value })
      .eq('key', key)
      .select('key');

    if (error) throw error;

    if (!data || data.length === 0) {
      const { error: insErr } = await supabase
        .from('settings')
        .insert({ key, value });
      if (insErr) throw insErr;
    }
  };

  // 1. Cargar configuración de settings
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setGeneralError(null);

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', [
          'face_required',
          'face_threshold',
          'face_threshold_turn',
          'face_pair_min',
          'face_pair_max',
          'enrollment_supervised',
        ]);

      if (error) throw error;

      if (data) {
        const map: Record<string, any> = {};
        data.forEach((row: any) => {
          map[row.key] = row.value;
        });

        if (map.face_required !== undefined && map.face_required !== null) {
          setFaceRequired(Boolean(map.face_required));
        } else {
          setFaceRequired(false);
        }

        if (map.enrollment_supervised !== undefined && map.enrollment_supervised !== null) {
          setEnrollmentSupervised(Boolean(map.enrollment_supervised));
        } else {
          setEnrollmentSupervised(false);
        }

        if (map.face_threshold !== undefined && map.face_threshold !== null) {
          setThreshold(String(map.face_threshold));
        } else {
          setThreshold('0.60');
        }

        if (map.face_threshold_turn !== undefined && map.face_threshold_turn !== null) {
          setThresholdTurn(String(map.face_threshold_turn));
        } else {
          setThresholdTurn('0.50');
        }

        if (map.face_pair_min !== undefined && map.face_pair_min !== null) {
          setPairMin(String(map.face_pair_min));
        } else {
          setPairMin('0.55');
        }

        if (map.face_pair_max !== undefined && map.face_pair_max !== null) {
          setPairMax(String(map.face_pair_max));
        } else {
          setPairMax('0.97');
        }
      }
    } catch (err: any) {
      setGeneralError(translateSupabaseError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // a) Manejar interruptor "Exigir verificación facial al marcar asistencia"
  const handleToggleFaceRequired = (checked: boolean) => {
    setGeneralError(null);
    setSuccessMessage(null);

    if (checked) {
      // Al activarlo, confirmar primero con X de Y
      setIsConfirmModalOpen(true);
    } else {
      // Al desactivarlo, vuelve a como estaba de inmediato
      applyFaceRequired(false);
    }
  };

  const applyFaceRequired = async (newValue: boolean) => {
    setSavingFaceRequired(true);
    setGeneralError(null);

    try {
      await saveSettingRow('face_required', newValue);
      setFaceRequired(newValue);
      setSuccessMessage(
        newValue
          ? 'Verificación facial activada como obligatoria para marcar asistencia.'
          : 'Verificación facial configurada como opcional.'
      );
      if (onSettingsChanged) onSettingsChanged();
    } catch (err: any) {
      setGeneralError(translateSupabaseError(err));
    } finally {
      setSavingFaceRequired(false);
      setIsConfirmModalOpen(false);
    }
  };

  // b) Guardar umbrales numéricos con validación
  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    setThresholdsError(null);
    setGeneralError(null);
    setSuccessMessage(null);

    const t = parseFloat(threshold);
    const tt = parseFloat(thresholdTurn);
    const pMin = parseFloat(pairMin);
    const pMax = parseFloat(pairMax);

    // Validación numérica entre 0 y 1
    if (isNaN(t) || t < 0 || t > 1) {
      setThresholdsError('El umbral general debe ser un número entre 0 y 1.');
      return;
    }
    if (isNaN(tt) || tt < 0 || tt > 1) {
      setThresholdsError('El umbral con giro debe ser un número entre 0 y 1.');
      return;
    }
    if (isNaN(pMin) || pMin < 0 || pMin > 1) {
      setThresholdsError('El umbral mínimo de par debe ser un número entre 0 y 1.');
      return;
    }
    if (isNaN(pMax) || pMax < 0 || pMax > 1) {
      setThresholdsError('El umbral máximo de par debe ser un número entre 0 y 1.');
      return;
    }
    // face_pair_min menor que face_pair_max
    if (pMin >= pMax) {
      setThresholdsError('El umbral mínimo de par (face_pair_min) debe ser menor que el umbral máximo de par (face_pair_max).');
      return;
    }

    setSavingThresholds(true);
    try {
      // Guardar cada clave como valor numérico JSON
      await saveSettingRow('face_threshold', t);
      await saveSettingRow('face_threshold_turn', tt);
      await saveSettingRow('face_pair_min', pMin);
      await saveSettingRow('face_pair_max', pMax);

      setSuccessMessage('Umbrales de reconocimiento facial guardados correctamente en Supabase.');
      if (onSettingsChanged) onSettingsChanged();
    } catch (err: any) {
      setThresholdsError(translateSupabaseError(err));
    } finally {
      setSavingThresholds(false);
    }
  };

  // c) Interruptor "Supervisar el registro del rostro" (enrollment_supervised)
  const handleToggleSupervised = async (checked: boolean) => {
    setSavingSupervised(true);
    setGeneralError(null);
    setSuccessMessage(null);

    try {
      await saveSettingRow('enrollment_supervised', checked);
      setEnrollmentSupervised(checked);
      setSuccessMessage(
        checked
          ? 'Supervisión de registro activada.'
          : 'Supervisión de registro desactivada (modo abierto).'
      );
      if (onSettingsChanged) onSettingsChanged();
    } catch (err: any) {
      setGeneralError(translateSupabaseError(err));
    } finally {
      setSavingSupervised(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden space-y-5 p-5">
      {/* Cabecera del Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1F5FA8] flex items-center justify-center font-bold">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-[#0B2A5B] flex items-center gap-2">
              <span>Ajustes de Rostro</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Políticas institucionales de verificación facial y calibración biométrica
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={loadSettings}
          disabled={loading}
          className="self-start sm:self-auto px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          title="Recargar configuración"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#1F5FA8]' : ''}`} />
          <span>Actualizar ajustes</span>
        </button>
      </div>

      {/* Banner de Feedback Global */}
      {generalError && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-900 text-xs flex items-start gap-2.5 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 font-semibold">{generalError}</div>
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center justify-between gap-2.5 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda (7 cols): Interruptores y Políticas */}
        <div className="lg:col-span-7 space-y-4">
          {/* Interruptor A: Exigir verificación facial al marcar asistencia */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#1F5FA8]" />
                  <label htmlFor="toggle-face-required" className="text-xs font-bold text-slate-900 cursor-pointer">
                    Exigir verificación facial al marcar asistencia
                  </label>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Si se activa, los estudiantes deben verificar su rostro obligatoriamente para validar su asistencia en QR o Bluetooth.
                </p>
                <div className="pt-1 flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-500">
                    Alumnos con rostro registrado:
                  </span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-white border border-slate-200 text-[#0B2A5B]">
                    {registeredCount} de {activeStudentsCount}
                  </span>
                </div>
              </div>

              {/* Toggle switch */}
              <button
                id="toggle-face-required"
                type="button"
                role="switch"
                aria-checked={faceRequired}
                disabled={loading || savingFaceRequired}
                onClick={() => handleToggleFaceRequired(!faceRequired)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8] disabled:opacity-50 ${
                  faceRequired ? 'bg-[#1F5FA8]' : 'bg-slate-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    faceRequired ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Interruptor C: Supervisar el registro del rostro */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-600" />
                  <label htmlFor="toggle-supervised" className="text-xs font-bold text-slate-900 cursor-pointer">
                    Supervisar el registro del rostro
                  </label>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Si se activa, el registro necesita permiso previo. En esta prueba abierta debe quedar apagado.
                </p>
              </div>

              {/* Toggle switch */}
              <button
                id="toggle-supervised"
                type="button"
                role="switch"
                aria-checked={enrollmentSupervised}
                disabled={loading || savingSupervised}
                onClick={() => handleToggleSupervised(!enrollmentSupervised)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-indigo-600 disabled:opacity-50 ${
                  enrollmentSupervised ? 'bg-indigo-600' : 'bg-slate-300'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    enrollmentSupervised ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Columna Derecha (5 cols): Umbrales Biométricos */}
        <div className="lg:col-span-5 bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Sliders className="w-4 h-4 text-[#1F5FA8]" />
              <span>Umbrales de Coincidencia</span>
            </div>
            <span className="text-[10px] uppercase font-bold text-slate-400">0.00 – 1.00</span>
          </div>

          {thresholdsError && (
            <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg text-red-900 text-xs font-semibold">
              {thresholdsError}
            </div>
          )}

          <form onSubmit={handleSaveThresholds} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  face_threshold
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  required
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">General / Frontal</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  face_threshold_turn
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  required
                  value={thresholdTurn}
                  onChange={(e) => setThresholdTurn(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Giro de cabeza</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  face_pair_min
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  required
                  value={pairMin}
                  onChange={(e) => setPairMin(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Mínimo de par</span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  face_pair_max
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  required
                  value={pairMax}
                  onChange={(e) => setPairMax(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-[#1F5FA8]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">Máximo de par</span>
              </div>
            </div>

            {/* Texto de ayuda obligatorio */}
            <div className="p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-[11px] text-blue-900 flex items-start gap-2">
              <Info className="w-3.5 h-3.5 text-[#1F5FA8] shrink-0 mt-0.5" />
              <p>
                Valores iniciales: 0,60 / 0,50 / 0,55 / 0,97. Se ajustan con datos reales del grupo.
              </p>
            </div>

            <button
              type="submit"
              disabled={savingThresholds || loading}
              className="w-full py-2 px-3 bg-[#1F5FA8] hover:bg-[#0B2A5B] disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              {savingThresholds ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>{savingThresholds ? 'Guardando umbrales...' : 'Guardar umbrales'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Modal de Confirmación: Exigir verificación facial */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                ¿Exigir verificación facial?
              </h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                Los alumnos sin rostro registrado no podrán marcar con QR ni Bluetooth.
              </p>
              <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded-xl inline-block">
                <span className="text-xs font-bold text-[#0B2A5B]">
                  Registrados: {registeredCount} de {activeStudentsCount}.
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={savingFaceRequired}
                className="flex-1 py-2 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => applyFaceRequired(true)}
                disabled={savingFaceRequired}
                className="flex-1 py-2 px-3 bg-[#1F5FA8] hover:bg-[#0B2A5B] disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {savingFaceRequired ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : null}
                <span>Sí, exigir verificación</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
