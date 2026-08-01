import React from 'react';
import { useI18n, Lang } from '@/lib/i18n';

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export function useLanguage() {
  const { lang, setLang, t } = useI18n();
  return {
    language: lang,
    setLanguage: (l: string) => setLang(l as Lang),
    t,
  };
}
