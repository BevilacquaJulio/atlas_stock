import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { SESSION_EXPIRED_EVENT } from '../../lib/api';
import { tokenStore } from '../../lib/token-store';
import { financeiroUnlockStore } from '../../lib/financeiro-unlock';
import { queryClient } from '../../app/queryClient';
import { loginRequest, logoutRequest, restoreSession } from './auth.api';
import type { AuthUser } from './auth.types';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  user: AuthUser | null;
  status: Status;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Descarta tudo o que pertence à identidade anterior (tokens, desbloqueio
 * financeiro e cache). Cancela antes de limpar para respostas pendentes da
 * sessão antiga não repovoarem a tela da próxima.
 */
function clearSessionData(): void {
  void queryClient.cancelQueries();
  queryClient.clear();
  tokenStore.clear();
  financeiroUnlockStore.clear();
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  useEffect(() => {
    let active = true;
    async function bootstrap() {
      if (!tokenStore.getRefresh()) {
        setStatus('unauthenticated');
        return;
      }
      try {
        const me = await restoreSession();
        if (!active) return;
        setUser(me);
        setStatus('authenticated');
      } catch {
        if (!active) return;
        clearSessionData();
        setStatus('unauthenticated');
      }
    }
    void bootstrap();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      clearSessionData();
      setUser(null);
      setStatus('unauthenticated');
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handler);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handler);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    const res = await loginRequest(email, senha);
    clearSessionData();
    tokenStore.setAccess(res.accessToken);
    tokenStore.setRefresh(res.refreshToken);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      clearSessionData();
    }
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
