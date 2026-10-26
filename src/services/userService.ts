import { getSupabaseClient, getSupabaseCredentials, isSupabaseConfigured } from '../lib/supabase';
import { CreateUserPayload, EdgeFunctionResponse } from '../types';

export function getErrorMessageForCode(code: string, fallbackMessage?: string): string {
  switch (code) {
    case 'invalid_code':
      return 'El código universitario debe tener exactamente 8 dígitos numéricos.';
    case 'missing_name':
      return 'Faltan los nombres o apellidos requeridos para el registro.';
    case 'invalid_role':
      return 'El rol especificado es inválido (debe ser "alumno" o "profesor").';
    case 'forbidden':
      return 'Acceso denegado: no cuentas con permisos de Administrador para realizar esta acción.';
    case 'unauthorized':
      return 'Sesión expirada o no autorizada. Por favor, vuelve a iniciar sesión.';
    case 'create_failed':
      return 'No se pudo crear la cuenta de autenticación. Es posible que el código ya esté registrado o exista un conflicto en el servidor.';
    case 'profile_failed':
      return 'Se crearon las credenciales pero ocurrió un error al registrar el perfil en la base de datos.';
    default:
      return fallbackMessage || `Error retornado por el servidor (${code}).`;
  }
}

export async function createUserViaEdgeFunction(
  payload: CreateUserPayload
): Promise<EdgeFunctionResponse> {
  if (!isSupabaseConfigured()) {
    throw new Error('No se pudo conectar con el servicio. Contacta al administrador.');
  }

  const { url, anonKey } = getSupabaseCredentials();
  const supabase = getSupabaseClient();

  // Obtener el token de acceso de la sesión actual
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return {
      code: 'unauthorized',
      error: 'No hay una sesión activa o el token no está disponible. Inicia sesión nuevamente.',
    };
  }

  const token = sessionData.session.access_token;
  const functionUrl = `${url.replace(/\/+$/, '')}/functions/v1/bright-function`;

  const bodyData: Record<string, string> = {
    code: payload.code.trim(),
    first_names: payload.first_names.trim(),
    last_names: payload.last_names.trim(),
    role: payload.role,
  };

  if (payload.email && payload.email.trim()) {
    bodyData.email = payload.email.trim();
  }

  try {
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      body: JSON.stringify(bodyData),
    });

    const responseText = await response.text();
    let data: EdgeFunctionResponse;

    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        code: response.ok ? 'success' : 'create_failed',
        error: `Respuesta del servidor (${response.status}): ${responseText || 'Sin contenido'}`,
      };
    }

    if (!response.ok) {
      const code = data.code || 'create_failed';
      return {
        code,
        error: data.error || data.message || getErrorMessageForCode(code),
      };
    }

    return data;
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Error desconocido al conectar con la Edge Function.';
    return {
      code: 'create_failed',
      error: `Error de red al invocar la función "bright-function": ${errorMessage}`,
    };
  }
}
