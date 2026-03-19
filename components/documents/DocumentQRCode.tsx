import React, { useEffect, useState } from 'react'

interface Props { documentId: string }

const DocumentQRCode: React.FC<Props> = ({ documentId }) => {
  const verifyUrl = `https://diytvuczpciikzdhldny.supabase.co/functions/v1/verify-document?id=${documentId}`
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`
  const [verified, setVerified] = useState<any>(null)

  const handleVerify = async () => {
    const res = await fetch(verifyUrl)
    const data = await res.json()
    setVerified(data)
  }

  return (
    <div className="flex flex-col items-center gap-3 p-4 border rounded-xl bg-gray-50">
      <img src={qrApiUrl} alt="QR weryfikacja" className="w-32 h-32" />
      <p className="text-xs text-gray-500 text-center">Zeskanuj aby zweryfikować autentyczność dokumentu</p>
      <button onClick={handleVerify} className="text-xs text-blue-600 hover:underline">
        Weryfikuj online →
      </button>
      {verified && (
        <div className={`text-xs p-2 rounded ${verified.valid ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {verified.valid ? `✅ Dokument autentyczny · ${verified.signatures?.length || 0} podpisów` : '❌ Dokument nieważny'}
        </div>
      )}
    </div>
  )
}

export default DocumentQRCode
