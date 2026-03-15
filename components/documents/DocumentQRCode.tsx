import React, { useState, useEffect } from 'react';
import { QrCode, Download, Copy, Check, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface DocumentQRCodeProps {
  documentId: string;
  companyId: string;
  documentNumber?: string;
}

interface QRCodeData {
  verificationUrl: string;
  qrCodeUrl: string;
  verificationCode: string;
}

export const DocumentQRCode: React.FC<DocumentQRCodeProps> = ({
  documentId,
  companyId,
  documentNumber,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateQRCode = async () => {
    setLoading(true);
    try {
      // Generate verification code
      const verificationCode = Math.random().toString(36).substring(2, 10).toUpperCase();
      
      // Store in database
      await supabase.from('document_verification_codes').upsert({
        document_id: documentId,
        company_id: companyId,
        verification_code: verificationCode,
        expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      });

      const verificationUrl = `${window.location.origin}/verify/${documentId}?code=${verificationCode}`;
      
      // Generate QR code using Google Chart API
      const qrCodeUrl = `https://chart.googleapis.com/chart?cht=qr&chs=300x300&chld=H|0&chl=${encodeURIComponent(verificationUrl)}`;

      setQrData({
        verificationUrl,
        qrCodeUrl,
        verificationCode,
      });
      setIsOpen(true);
    } catch (err) {
      alert('Błąd generowania kodu QR');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQRCode = async () => {
    if (!qrData) return;
    
    const response = await fetch(qrData.qrCodeUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `qrcode-${documentNumber || documentId}.png`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <>
      <button
        onClick={generateQRCode}
        disabled={loading}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <QrCode className="w-4 h-4" />
        )}
        Kod QR
      </button>

      {isOpen && qrData && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-medium text-slate-800">Kod weryfikacyjny QR</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 text-center">
              {/* QR Code Image */}
              <div className="inline-block p-4 bg-white border-2 border-slate-100 rounded-xl mb-4">
                <img
                  src={qrData.qrCodeUrl}
                  alt="Kod QR"
                  className="w-48 h-48"
                />
              </div>

              {/* Verification Code */}
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-1">Kod weryfikacyjny</p>
                <div className="flex items-center justify-center gap-2">
                  <code className="px-3 py-1.5 bg-slate-100 rounded-lg font-mono text-lg tracking-wider">
                    {qrData.verificationCode}
                  </code>
                  <button
                    onClick={() => copyToClipboard(qrData.verificationCode)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Kopiuj kod"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Verification URL */}
              <div className="mb-4">
                <p className="text-xs text-slate-500 mb-1">Link weryfikacyjny</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={qrData.verificationUrl}
                    readOnly
                    className="flex-1 text-xs bg-slate-50 border border-slate-200 rounded-lg px-3 py-2"
                  />
                  <button
                    onClick={() => copyToClipboard(qrData.verificationUrl)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="Kopiuj link"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-blue-50 rounded-lg p-4 text-left text-sm text-blue-800">
                <p className="font-medium mb-2">Jak używać:</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Pobierz lub zeskanuj kod QR</li>
                  <li>Umieść na wydruku dokumentu</li>
                  <li>Odbiorca może zweryfikować autentyczność dokumentu</li>
                  <li>Kod jest ważny przez 1 rok</li>
                </ol>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={downloadQRCode}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Pobierz PNG
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentQRCode;
