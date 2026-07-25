'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
import { DEFAULT_TIMEZONE } from './datetime';
import { CompanyRecord } from './types';

interface CompanyContextValue {
  company: CompanyRecord | null;
  /** Fuso da empresa logada, com fallback documentado enquanto carrega/falha. */
  timezone: string;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextValue>({
  company: null,
  timezone: DEFAULT_TIMEZONE,
  loading: true,
});

export function CompanyProvider({ children }: { children: React.ReactNode }) {
  const [company, setCompany] = useState<CompanyRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<CompanyRecord>('/companies/me')
      .then(setCompany)
      .catch(() => setCompany(null))
      .finally(() => setLoading(false));
  }, []);

  return (
    <CompanyContext.Provider
      value={{ company, timezone: company?.timezone ?? DEFAULT_TIMEZONE, loading }}
    >
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
