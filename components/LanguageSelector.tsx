import React from 'react';
import { Language, getLanguageName, getLanguageFlag } from '@/lib/i18n';
import { ChevronDown } from 'lucide-react';

interface LanguageSelectorProps {
  currentLanguage: Language;
  onLanguageChange: (lang: Language) => void;
  variant?: 'dropdown' | 'buttons' | 'minimal';
  showFlags?: boolean;
  className?: string;
}

const languages: Language[] = ['pl', 'en', 'uk'];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  currentLanguage,
  onLanguageChange,
  variant = 'dropdown',
  showFlags = true,
  className = '',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (variant === 'buttons') {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => onLanguageChange(lang)}
            className={`
              px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${currentLanguage === lang
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
              }
            `}
          >
            {showFlags && <span className="mr-1.5">{getLanguageFlag(lang)}</span>}
            {getLanguageName(lang)}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <div className={`flex items-center gap-0.5 ${className}`}>
        {languages.map((lang) => (
          <button
            key={lang}
            onClick={() => onLanguageChange(lang)}
            className={`
              px-2 py-1 rounded text-sm transition-all
              ${currentLanguage === lang
                ? 'bg-blue-100 text-blue-700 font-medium'
                : 'text-slate-500 hover:bg-slate-50'
              }
            `}
            title={getLanguageName(lang)}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>
    );
  }

  // Dropdown variant (default)
  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
      >
        {showFlags && <span>{getLanguageFlag(currentLanguage)}</span>}
        <span className="text-sm font-medium text-slate-700">
          {getLanguageName(currentLanguage)}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {languages.map((lang) => (
            <button
              key={lang}
              onClick={() => {
                onLanguageChange(lang);
                setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors
                ${currentLanguage === lang
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-700 hover:bg-slate-50'
                }
              `}
            >
              {showFlags && <span>{getLanguageFlag(lang)}</span>}
              {getLanguageName(lang)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
