export type SignatureStatus = 'pending' | 'opened' | 'signed' | 'declined' | 'expired';

export type CreateSignatureSignerInput = {
  name: string;
  email: string;
  message?: string;
};

export type CreateSignatureRequestRow = {
  company_id: string;
  document_id: string;
  signer_name: string;
  signer_email: string;
  recipient_name: string;
  recipient_email: string;
  message: string | null;
  created_by: string;
  status: SignatureStatus;
};

const normalizeText = (value: string | null | undefined) => (value ?? '').trim();
const resolveSignerName = (request: Record<string, any>) => normalizeText(request.signer_name) || normalizeText(request.recipient_name);
const resolveSignerEmail = (request: Record<string, any>) => normalizeText(request.signer_email) || normalizeText(request.recipient_email);

export function normalizeSignatureStatus(status: string | null | undefined): SignatureStatus {
  switch (status) {
    case 'viewed':
    case 'opened':
      return 'opened';
    case 'signed':
      return 'signed';
    case 'declined':
      return 'declined';
    case 'expired':
      return 'expired';
    case 'pending':
    default:
      return 'pending';
  }
}

export function getCanonicalSigningToken(request: Record<string, any>): string {
  return normalizeText(request.signing_token) || normalizeText(request.token) || normalizeText(request.id);
}

export function buildCreateSignatureRequestRows(input: {
  documentId: string;
  companyId: string;
  userId: string;
  signers: CreateSignatureSignerInput[];
}): CreateSignatureRequestRow[] {
  return input.signers.map((signer) => {
    const signerName = normalizeText(signer.name);
    const signerEmail = normalizeText(signer.email).toLowerCase();

    return {
      company_id: input.companyId,
      document_id: input.documentId,
      signer_name: signerName,
      signer_email: signerEmail,
      recipient_name: signerName,
      recipient_email: signerEmail,
      message: normalizeText(signer.message) || null,
      created_by: input.userId,
      status: 'pending',
    };
  });
}

export function normalizeSignatureRequestForSigning<T extends Record<string, any>>(request: T) {
  const signer_name = resolveSignerName(request);
  const signer_email = resolveSignerEmail(request);
  const signing_token = getCanonicalSigningToken(request);
  const status = normalizeSignatureStatus(request.status);
  const last_opened_at = request.last_opened_at || request.viewed_at || null;

  return {
    ...request,
    status,
    signer_name,
    signer_email,
    recipient_name: signer_name,
    recipient_email: signer_email,
    signing_token,
    token: signing_token,
    last_opened_at,
    viewed_at: last_opened_at,
  };
}

export function getSignatureDisplayStatus(status: string): { key: SignatureStatus; label: string } {
  switch (normalizeSignatureStatus(status)) {
    case 'opened':
      return { key: 'opened', label: 'Otwarto' };
    case 'signed':
      return { key: 'signed', label: 'Podpisano' };
    case 'declined':
      return { key: 'declined', label: 'Odrzucono' };
    case 'expired':
      return { key: 'expired', label: 'Wygasło' };
    case 'pending':
    default:
      return { key: 'pending', label: 'Oczekuje' };
  }
}

export function buildPublicSigningRoute(signingToken: string, origin = 'https://app.example.com') {
  const path = `/sign/${signingToken}`;
  return {
    signing_token: signingToken,
    token: signingToken,
    path,
    absoluteUrl: `${origin}${path}`,
  };
}
