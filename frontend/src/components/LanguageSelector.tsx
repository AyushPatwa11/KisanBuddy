import React from 'react';
import { useI18n, LANGUAGE_NAMES } from '@/lib/i18n';

export default function LanguageSelector({ className = '' }: { className?: string }) {
  const { lang, setLang, available, t } = useI18n();

  return (
    <div className={`flex items-center gap-2 text-white ${className}`}>
      <span className="hidden text-xs font-medium opacity-85 sm:inline">🌐 {t('languageLabel') || 'Language'}:</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as any)}
        className="cursor-pointer rounded-full border border-white/20 bg-white/95 px-3 py-2 text-xs font-semibold text-emerald-950 shadow-[0_12px_24px_rgba(9,33,18,0.16)] outline-none transition hover:border-white/40 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-200/60 sm:text-sm"
        aria-label="Select language"
      >
        {available.map((code) => (
          <option key={code} value={code}>
            {LANGUAGE_NAMES[code] || code.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  );
}
