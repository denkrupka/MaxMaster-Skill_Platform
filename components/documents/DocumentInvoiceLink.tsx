import React, { useState, useEffect } from 'react';
import { Link2, Unlink, Search, X, Check, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { logDocumentEvent } from '../../lib/documentService';

interface DocumentInvoiceLinkProps {
  documentId: string;
  companyId: string;
  userId: string;
  linkedInvoiceId?: string;
  onLinkChange?: (invoiceId: string | null) => void;
}

interface Invoice {
  id: string;
  number: string;
  contractor_name?: string;
  issue_date: string;
  total_gross?: number;
}

export const DocumentInvoiceLink: React.FC<DocumentInvoiceLinkProps> = ({
  documentId,
  companyId,
  userId,
  linkedInvoiceId,
  onLinkChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [linkedInvoice, setLinkedInvoice] = useState<Invoice | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  useEffect(() => {
    if (linkedInvoiceId) {
      loadLinkedInvoice();
    }
  }, [linkedInvoiceId]);

  const loadLinkedInvoice = async () => {
    const { data } = await supabase
      .from('invoices')
      .select('id, number, contractor_name, issue_date, total_gross')
      .eq('id', linkedInvoiceId)
      .single();
    
    if (data) {
      setLinkedInvoice(data);
    }
  };

  const loadInvoices = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('id, number, contractor_name, issue_date, total_gross')
      .eq('company_id', companyId)
      .order('issue_date', { ascending: false })
      .limit(50);
    
    setInvoices(data || []);
    setLoading(false);
  };

  const handleOpen = () => {
    setIsOpen(true);
    loadInvoices();
  };

  const handleLink = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('documents')
        .update({ linked_invoice_id: invoice.id })
        .eq('id', documentId);

      if (error) throw error;

      await logDocumentEvent(documentId, 'linked_invoice', {
        invoice_id: invoice.id,
        invoice_number: invoice.number,
      });

      setLinkedInvoice(invoice);
      onLinkChange?.(invoice.id);
      setIsOpen(false);
    } catch (err: any) {
      alert('Błąd: ' + err.message);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('Czy na pewno chcesz usunąć powiązanie z fakturą?')) return;

    setUnlinking(true);
    try {
      const { error } = await supabase
        .from('documents')
        .update({ linked_invoice_id: null })
        .eq('id', documentId);

      if (error) throw error;

      await logDocumentEvent(documentId, 'unlinked_invoice', {
        previous_invoice_id: linkedInvoice?.id,
      });

      setLinkedInvoice(null);
      onLinkChange?.(null);
    } catch (err: any) {
      alert('Błąd: ' + err.message);
    } finally {
      setUnlinking(false);
    }
  };

  const filteredInvoices = invoices.filter(
    (inv) =>
      inv.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.contractor_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (linkedInvoice) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <Link2 className="w-4 h-4 text-green-600" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            Faktura: {linkedInvoice.number}
          </p>
          <p className="text-xs text-slate-500">
            {linkedInvoice.contractor_name} · {new Date(linkedInvoice.issue_date).toLocaleDateString('pl-PL')}
            {linkedInvoice.total_gross && ` · ${linkedInvoice.total_gross.toFixed(2)} PLN`}
          </p>
        </div>
        <button
          onClick={handleUnlink}
          disabled={unlinking}
          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="Usuń powiązanie"
        >
          {unlinking ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Unlink className="w-4 h-4" />
          )}
        </button>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
      >
        <Link2 className="w-4 h-4" />
        Powiąż z fakturą
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <h3 className="font-medium text-slate-800">Powiąż z fakturą</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Szukaj faktury..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <p className="text-center py-8 text-slate-400 text-sm">
                  Nie znaleziono faktur
                </p>
              ) : (
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {filteredInvoices.map((invoice) => (
                    <button
                      key={invoice.id}
                      onClick={() => handleLink(invoice)}
                      className="w-full text-left p-3 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{invoice.number}</span>
                        {invoice.total_gross && (
                          <span className="text-sm text-slate-600">
                            {invoice.total_gross.toFixed(2)} PLN
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {invoice.contractor_name || 'Brak kontrahenta'} ·{' '}
                        {new Date(invoice.issue_date).toLocaleDateString('pl-PL')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default DocumentInvoiceLink;
