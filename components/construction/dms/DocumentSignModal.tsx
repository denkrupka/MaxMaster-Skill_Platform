import React, { useState } from 'react';
import { X, Send, Phone, Loader2, CheckCircle, AlertCircle, Copy, ExternalLink } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAppContext } from '../../../context/AppContext';

interface DocumentInstance {
  id: string;
  name: string;
  status: string;
  sign_token: string;
  signer_name?: string;
  signer_email?: string;
  signer_phone?: string;
}

interface Props {
  document: DocumentInstance;
  onClose: () => void;
  onSent: () => void;
}

export const DocumentSignModal: React.FC<Props> = ({ document, onClose, onSent }) => {
  const { state } = useAppContext();
  const [signerName, setSignerName] = useState(document.signer_name || '');
  const [signerEmail, setSignerEmail] = useState(document.signer_email || '');
  const [signerPhone, setSignerPhone] = useState(document.signer_phone || '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const signUrl = `${window.location.origin}/sign/${document.sign_token}`;

  const copyLink = () => {
    navigator.clipboard.writeText(signUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async () => {
    if (!signerName) { setError('Podaj imię i nazwisko podpisującego'); return; }
    setSending(true);
    setError('');
    try {
      // Update document with signer info and set status to 'sent'
      const { error: updateErr } = await supabase
        .from('document_instances')
        .update({
          status: 'sent',
          signer_name: signerName,
          signer_email: signerEmail,
          signer_phone: signerPhone,
        })
        .eq('id', document.id);

      if (updateErr) throw updateErr;

      // Try to send SMS if phone provided
      if (signerPhone) {
        try {
          await supabase.functions.invoke('send-sms', {
            body: {
              phoneNumber: signerPhone,
              message: `Proszę o podpisanie dokumentu "${document.name}": ${signUrl}`,
            },
          });
        } catch (smsErr) {
          console.warn('SMS send failed, but document status updated:', smsErr);
        }
      }

      // Try to send email if provided (basic implementation)
      if (signerEmail) {
        try {
          await supabase.functions.invoke('send-email', {
            body: {
              to: signerEmail,
              subject: `Prośba o podpisanie dokumentu: ${document.name}`,
              html: `
                <p>Dzień dobry ${signerName},</p>
                <p>Prosimy o podpisanie dokumentu: <strong>${document.name}</strong></p>
                <p><a href="${signUrl}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:white;text-decoration:none;border-radius:8px;">Podpisz dokument</a></p>
                <p>Lub skopiuj link: ${signUrl}</p>
                <p>Link jest aktywny przez 30 dni.</p>
              `,
            },
          });
        } catch (emailErr) {
          console.warn('Email send failed:', emailErr);
        }
      }

      setSent(true);
      setTimeout(() => { onSent(); }, 2000);
    } catch (e: any) {
      setError(e.message || 'Błąd wysyłania');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-semibold">Wyślij do podpisu</h2>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        {sent ? (
          <div className="p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Wysłano do podpisu!</h3>
            <p className="text-slate-500">Dokument oczekuje na podpisanie przez {signerName}</p>
          </div>
        ) : (
          <>
            <div className="p-5 space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700 flex items-start gap-2">
                <Send className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Wygeneruj link do podpisu i wyślij do klienta przez SMS lub e-mail. Klient otworzy link i złoży podpis online.</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Imię i nazwisko podpisującego *</label>
                <input
                  type="text"
                  value={signerName}
                  onChange={e => setSignerName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                  placeholder="Jan Kowalski"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    <Phone className="w-3 h-3 inline mr-1" />Telefon
                  </label>
                  <input
                    type="tel"
                    value={signerPhone}
                    onChange={e => setSignerPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="+48 123 456 789"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                  <input
                    type="email"
                    value={signerEmail}
                    onChange={e => setSignerEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="jan@firma.pl"
                  />
                </div>
              </div>

              {/* Sign link */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Link do podpisu</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={signUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600"
                  />
                  <button
                    onClick={copyLink}
                    className={`flex items-center gap-1 px-3 py-2 border rounded-lg text-sm transition
                      ${copied ? 'border-green-300 bg-green-50 text-green-600' : 'border-slate-200 hover:bg-slate-50'}`}
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Skopiowano' : 'Kopiuj'}
                  </button>
                  <a
                    href={signUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50">
                Anuluj
              </button>
              <button
                onClick={handleSend}
                disabled={!signerName || sending}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Wyślij do podpisu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
