import React from 'react';
import { useI18n, LANGUAGE_NAMES } from '@/lib/i18n';

export default function LanguageSelector({ className = '' }: { className?: string }) {
  const { lang, setLang, available, t } = useI18n();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="text-xs font-medium opacity-90 hidden sm:inline">🌐 {t('languageLabel') || 'Language'}:</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as any)}
        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-neutral-800 font-medium text-xs sm:text-sm shadow-sm focus:ring-2 focus:ring-green-500 focus:outline-none cursor-pointer"
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
