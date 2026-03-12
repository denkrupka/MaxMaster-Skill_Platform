import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  emoji?: string;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  compact?: boolean;
}

const EmptyStateImpl: React.FC<EmptyStateProps> = ({
  icon,
  emoji,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}) => {
  return (
    <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8 px-4' : 'py-16 px-6'}`}>
      {/* Illustration */}
      <div className={`${compact ? 'mb-3' : 'mb-4'}`}>
        {emoji ? (
          <div className={`${compact ? 'text-4xl' : 'text-6xl'} mb-2`}>{emoji}</div>
        ) : icon ? (
          <div className={`${compact ? 'w-12 h-12' : 'w-16 h-16'} bg-slate-100 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-2`}>
            {icon}
          </div>
        ) : null}
      </div>
      
      {/* Text */}
      <h3 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-slate-700 mb-1`}>{title}</h3>
      {description && (
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-slate-400 max-w-xs mb-4`}>{description}</p>
      )}
      
      {/* Actions */}
      {(action || secondaryAction) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          {action && (
            <button
              onClick={action.onClick}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              {action.icon}
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              className="flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50 transition"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// Preset empty states for common scenarios
export const NoDataEmptyState: React.FC<{ onAdd?: () => void; entity?: string }> = ({ onAdd, entity = 'element' }) => (
  <EmptyState
    emoji="📭"
    title={`Brak ${entity}`}
    description="Tutaj pojawią się dane po ich dodaniu."
    action={onAdd ? { label: `Dodaj ${entity}`, onClick: onAdd } : undefined}
  />
);

export const NoResultsEmptyState: React.FC<{ onClear?: () => void }> = ({ onClear }) => (
  <EmptyState
    emoji="🔍"
    title="Brak wyników"
    description="Nie znaleziono elementów pasujących do kryteriów wyszukiwania."
    action={onClear ? { label: 'Wyczyść filtry', onClick: onClear } : undefined}
  />
);

export const ErrorEmptyState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <EmptyState
    emoji="⚠️"
    title="Błąd ładowania"
    description="Nie udało się pobrać danych. Sprawdź połączenie z internetem."
    action={onRetry ? { label: 'Spróbuj ponownie', onClick: onRetry } : undefined}
  />
);

export const EmptyState = React.memo(EmptyStateImpl);
export default EmptyState;
