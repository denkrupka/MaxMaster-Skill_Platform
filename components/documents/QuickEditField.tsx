import React, { useState, useEffect, useRef } from 'react';
import { Pencil, Check, X, Loader2 } from 'lucide-react';

interface QuickEditFieldProps {
  value: string;
  onSave: (value: string) => Promise<void>;
  label?: string;
  multiline?: boolean;
  validate?: (value: string) => string | undefined;
  className?: string;
}

export const QuickEditField: React.FC<QuickEditFieldProps> = ({
  value: initialValue,
  onSave,
  label,
  multiline = false,
  validate,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setError('');
  };

  const handleCancel = () => {
    setValue(initialValue);
    setIsEditing(false);
    setError('');
  };

  const handleSave = async () => {
    if (value === initialValue) {
      setIsEditing(false);
      return;
    }

    // Validate
    if (validate) {
      const validationError = validate(value);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setSaving(true);
    setError('');

    try {
      await onSave(value);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className={`space-y-1 ${className}`}>
        {label && (
          <label className="block text-xs font-medium text-slate-500">{label}</label>
        )}
        <div className="flex items-start gap-2">
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              disabled={saving}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-500"
              disabled={saving}
            />
          )}
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded transition-colors disabled:opacity-50"
              title="Zapisz"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
              title="Anuluj"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {error && (
          <p className="text-xs text-red-600">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className={`group ${className}`}>
      {label && (
        <label className="block text-xs font-medium text-slate-500 mb-1">{label}</label>
      )}
      <div
        onClick={handleStartEdit}
        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg -mx-2 px-2 py-1 transition-colors"
      >
        <span className={`flex-1 ${!value ? 'text-slate-400 italic' : ''}`}>
          {value || 'Kliknij aby edytować...'}
        </span>
        <Pencil className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </div>
  );
};

// Batch quick edit for multiple fields
interface QuickEditGroupProps {
  fields: Array<{
    key: string;
    label: string;
    value: string;
    multiline?: boolean;
  }>;
  onSave: (key: string, value: string) => Promise<void>;
  className?: string;
}

export const QuickEditGroup: React.FC<QuickEditGroupProps> = ({
  fields,
  onSave,
  className = '',
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {fields.map((field) => (
        <QuickEditField
          key={field.key}
          label={field.label}
          value={field.value}
          multiline={field.multiline}
          onSave={(value) => onSave(field.key, value)}
        />
      ))}
    </div>
  );
};

export default QuickEditField;
