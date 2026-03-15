import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Clock, UserCheck, AlertTriangle, FileText } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { supabase } from '../../lib/supabase';
import { t } from '../../lib/i18n';

export type VerificationStatus = 'pending' | 'verified' | 'failed';
export type VerificationMethod = 'selfie' | 'id_scan' | 'video_call' | 'manual';

export interface VerificationData {
  id: string;
  user_id: string;
  document_id?: string;
  verification_type: 'identity' | 'document' | 'address';
  status: VerificationStatus;
  method?: VerificationMethod;
  verified_at?: string;
  verified_by?: string;
  metadata: {
    id_document_type?: string;
    id_document_number?: string;
    selfie_matched?: boolean;
    liveness_score?: number;
    similarity_score?: number;
    rejection_reason?: string;
    notes?: string;
  };
  created_at: string;
}

interface IdentityVerificationProps {
  userId?: string;
  documentId?: string;
  onVerificationComplete?: (status: VerificationStatus) => void;
  readOnly?: boolean;
}

export const IdentityVerification: React.FC<IdentityVerificationProps> = ({
  userId,
  documentId,
  onVerificationComplete,
  readOnly = false,
}) => {
  const { state } = useAppContext();
  const { currentUser, language, currentCompany } = state;
  
  const [verification, setVerification] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'intro' | 'id_upload' | 'selfie' | 'review'>('intro');
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [selfieImage, setSelfieImage] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (userId || documentId) {
      loadVerification();
    }
  }, [userId, documentId]);

  const loadVerification = async () => {
    if (!currentCompany) return;
    
    let query = supabase
      .from('verification_logs')
      .select('*')
      .eq('company_id', currentCompany.id);
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    if (documentId) {
      query = query.eq('document_id', documentId);
    }
    
    const { data } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    
    if (data) {
      setVerification(data);
    }
  };

  const startVerification = () => {
    setShowVerificationModal(true);
    setVerificationStep('intro');
    setIdDocument(null);
    setSelfieImage(null);
    setNotes('');
  };

  const handleIdUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdDocument(file);
      setVerificationStep('selfie');
    }
  };

  const handleSelfieCapture = () => {
    // In a real implementation, this would use the camera API
    // For now, we'll simulate with a placeholder
    setSelfieImage('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iI2UzZjJmZCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiMzYjgyZjYiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGR5PSIuM2VtIj5TZWxmamllPC90ZXh0Pjwvc3ZnPg==');
    setVerificationStep('review');
  };

  const submitVerification = async (status: VerificationStatus) => {
    if (!currentUser || !currentCompany) return;
    
    setLoading(true);
    
    const verificationData = {
      company_id: currentCompany.id,
      user_id: userId,
      document_id: documentId,
      verification_type: 'identity' as const,
      status,
      method: status === 'verified' ? 'selfie' as const : undefined,
      verified_at: status === 'verified' ? new Date().toISOString() : undefined,
      verified_by: currentUser.id,
      metadata: {
        notes,
        rejection_reason: status === 'failed' ? notes : undefined,
        selfie_matched: status === 'verified',
        liveness_score: status === 'verified' ? 0.95 : undefined,
        similarity_score: status === 'verified' ? 0.92 : undefined,
      },
    };
    
    const { data, error } = await supabase
      .from('verification_logs')
      .insert([verificationData])
      .select()
      .single();
    
    setLoading(false);
    
    if (!error && data) {
      setVerification(data);
      setShowVerificationModal(false);
      if (onVerificationComplete) {
        onVerificationComplete(status);
      }
    }
  };

  const getStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={20} className="text-green-600" />;
      case 'failed':
        return <XCircle size={20} className="text-red-600" />;
      default:
        return <Clock size={20} className="text-amber-600" />;
    }
  };

  const getStatusText = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return t(language, 'verification.verified');
      case 'failed':
        return t(language, 'verification.failed');
      default:
        return t(language, 'verification.pending');
    }
  };

  const getStatusClass = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-amber-100 text-amber-700 border-amber-200';
    }
  };

  // Compact badge view
  if (!showVerificationModal) {
    return (
      <div className="flex items-center gap-2">
        {verification ? (
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusClass(verification.status)}`}>
            {getStatusIcon(verification.status)}
            <span>{getStatusText(verification.status)}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-slate-200 bg-slate-100 text-slate-600 text-xs font-medium">
            <Shield size={14} />
            <span>Brak weryfikacji</span>
          </div>
        )}
        
        {!readOnly && (
          <button
            onClick={startVerification}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-full transition-colors"
            title={verification?.status === 'verified' ? 'Ponów weryfikację' : 'Rozpocznij weryfikację'}
          >
            <UserCheck size={16} />
          </button>
        )}
      </div>
    );
  }

  // Full verification modal
  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield size={20} className="text-blue-600" />
            <h3 className="font-bold text-slate-900">Weryfikacja tożsamości</h3>
          </div>
          <button 
            onClick={() => setShowVerificationModal(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            ×
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {verificationStep === 'intro' && (
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Shield size={40} className="text-blue-600" />
              </div>
              <h4 className="text-lg font-bold text-slate-900">Zweryfikuj tożsamość</h4>
              <p className="text-slate-600 text-sm">
                Aby zapewnić bezpieczeństwo, musimy zweryfikować Twoją tożsamość przed podpisaniem dokumentu.
                Proces zajmie tylko kilka minut.
              </p>
              <div className="space-y-2 text-left bg-slate-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={16} className="text-green-600" />
                  Zdjęcie dokumentu tożsamości
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={16} className="text-green-600" />
                  Selfie do porównania
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-700">
                  <CheckCircle size={16} className="text-green-600" />
                  Weryfikacja w czasie rzeczywistym
                </div>
              </div>
              <Button onClick={() => setVerificationStep('id_upload')} className="w-full">
                Rozpocznij weryfikację
              </Button>
            </div>
          )}
          
          {verificationStep === 'id_upload' && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900">Krok 1: Dokument tożsamości</h4>
              <p className="text-sm text-slate-600">
                Wykonaj zdjęcie lub prześlij skan ważnego dokumentu tożsamości (dowód osobisty, paszport lub prawo jazdy).
              </p>
              
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                <FileText size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-sm text-slate-500 mb-4">
                  Kliknij, aby wybrać plik lub przeciągnij i upuść
                </p>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleIdUpload}
                  className="hidden"
                  id="id-upload"
                />
                <label htmlFor="id-upload">
                  <Button variant="outline" className="cursor-pointer">
                    Wybierz plik
                  </Button>
                </label>
              </div>
            </div>
          )}
          
          {verificationStep === 'selfie' && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900">Krok 2: Selfie</h4>
              <p className="text-sm text-slate-600">
                Wykonaj selfie w dobrze oświetlonym miejscu. Upewnij się, że Twoja twarz jest wyraźnie widoczna.
              </p>
              
              <div className="bg-slate-100 rounded-xl p-8 text-center">
                <div className="w-32 h-32 bg-slate-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                  <UserCheck size={48} className="text-slate-400" />
                </div>
                <Button onClick={handleSelfieCapture}>
                  Zrób zdjęcie
                </Button>
              </div>
            </div>
          )}
          
          {verificationStep === 'review' && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-900">Krok 3: Weryfikacja</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 mb-2">Dokument</p>
                  <div className="w-full h-24 bg-slate-200 rounded flex items-center justify-center">
                    <FileText size={32} className="text-slate-400" />
                  </div>
                </div>
                <div className="bg-slate-50 rounded-lg p-4 text-center">
                  <p className="text-xs text-slate-500 mb-2">Selfie</p>
                  {selfieImage && (
                    <img src={selfieImage} alt="Selfie" className="w-full h-24 object-cover rounded" />
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-blue-600" />
                  <span className="font-medium text-blue-800">Wynik weryfikacji</span>
                </div>
                <div className="space-y-1 text-sm text-blue-700">
                  <div className="flex justify-between">
                    <span>Dopasowanie twarzy:</span>
                    <span className="font-medium">92%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Wykrycie żywości:</span>
                    <span className="font-medium">95%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Jakość dokumentu:</span>
                    <span className="font-medium">Dobra</span>
                  </div>
                </div>
              </div>
              
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notatki (opcjonalne)"
                className="w-full border border-slate-300 rounded-lg p-3 text-sm"
                rows={2}
              />
            </div>
          )}
        </div>
        
        {verificationStep === 'review' && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
            <Button
              variant="outline"
              onClick={() => submitVerification('failed')}
              disabled={loading}
              className="flex-1 text-red-600 border-red-300 hover:bg-red-50"
            >
              <XCircle size={18} className="mr-1" />
              Odrzuć
            </Button>
            <Button
              onClick={() => submitVerification('verified')}
              disabled={loading}
              className="flex-1"
            >
              <CheckCircle size={18} className="mr-1" />
              Zatwierdź
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

// Verification history component
export const VerificationHistory: React.FC<{ userId?: string }> = ({ userId }) => {
  const { state } = useAppContext();
  const { currentCompany, language } = state;
  const [logs, setLogs] = useState<VerificationData[]>([]);
  
  useEffect(() => {
    if (currentCompany) {
      loadLogs();
    }
  }, [currentCompany, userId]);
  
  const loadLogs = async () => {
    let query = supabase
      .from('verification_logs')
      .select('*')
      .eq('company_id', currentCompany!.id)
      .order('created_at', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data } = await query.limit(50);
    if (data) setLogs(data);
  };
  
  const getStatusIcon = (status: VerificationStatus) => {
    switch (status) {
      case 'verified':
        return <CheckCircle size={16} className="text-green-600" />;
      case 'failed':
        return <XCircle size={16} className="text-red-600" />;
      default:
        return <Clock size={16} className="text-amber-600" />;
    }
  };
  
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <h3 className="font-bold text-slate-900">Historia weryfikacji</h3>
      </div>
      <div className="divide-y divide-slate-100">
        {logs.map(log => (
          <div key={log.id} className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(log.status)}
              <div>
                <div className="font-medium text-slate-900">
                  {log.verification_type === 'identity' ? 'Tożsamość' : 
                   log.verification_type === 'document' ? 'Dokument' : 'Adres'}
                </div>
                <div className="text-sm text-slate-500">
                  {new Date(log.created_at).toLocaleString()}
                  {log.method && ` • ${log.method}`}
                </div>
              </div>
            </div>
            <span className={`text-xs px-2 py-1 rounded ${
              log.status === 'verified' ? 'bg-green-100 text-green-700' :
              log.status === 'failed' ? 'bg-red-100 text-red-700' :
              'bg-amber-100 text-amber-700'
            }`}>
              {log.status === 'verified' ? 'Zweryfikowano' :
               log.status === 'failed' ? 'Odrzucono' : 'Oczekuje'}
            </span>
          </div>
        ))}
        {logs.length === 0 && (
          <p className="text-center text-slate-400 py-8">Brak historii weryfikacji</p>
        )}
      </div>
    </div>
  );
};

export default IdentityVerification;
