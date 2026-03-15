import React from 'react';
import { CheckSquare, Square, Loader2 } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { t } from '../../lib/i18n';

interface BulkSigningToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSignSelected: () => void;
  isSigning: boolean;
  progress?: { current: number; total: number };
}

export const BulkSigningToolbar: React.FC<BulkSigningToolbarProps> = ({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onSignSelected,
  isSigning,
  progress
}) => {
  const { state } = useAppContext();
  const { language } = state;
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="bg-white border-b border-slate-200 p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
          disabled={isSigning}
        >
          {allSelected ? (
            <CheckSquare className="w-5 h-5 text-blue-600" />
          ) : (
            <Square className="w-5 h-5 text-slate-400" />
          )}
          <span className="hidden sm:inline">
            {allSelected ? t(language, 'documents.deselectAll') : t(language, 'documents.selectAll')}
          </span>
          <span className="sm:hidden">
            {allSelected ? t(language, 'common.cancel') : t(language, 'common.select')}
          </span>
        </button>
        
        {selectedCount > 0 && (
          <span className="text-sm text-slate-500">
            {language === 'pl' ? 'Wybrano:' : language === 'uk' ? 'Вибрано:' : 'Selected:'} <strong className="text-slate-900">{selectedCount}</strong>
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {isSigning && progress && (
          <div className="flex items-center gap-2 mr-2">
            <div className="w-32 sm:w-48 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap">
              {progress.current}/{progress.total}
            </span>
          </div>
        )}
        
        <button
          onClick={onSignSelected}
          disabled={selectedCount === 0 || isSigning}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all
            ${selectedCount > 0 && !isSigning
              ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }
          `}
        >
          {isSigning ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{t(language, 'documents.signing')}</span>
            </>
          ) : (
            <>
              <CheckSquare className="w-4 h-4" />
              <span>{t(language, 'documents.signSelected')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
