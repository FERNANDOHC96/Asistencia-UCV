import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import { Profile, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  authError: string | null;
  setAuthError: (err: string | null) => void;
  login: (code: string, password: string, intendedRole: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Equivalencia entre la tarjeta seleccionada y el valor de rol guardado en la base de datos (profiles.role)
const CARD_TO_DB_ROLE: Record<UserRole, 'admin' | 'profesor' | 'alumno'> = {
  administrador: 'admin',
  profesor: 'profesor',
  alumno: 'alumno',
};

// Equivalencia inversa para mapear el rol de la base de datos al tipo de rol de la interfaz
const DB_TO_CARD_ROLE: Record<string, UserRole> = {
  admin: 'administrador',
  profesor: 'profesor',
  alumno: 'alumno',
};

const DB_ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  profesor: 'Profesor',
  alumno: 'Alumno',
};

const CARD_ROLE_LABELS: Record<UserRole, string> = {
  administrador: 'Administrador',
  profesor: 'Profesor',
  alumno: 'Alumno',
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchProfileForUser = useCallback(async (userId: string): Promise<Profile | null> => {
    if (!isSupabaseConfigured()) {
      return null;
    }
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, code, first_names, last_names, role, active')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      throw error;
    }

    if (!data) return null;

    return {
      ...data,
      role: DB_TO_CARD_ROLE[data.role] || (data.role as UserRole),
    } as Profile;
  }, []);

  const logout = useCallback(async () => {
    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  }, []);

  // Verificar sesión existente al cargar la aplicación
  useEffect(() => {
    let isMounted = true;

    async function checkCurrentSession() {
      if (!isSupabaseConfigured()) {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const supabase = getSupabaseClient();
        const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

        if (sessionErr) {
          console.warn('Error reading session:', sessionErr.message);
          if (isMounted) setLoading(false);
          return;
        }

        if (session?.user) {
          const prof = await fetchProfileForUser(session.user.id);
          if (isMounted) {
            if (prof && prof.active) {
              setUser(session.user);
              setProfile(prof);
            } else if (prof && !prof.active) {
              await supabase.auth.signOut();
              setUser(null);
              setProfile(null);
              setAuthError('Tu cuenta se encuentra inactiva.');
            } else {
              setUser(null);
              setProfile(null);
            }
          }
        }
      } catch (err) {
        console.warn('Error during session bootstrap:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    checkCurrentSession();

    return () => {
      isMounted = false;
    };
  }, [fetchProfileForUser]);

  const login = async (code: string, password: string, intendedRole: UserRole): Promise<boolean> => {
    setAuthError(null);

    if (!isSupabaseConfigured()) {
      setAuthError('No se pudo conectar con el servicio. Contacta al administrador.');
      return false;
    }

    const trimmedCode = code.trim();
    if (!/^\d{8}$/.test(trimmedCode)) {
      setAuthError('El código universitario debe tener exactamente 8 dígitos numéricos.');
      return false;
    }

    if (!password) {
      setAuthError('Debe ingresar su contraseña.');
      return false;
    }

    try {
      const supabase = getSupabaseClient();
      const email = `${trimmedCode}@asisqr.local`;

      // 1. Inicio de sesión en Supabase Auth
      const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          setAuthError('Credenciales incorrectas. Verifique su código universitario y contraseña.');
        } else if (
          signInError.message.includes('Failed to fetch') ||
          signInError.message.includes('NetworkError') ||
          signInError.message.includes('fetch failed') ||
          signInError.message.toLowerCase().includes('apikey') ||
          signInError.message.toLowerCase().includes('invalid api key')
        ) {
          setAuthError('No se pudo conectar con el servicio. Contacta al administrador.');
        } else {
          setAuthError(`Error de autenticación: ${signInError.message}`);
        }
        return false;
      }

      if (!authData.user) {
        setAuthError('No se pudo verificar la sesión del usuario.');
        return false;
      }

      // 2. Leer rol y estado real desde la tabla "profiles"
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, code, first_names, last_names, role, active')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        await supabase.auth.signOut();
        setAuthError(`Error al consultar el perfil del usuario: ${profileError.message}`);
        return false;
      }

      if (!profileData) {
        await supabase.auth.signOut();
        setAuthError('No se encontró un perfil universitario asociado a este usuario.');
        return false;
      }

      // 3. Validar si la cuenta está activa
      if (!profileData.active) {
        await supabase.auth.signOut();
        setAuthError('Su cuenta se encuentra inactiva. Comuníquese con la administración universitaria.');
        return false;
      }

      // 4. Validar que el rol real coincida con la tarjeta seleccionada usando la equivalencia
      const expectedDbRole = CARD_TO_DB_ROLE[intendedRole];
      if (profileData.role !== expectedDbRole) {
        await supabase.auth.signOut();
        const actualRoleName = DB_ROLE_LABELS[profileData.role] || profileData.role;
        const intendedRoleName = CARD_ROLE_LABELS[intendedRole] || intendedRole;
        setAuthError(
          `Acceso denegado: Su cuenta tiene el rol de "${actualRoleName}", pero seleccionó el perfil de "${intendedRoleName}". Seleccione el perfil correcto.`
        );
        return false;
      }

      const activeProfile: Profile = {
        ...profileData,
        role: DB_TO_CARD_ROLE[profileData.role] || (profileData.role as UserRole),
      };

      setUser(authData.user);
      setProfile(activeProfile);
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error inesperado durante el inicio de sesión.';
      if (
        msg.includes('Failed to fetch') ||
        msg.includes('NetworkError') ||
        msg.includes('fetch failed') ||
        msg.toLowerCase().includes('apikey')
      ) {
        setAuthError('No se pudo conectar con el servicio. Contacta al administrador.');
      } else {
        setAuthError(msg);
      }
      return false;
    }
  };

  const refreshProfile = async (): Promise<Profile | null> => {
    if (!user) return null;
    try {
      const prof = await fetchProfileForUser(user.id);
      setProfile(prof);
      return prof;
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        authError,
        setAuthError,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
