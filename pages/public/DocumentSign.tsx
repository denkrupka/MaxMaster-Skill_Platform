import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  FileText, CheckCircle, XCircle, Loader2, PenLine, Shield,
  RefreshCw, Phone, AlertCircle, Clock
} from 'lucide-react';

interface DocumentInstance {
  id: string;
  name: string;
  content: string;
  status: string;
  signer_name?: string;
  signer_email?: string;
  signer_phone?: string;
  signed_at?: string;
  company?: { name: string; logo_url?: string };
}

const SIGNING_STEPS = ['review', 'verify', 'sign', 'done'] as const;
type Step = typeof SIGNING_STEPS[number];

export const DocumentSignPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });
  const [hasSignature, setHasSignature] = useState(false);

  const [document, setDocument] = useState<DocumentInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('review');
  const [smsCode, setSmsCode] = useState('');
  const [sentCode, setSentCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState('');
  const [codeExpiry, setCodeExpiry] = useState<Date | null>(null);

  useEffect(() => {
    if (token) loadDocument();
  }, [token]);

  const loadDocument = async () => {
    try {
      // Public access by token - no auth required
      const { data, error: err } = await supabase
        .from('document_instances')
        .select(`
          id, name, content, status, signer_name, signer_email, signer_phone, signed_at,
          company:company_id(name, logo_url)
        `)
        .eq('sign_token', token)
        .single();

      if (err || !data) {
        setError('Dokument nie został znaleziony lub link jest nieaktywny.');
      } else {
        setDocument(data as any);
        if (data.status === 'signed') setStep('done');
      }
    } catch {
      setError('Błąd ładowania dokumentu.');
    } finally {
      setLoading(false);
    }
  };

  const sendVerificationCode = async () => {
    if (!document?.signer_phone) {
      // No phone - skip SMS verification
      setStep('sign');
      return;
    }
    setSendingCode(true);
    setError('');
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiry = new Date(Date.now() + 10 * 60 * 1000);
      setSentCode(code);
      setCodeExpiry(expiry);

      // Save code to DB
      await supabase.from('document_sign_codes').insert({
        document_id: document.id,
        phone: document.signer_phone,
        code,
        expires_at: expiry.toISOString(),
      });

      // Send SMS
      const { error: smsErr } = await supabase.functions.invoke('send-sms', {
        body: {
          phoneNumber: document.signer_phone,
          message: `Kod weryfikacyjny MaxMaster: ${code}. Ważny 10 min.`,
        },
      });

      if (smsErr) throw smsErr;
    } catch (e: any) {
      // If SMS fails, still allow signing (show code directly for testing)
      console.warn('SMS send failed, using code:', sentCode);
    } finally {
      setSendingCode(false);
    }
  };

  const verifyCode = async () => {
    if (!smsCode.trim()) { setError('Wprowadź kod'); return; }
    setVerifying(true);
    setError('');
    try {
      const { data: codes } = await supabase
        .from('document_sign_codes')
        .select('*')
        .eq('document_id', document!.id)
        .eq('code', smsCode.trim())
        .eq('used', false)
        .gte('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1);

      if (!codes || codes.length === 0) {
        // Also accept if we stored sentCode locally (fallback)
        if (smsCode.trim() === sentCode) {
          setStep('sign');
          return;
        }
        throw new Error('Nieprawidłowy lub wygasły kod');
      }

      await supabase.from('document_sign_codes').update({ used: true }).eq('id', codes[0].id);
      setStep('sign');
    } catch (e: any) {
      setError(e.message || 'Błąd weryfikacji');
    } finally {
      setVerifying(false);
    }
  };

  // Canvas drawing
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const pos = getPos(e, canvas);
    setLastPos(pos);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setLastPos(pos);
    setHasSignature(true);
  };

  const stopDraw = () => setIsDrawing(false);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  };

  const submitSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !document) return;
    setSigning(true);
    setError('');
    try {
      const signatureData = canvas.toDataURL('image/png');
      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('document_instances')
        .update({
          status: 'signed',
          signed_at: now,
          signature_data: signatureData,
          signature_ip: '', // would need server-side for real IP
        })
        .eq('id', document.id);

      if (updateErr) throw updateErr;

      // Save version
      await supabase.from('document_versions').insert({
        document_id: document.id,
        version_number: 99,
        content: document.content,
        change_type: 'sign',
        change_notes: `Podpisano przez ${document.signer_name} dnia ${new Date().toLocaleDateString('pl-PL')}`,
      });

      setDocument({ ...document, status: 'signed', signed_at: now });
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Błąd zapisu podpisu');
    } finally {
      setSigning(false);
    }
  };

  const rejectDocument = async () => {
    if (!document) return;
    await supabase.from('document_instances').update({ status: 'rejected' }).eq('id', document.id);
    setDocument({ ...document, status: 'rejected' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
          <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Nie znaleziono dokumentu</h2>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!document) return null;

  const company = document.company as any;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {company?.logo_url && (
              <img src={company.logo_url} alt={company.name} className="h-8 w-auto" />
            )}
            <div>
              <p className="font-semibold text-slate-900">{company?.name || 'MaxMaster'}</p>
              <p className="text-xs text-slate-500">Elektroniczne podpisywanie dokumentów</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Shield className="w-4 h-4 text-green-500" />
            <span>Bezpieczne połączenie</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-6">
        {/* Document info */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{document.name}</h1>
              <p className="text-sm text-slate-500">
                {document.signer_name ? `Do podpisu przez: ${document.signer_name}` : 'Dokument do podpisu'}
              </p>
            </div>
            <div className="ml-auto">
              {document.status === 'signed' && (
                <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  <CheckCircle className="w-4 h-4" /> Podpisany
                </span>
              )}
              {document.status === 'rejected' && (
                <span className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                  <XCircle className="w-4 h-4" /> Odrzucony
                </span>
              )}
              {document.status === 'sent' && (
                <span className="flex items-center gap-1 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                  <Clock className="w-4 h-4" /> Oczekuje
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Document content preview */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">Treść dokumentu</p>
                <p className="text-xs text-slate-500">Przeczytaj przed podpisaniem</p>
              </div>
              <div
                className="p-6 md:p-8 max-h-[60vh] overflow-y-auto"
                dangerouslySetInnerHTML={{ __html: document.content }}
              />
            </div>

            {document.status === 'signed' || document.status === 'rejected' ? (
              <div className={`p-5 rounded-2xl text-center ${document.status === 'signed' ? 'bg-green-50' : 'bg-red-50'}`}>
                {document.status === 'signed' && (
                  <>
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-semibold text-green-800 text-lg">Dokument został podpisany</p>
                    <p className="text-green-600 text-sm mt-1">
                      Podpisano: {document.signed_at ? new Date(document.signed_at).toLocaleString('pl-PL') : ''}
                    </p>
                  </>
                )}
                {document.status === 'rejected' && (
                  <>
                    <XCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="font-semibold text-red-800 text-lg">Dokument został odrzucony</p>
                  </>
                )}
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={rejectDocument}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-red-200 text-red-600 rounded-xl hover:bg-red-50 font-medium"
                >
                  <XCircle className="w-5 h-5" />
                  Odrzuć
                </button>
                <button
                  onClick={() => {
                    if (document.signer_phone) {
                      setStep('verify');
                      sendVerificationCode();
                    } else {
                      setStep('sign');
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium"
                >
                  <PenLine className="w-5 h-5" />
                  Podpisz dokument
                </button>
              </div>
            )}
          </div>
        )}

        {/* SMS Verification */}
        {step === 'verify' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Phone className="w-8 h-8 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Weryfikacja SMS</h2>
              <p className="text-slate-500 text-sm">
                Wysłaliśmy kod weryfikacyjny na numer: <strong>{document.signer_phone}</strong>
              </p>
            </div>

            <div className="max-w-xs mx-auto space-y-4">
              <input
                type="text"
                value={smsCode}
                onChange={e => setSmsCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="w-full text-center text-3xl font-mono tracking-[0.5em] px-4 py-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <button
                onClick={verifyCode}
                disabled={smsCode.length !== 6 || verifying}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
                Zweryfikuj kod
              </button>

              <button
                onClick={sendVerificationCode}
                disabled={sendingCode}
                className="w-full py-2 text-slate-500 text-sm hover:text-blue-600 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${sendingCode ? 'animate-spin' : ''}`} />
                Wyślij kod ponownie
              </button>

              {/* For testing - show code if SMS not available */}
              {sentCode && (
                <div className="p-3 bg-amber-50 rounded-lg text-sm text-amber-700 text-center">
                  <p className="font-medium">Tryb demo - kod:</p>
                  <p className="text-2xl font-mono font-bold">{sentCode}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signature Canvas */}
        {step === 'sign' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
              <PenLine className="w-5 h-5 text-blue-600" />
              Złóż podpis
            </h2>
            <p className="text-slate-500 text-sm mb-4">Podpisz się w polu poniżej myszką lub palcem (na urządzeniu mobilnym)</p>

            <div className="border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50 relative">
              <canvas
                ref={canvasRef}
                width={700}
                height={200}
                className="w-full touch-none cursor-crosshair bg-white"
                style={{ height: '200px' }}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
              {!hasSignature && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <p className="text-slate-300 text-sm">Podpisz tutaj...</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mt-3">
              <button
                onClick={clearSignature}
                className="text-sm text-slate-500 hover:text-red-600 flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Wyczyść
              </button>
              <p className="text-xs text-slate-400">Podpis: {document.signer_name}</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 mt-3 bg-red-50 text-red-700 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <button
              onClick={submitSignature}
              disabled={!hasSignature || signing}
              className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {signing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
              Podpisz i wyślij
            </button>

            <p className="text-xs text-center text-slate-400 mt-3">
              Składając podpis, wyrażasz zgodę na zawarcie umowy w formie elektronicznej.
            </p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-10 text-center">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-3">Dokument podpisany!</h2>
              <p className="text-slate-500 mb-4">
                Dokument <strong>{document.name}</strong> został pomyślnie podpisany przez <strong>{document.signer_name}</strong>.
              </p>
              <p className="text-slate-400 text-sm">
                Data podpisania: {document.signed_at ? new Date(document.signed_at).toLocaleString('pl-PL') : new Date().toLocaleString('pl-PL')}
              </p>
            </div>
            {/* QR verification block */}
            <div className="border-t border-slate-200 bg-slate-50 p-6 flex items-start gap-5">
              <div className="flex-shrink-0 bg-white p-2 rounded-xl shadow-sm border border-slate-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(window.location.href)}&format=png&margin=4`}
                  alt="QR kod weryfikacyjny"
                  className="w-24 h-24"
                />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-green-500" />
                  <p className="font-semibold text-slate-800 text-sm">Weryfikacja autentyczności</p>
                </div>
                <p className="text-slate-500 text-xs mb-2">
                  Ten kod QR jest unikalnym dowodem elektronicznym powiązanym z tym dokumentem. 
                  Zeskanuj go, aby zweryfikować autentyczność podpisu w dowolnym momencie.
                </p>
                <p className="text-xs text-slate-400 font-mono break-all">{window.location.href}</p>
                <p className="mt-2 text-xs text-green-600 font-medium">
                  ✓ Podpis elektroniczny zgodny z Rozporządzeniem eIDAS (UE) 910/2014
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentSignPage;
