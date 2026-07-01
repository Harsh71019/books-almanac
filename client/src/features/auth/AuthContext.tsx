import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, tokenStore } from '@/lib/api';

type Settings = { yearlyGoal: number; theme: 'night' | 'day' };
type User = { id: string; username: string; displayName: string; settings: Settings };
type LoginResponse = User & { token: string };

type AuthCtx = {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const { data: user = null, isLoading } = useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      const token = tokenStore.get();
      console.log('[auth] queryFn fired — token in localStorage:', token ? `${token.slice(0, 20)}…` : 'NONE');
      if (!token) return null;
      try {
        const user = await api.get<User>('/auth/me');
        console.log('[auth] /me success:', user);
        return user;
      } catch (e) {
        console.error('[auth] /me error:', e);
        if (e instanceof ApiError && e.status === 401) {
          tokenStore.clear();
          return null;
        }
        throw e;
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const loginMut = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.post<LoginResponse>('/auth/login', { username, password }),
    onSuccess: ({ token, ...u }) => {
      console.log('[auth] login success — storing token, user:', u);
      tokenStore.set(token);
      qc.setQueryData(['me'], u);
    },
  });

  const logoutMut = useMutation({
    mutationFn: () => api.post('/auth/logout', {}),
    onSuccess: () => {
      console.log('[auth] logout success — token cleared');
      tokenStore.clear();
      qc.setQueryData(['me'], null);
    },
  });

  return (
    <Ctx.Provider value={{
      user,
      isLoading,
      login:  (username, password) => loginMut.mutateAsync({ username, password }).then(() => {}),
      logout: () => logoutMut.mutateAsync().then(() => {}),
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
