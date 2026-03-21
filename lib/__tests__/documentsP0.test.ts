import { describe, expect, it } from 'vitest';
import {
  buildCreateSignatureRequestRows,
  buildPublicSigningRoute,
  getSignatureDisplayStatus,
  normalizeSignatureRequestForSigning,
} from '../documentSigning';
import {
  getTemplateValidationErrors,
  getDocumentWizardStep1Errors,
  getDocumentWizardStep2Errors,
  getSignerValidationErrors,
} from '../documentValidation';

describe('documents P0 validation', () => {
  it('rejects invalid template payloads', () => {
    expect(
      getTemplateValidationErrors({
        name: ' ',
        sections: [{ title: 'Only title', body: '   ' }],
        variables: [{ key: ' ', label: 'Email', source: 'manual', type: 'text', required: true }],
      }),
    ).toEqual([
      'Nazwa jest wymagana',
      'Dodaj przynajmniej jedną sekcję z treścią',
      'Zmienna #1 musi mieć klucz',
    ]);
  });

  it('requires template selection for wizard step 1', () => {
    expect(getDocumentWizardStep1Errors({ templateId: '' })).toEqual(['Wybierz szablon']);
  });

  it('requires only manual required variables in wizard step 2', () => {
    expect(
      getDocumentWizardStep2Errors(
        [
          { key: 'manual_email', required: true, source: 'manual' },
          { key: 'name', required: true, source: 'companies' },
        ],
        { manual_email: '   ' },
      ),
    ).toEqual(['Uzupełnij pole: manual_email']);
  });

  it('validates signer name and email', () => {
    expect(getSignerValidationErrors({ name: ' ', email: 'bad-email' })).toEqual([
      'Imię i nazwisko jest wymagane',
      'Podaj poprawny adres email',
    ]);
  });
});

describe('documents P0 signing contract', () => {
  it('builds canonical signature request rows', () => {
    const rows = buildCreateSignatureRequestRows({
      documentId: 'doc-1',
      companyId: 'company-1',
      userId: 'user-1',
      signers: [{ name: 'Jan Kowalski', email: 'jan@example.com', message: 'Proszę podpisać' }],
    });

    expect(rows).toEqual([
      {
        company_id: 'company-1',
        document_id: 'doc-1',
        signer_name: 'Jan Kowalski',
        signer_email: 'jan@example.com',
        recipient_name: 'Jan Kowalski',
        recipient_email: 'jan@example.com',
        message: 'Proszę podpisać',
        created_by: 'user-1',
        status: 'pending',
      },
    ]);
  });

  it('normalizes signer/recipient mismatch for public signing', () => {
    expect(
      normalizeSignatureRequestForSigning({
        id: 'req-1',
        signer_name: 'Signer Name',
        signer_email: 'signer@example.com',
        recipient_name: 'Recipient Name',
        recipient_email: 'recipient@example.com',
        signing_token: 'signing-123',
      }),
    ).toMatchObject({
      signer_name: 'Signer Name',
      signer_email: 'signer@example.com',
      recipient_name: 'Signer Name',
      recipient_email: 'signer@example.com',
      signing_token: 'signing-123',
      token: 'signing-123',
    });
  });

  it('maps legacy token and viewed_at fields into canonical signing contract', () => {
    expect(
      normalizeSignatureRequestForSigning({
        id: 'req-2',
        token: 'legacy-token',
        status: 'viewed',
        viewed_at: '2026-03-16T20:00:00.000Z',
      }),
    ).toMatchObject({
      signing_token: 'legacy-token',
      token: 'legacy-token',
      status: 'opened',
      last_opened_at: '2026-03-16T20:00:00.000Z',
      viewed_at: '2026-03-16T20:00:00.000Z',
    });
  });

  it('maps viewed status consistently', () => {
    expect(getSignatureDisplayStatus('pending')).toEqual({ key: 'pending', label: 'Oczekuje' });
    expect(getSignatureDisplayStatus('opened')).toEqual({ key: 'opened', label: 'Otwarto' });
    expect(getSignatureDisplayStatus('viewed')).toEqual({ key: 'opened', label: 'Otwarto' });
    expect(getSignatureDisplayStatus('signed')).toEqual({ key: 'signed', label: 'Podpisano' });
    expect(getSignatureDisplayStatus('declined')).toEqual({ key: 'declined', label: 'Odrzucono' });
  });

  it('builds public signing route contract', () => {
    expect(buildPublicSigningRoute('abc123')).toEqual({
      signing_token: 'abc123',
      token: 'abc123',
      path: '/sign/abc123',
      absoluteUrl: 'https://app.example.com/sign/abc123',
    });
  });
});
