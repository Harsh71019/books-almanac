import { createContext, useContext, useState, type ReactNode } from 'react';

const CURRENT_YEAR = new Date().getFullYear();

interface YearCtx {
  year: number;
  setYear: (y: number) => void;
}

const Ctx = createContext<YearCtx>({ year: CURRENT_YEAR, setYear: () => {} });

export function YearProvider({ children }: { children: ReactNode }) {
  const [year, setYear] = useState(CURRENT_YEAR);
  return <Ctx.Provider value={{ year, setYear }}>{children}</Ctx.Provider>;
}

export function useYear() {
  return useContext(Ctx);
}
