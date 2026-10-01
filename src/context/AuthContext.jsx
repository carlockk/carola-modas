import { createContext, useContext, useState, useEffect } from 'react';
import { SESSION_EXPIRED_EVENT } from '../services/api';

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

const decodeJwtExpMs = (token) => {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const payload = JSON.parse(atob(padded));
    const exp = Number(payload?.exp);
    if (!Number.isFinite(exp)) return null;
    return exp * 1000;
  } catch {
    return null;
  }
};

const clearSessionStorage = () => {
  localStorage.removeItem('usuario');
  localStorage.removeItem('localSeleccionado');
};

const readStoredSession = () => {
  const emptySession = { usuario: null, selectedLocal: null, sessionDeadline: null };
  try {
    const stored = localStorage.getItem('usuario');
    if (!stored) return emptySession;
    const usuario = JSON.parse(stored);
    const sessionDeadline = decodeJwtExpMs(usuario?.token);
    if (!usuario?.token || (sessionDeadline && sessionDeadline <= Date.now())) {
      clearSessionStorage();
      return emptySession;
    }
    const selectedLocal = usuario?.rol && usuario.rol !== 'superadmin'
      ? usuario.local || null
      : JSON.parse(localStorage.getItem('localSeleccionado') || 'null');
    return { usuario, selectedLocal, sessionDeadline };
  } catch {
    clearSessionStorage();
    return emptySession;
  }
};

export function AuthProvider({ children }) {
  const [initialSession] = useState(readStoredSession);
  const [usuario, setUsuario] = useState(initialSession.usuario);
  const [selectedLocal, setSelectedLocal] = useState(initialSession.selectedLocal);
  const [sessionDeadline, setSessionDeadline] = useState(initialSession.sessionDeadline);

  const login = (data) => {
    setUsuario(data);
    localStorage.setItem('usuario', JSON.stringify(data)); // ✅ Incluye nombre
    setSessionDeadline(decodeJwtExpMs(data?.token) || null);
    if (data?.rol && data.rol !== 'superadmin') {
      setSelectedLocal(data.local || null);
      localStorage.setItem('localSeleccionado', JSON.stringify(data.local || null));
    } else {
      setSelectedLocal(null);
      localStorage.removeItem('localSeleccionado');
    }
  };

  const seleccionarLocal = (local) => {
    setSelectedLocal(local || null);
    if (local) {
      localStorage.setItem('localSeleccionado', JSON.stringify(local));
    } else {
      localStorage.removeItem('localSeleccionado');
    }
  };

  const logout = () => {
    setUsuario(null);
    clearSessionStorage();
    setSelectedLocal(null);
    setSessionDeadline(null);
  };

  useEffect(() => {
    if (!sessionDeadline) return undefined;
    const msLeft = sessionDeadline - Date.now();
    if (msLeft <= 0) {
      logout();
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      logout();
    }, msLeft);
    return () => window.clearTimeout(timeoutId);
  }, [sessionDeadline]);

  useEffect(() => {
    const onSessionExpired = () => logout();
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  return (
    <AuthContext.Provider value={{ usuario, login, logout, selectedLocal, seleccionarLocal }}>
      {children}
    </AuthContext.Provider>
  );
}
