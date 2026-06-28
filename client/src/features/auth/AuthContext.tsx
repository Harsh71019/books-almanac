import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

type Settings = { yearlyGoal: number; theme: 'night' | 'day' };
type User = { id: string; username: string; displayName: string; settings: Settings };

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
    queryFn: () => api.get<User>('/auth/me').catch(() => null),
    staleTime: 5 * 60_000,
    retry: false
  });

  const loginMut = useMutation({
    mutationFn: ({ username, password }: { username: string; password: string }) =>
      api.post<User>('/auth/login', { username, password }),
    onSuccess: (u) => qc.setQueryData(['me'], u)
  });

  const logoutMut = useMutation({
    mutationFn: () => api.post('/auth/logout', {}),
    onSuccess: () => qc.setQueryData(['me'], null)
  });

  return (
    <Ctx.Provider value={{
      user,
      isLoading,
      login: (username, password) => loginMut.mutateAsync({ username, password }).then(() => {}),
      logout: () => logoutMut.mutateAsync().then(() => {})
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
