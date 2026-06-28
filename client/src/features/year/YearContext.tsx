import { createContext, useContext, useState, type ReactNode } from 'react';

const CURRENT_YEAR = new Date().getFullYear();

interface YearCtx {
  year: number | null; // null = all time
  setYear: (y: number | null) => void;
}

const Ctx = createContext<YearCtx>({ year: CURRENT_YEAR, setYear: () => {} });

export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState<number | null>(CURRENT_YEAR);
  return <Ctx.Provider value={{ year, setYear }}>{children}</Ctx.Provider>;
}

export function useYear() {
  return useContext(Ctx);
}
