import React, { useState, useEffect } from 'react';
import { Globe } from 'lucide-react';

export type AppLanguage = 'pl' | 'ru' | 'en';

const LANGUAGES: { code: AppLanguage; label: string; flag: string }[] = [
  { code: 'pl', label: 'Polski', flag: '🇵🇱' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
];

const STORAGE_KEY = 'mm_app_language';

export const getAppLanguage = (): AppLanguage => {
  return (localStorage.getItem(STORAGE_KEY) as AppLanguage) || 'pl';
};

export const setAppLanguage = (lang: AppLanguage) => {
  localStorage.setItem(STORAGE_KEY, lang);
  window.dispatchEvent(new CustomEvent('mm-language-changed', { detail: lang }));
};

interface LanguageSwitcherProps {
  inline?: boolean; // inline variant for use inside Settings page
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ inline = false }) => {
  const [current, setCurrent] = useState<AppLanguage>(getAppLanguage());
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handler = (e: CustomEvent) => setCurrent(e.detail as AppLanguage);
    window.addEventListener('mm-language-changed', handler as EventListener);
    return () => window.removeEventListener('mm-language-changed', handler as EventListener);
  }, []);

  const handleSelect = (lang: AppLanguage) => {
    setCurrent(lang);
    setAppLanguage(lang);
    setIsOpen(false);
  };

  const currentLang = LANGUAGES.find(l => l.code === current)!;

  if (inline) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-slate-500 mb-1">Wybierz język interfejsu</p>
        <div className="grid grid-cols-3 gap-3">
          {LANGUAGES.map(lang => (
            <button
              key={lang.code}
              onClick={() => handleSelect(lang.code)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition ${
                current === lang.code
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-600'
              }`}
            >
              <span className="text-3xl">{lang.flag}</span>
              <span className="text-sm font-medium">{lang.label}</span>
              {current === lang.code && (
                <span className="text-xs text-blue-600 font-medium">✓ Aktywny</span>
              )}
            </button>
          ))}
        </div>
        {current !== 'pl' && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            ⚠️ Tłumaczenia dla {currentLang.label} są w trakcie przygotowania. Niektóre elementy mogą wyświetlać się po polsku.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
      >
        <span className="text-base">{currentLang.flag}</span>
        <Globe className="w-4 h-4" />
        <span className="hidden sm:inline">{currentLang.label}</span>
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-20 min-w-[140px] overflow-hidden">
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-slate-50 transition ${
                  current === lang.code ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-700'
                }`}
              >
                <span>{lang.flag}</span>
                <span>{lang.label}</span>
                {current === lang.code && <span className="ml-auto text-blue-500">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSwitcher;
