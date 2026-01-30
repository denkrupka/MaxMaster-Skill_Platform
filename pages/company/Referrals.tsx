
import React, { useState, useMemo, useEffect } from 'react';
import {
  Copy, CheckCircle, Share2, Info, Gift, Users, Clock,
  CreditCard, Send, MessageCircle, Mail, Phone, ExternalLink, X, Loader2
} from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { createShortLink } from '../../lib/shortLinks';
import { sendSMS } from '../../lib/smsService';

// Referral status types
type ReferralStatus = 'sent' | 'registered' | 'demo' | 'subscription';
type BonusStatus = 'pending' | 'paid';

// Mock referral data for display (in production, this would come from database)
interface CompanyReferral {
  id: string;
  companyName: string;
  contactEmail: string;
  contactPhone?: string;
  invitedAt: string;
  status: ReferralStatus;
  bonusStatus: BonusStatus;
  bonusAmount: number;
  paidAmount?: number;
}

const REFERRAL_STATUS_CONFIG: Record<ReferralStatus, { label: string; color: string; bgColor: string; borderColor: string }> = {
  sent: { label: 'Wysłano', color: 'text-slate-600', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
  registered: { label: 'Zarejestrowany', color: 'text-blue-600', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  demo: { label: 'Demo', color: 'text-amber-600', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  subscription: { label: 'Subskrypcja', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200' }
};

const BONUS_STATUS_CONFIG: Record<BonusStatus, { label: string; color: string }> = {
  pending: { label: 'Oczekuje', color: 'text-amber-600' },
  paid: { label: 'Wypłacony', color: 'text-green-600' }
};

export const CompanyReferralsPage: React.FC = () => {
  const { state, triggerNotification } = useAppContext();
  const { currentCompany, systemConfig } = state;

  const [copySuccess, setCopySuccess] = useState(false);

  // SMS Modal state
  const [isSMSModalOpen, setIsSMSModalOpen] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);
  const [smsData, setSmsData] = useState({
    firstName: '',
    phone: '',
    message: ''
  });

  // Get referral program settings from system config
  const minPaymentAmount = systemConfig.referralMinPaymentAmount || 100;
  const bonusAmount = systemConfig.referralBonusAmount || 50;

  // Generate unique referral link for this company (shortened)
  const fullReferralLink = useMemo(() => {
    if (!currentCompany) return '';
    return `${window.location.origin}/#/register?ref=${currentCompany.id}`;
  }, [currentCompany]);

  const [referralLink, setReferralLink] = useState(fullReferralLink);

  useEffect(() => {
    if (!fullReferralLink) return;
    let cancelled = false;
    createShortLink(fullReferralLink, state.currentUser?.id).then(shortUrl => {
      if (!cancelled && shortUrl) setReferralLink(shortUrl);
    });
    return () => { cancelled = true; };
  }, [fullReferralLink, state.currentUser?.id]);

  // Load referred companies from database
  const [referrals, setReferrals] = useState<CompanyReferral[]>([]);

  useEffect(() => {
    if (!currentCompany) return;
    // Find companies that were referred by this company
    const referred = state.companies.filter(c => c.referred_by_company_id === currentCompany.id);
    const mapped: CompanyReferral[] = referred.map(c => {
      let status: ReferralStatus = 'registered';
      if (c.subscription_status === 'active') status = 'subscription';
      else if (c.status === 'trial') status = 'demo';

      return {
        id: c.id,
        companyName: c.name || c.legal_name || '—',
        contactEmail: c.contact_email || '—',
        contactPhone: c.contact_phone || undefined,
        invitedAt: c.created_at,
        status,
        bonusStatus: c.referral_bonus_paid ? 'paid' : 'pending',
        bonusAmount: bonusAmount,
        paidAmount: c.referral_bonus_paid ? bonusAmount : undefined
      };
    });
    setReferrals(mapped);
  }, [currentCompany, state.companies, bonusAmount]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalInvited = referrals.length;
    const registered = referrals.filter(r => r.status !== 'sent').length;
    const withSubscription = referrals.filter(r => r.status === 'subscription').length;
    const totalEarned = referrals
      .filter(r => r.bonusStatus === 'paid')
      .reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    const pendingBonus = referrals
      .filter(r => r.bonusStatus === 'pending' && r.status === 'subscription')
      .reduce((sum, r) => sum + r.bonusAmount, 0);

    return { totalInvited, registered, withSubscription, totalEarned, pendingBonus };
  }, [referrals]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Share handlers
  const shareViaWhatsApp = () => {
    const text = encodeURIComponent(`Zapraszam do platformy MaxMaster! Zarejestruj się przez mój link i otrzymaj specjalne warunki: ${referralLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareViaTelegram = () => {
    const text = encodeURIComponent(`Zapraszam do platformy MaxMaster! Zarejestruj się przez mój link i otrzymaj specjalne warunki:`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${text}`, '_blank');
  };

  const shareViaEmail = () => {
    const subject = encodeURIComponent('Zaproszenie do MaxMaster');
    const body = encodeURIComponent(`Cześć!\n\nZapraszam do platformy MaxMaster - świetnego narzędzia do zarządzania firmą.\n\nZarejestruj się przez mój link polecający:\n${referralLink}\n\nPo rejestracji i dokonaniu pierwszej płatności (min. ${minPaymentAmount} zł) oboje otrzymamy bonus ${bonusAmount} zł!\n\nPozdrawiam`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const openSMSModal = () => {
    const defaultMessage = `Cześć {imię}! Zapraszam do MaxMaster! Zarejestruj się: ${referralLink} - po płatności min. ${minPaymentAmount} zł oboje dostaniemy bonus ${bonusAmount} zł!`;
    setSmsData({
      firstName: '',
      phone: '',
      message: defaultMessage
    });
    setIsSMSModalOpen(true);
  };

  // Format phone number as user types
  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.startsWith('48')) {
      const withoutCode = digits.slice(2);
      if (withoutCode.length <= 3) return `+48 ${withoutCode}`;
      if (withoutCode.length <= 6) return `+48 ${withoutCode.slice(0, 3)} ${withoutCode.slice(3)}`;
      return `+48 ${withoutCode.slice(0, 3)} ${withoutCode.slice(3, 6)} ${withoutCode.slice(6, 9)}`;
    } else {
      if (digits.length <= 3) return digits;
      if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
      return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}`;
    }
  };

  const handleSendSMS = async () => {
    if (!smsData.firstName || !smsData.phone) {
      triggerNotification('error', 'Błąd', 'Wypełnij imię i numer telefonu');
      return;
    }

    setIsSendingSMS(true);
    try {
      const finalMessage = smsData.message.replace(/\{imię\}/g, smsData.firstName);

      const result = await sendSMS({
        phoneNumber: smsData.phone,
        message: finalMessage,
        templateCode: 'SMS_REFERRAL'
      });

      if (result.success) {
        triggerNotification('success', 'SMS wysłany', `Zaproszenie wysłane do ${smsData.firstName}`);
        setIsSMSModalOpen(false);
      } else {
        triggerNotification('error', 'Błąd wysyłania SMS', result.error || 'Nie udało się wysłać SMS');
      }
    } catch (error) {
      console.error('Failed to send SMS:', error);
      triggerNotification('error', 'Błąd', 'Nie udało się wysłać SMS');
    } finally {
      setIsSendingSMS(false);
    }
  };

  if (!currentCompany) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center">
          <Info className="w-12 h-12 text-yellow-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-yellow-800 mb-2">Brak przypisanej firmy</h2>
          <p className="text-yellow-600">Skontaktuj się z administratorem platformy.</p>
        </div>
      </div>
    );
  }

  // Resolved message for preview
  const resolvedMessage = smsData.message.replace(/\{imię\}/g, smsData.firstName || '{imię}');

  return (
    <div className="p-4 lg:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Program Poleceń</h1>
          <p className="text-slate-500 mt-1">Zapraszaj inne firmy i zdobywaj bonusy na swoje konto</p>
        </div>

        {/* Balance cards */}
        <div className="flex gap-3">
          <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-xl text-center min-w-[120px]">
            <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider mb-1">Wypłacone</div>
            <div className="text-xl font-black text-green-700">{stats.totalEarned} zł</div>
          </div>
          <div className="bg-blue-50 border border-blue-200 px-4 py-3 rounded-xl text-center min-w-[120px]">
            <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider mb-1">Do wypłaty</div>
            <div className="text-xl font-black text-blue-700">{stats.pendingBonus} zł</div>
          </div>
        </div>
      </div>

      {/* Referral Link Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Share2 className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900">Twój unikalny link polecający</h2>
            <p className="text-sm text-slate-500">Udostępnij go innym firmom i zdobywaj bonusy</p>
          </div>
        </div>

        {/* Link input with copy */}
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            readOnly
            value={referralLink}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 font-mono focus:outline-none"
          />
          <button
            onClick={handleCopyLink}
            className={`px-4 py-3 rounded-xl border font-medium flex items-center gap-2 transition-all ${
              copySuccess
                ? 'bg-green-600 border-green-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {copySuccess ? <CheckCircle size={18} /> : <Copy size={18} />}
            <span className="hidden sm:inline">{copySuccess ? 'Skopiowano!' : 'Kopiuj'}</span>
          </button>
        </div>

        {/* Quick share buttons */}
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Szybkie udostępnianie</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <button
              onClick={shareViaWhatsApp}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-medium transition-colors"
            >
              <MessageCircle size={20} />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={shareViaTelegram}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors"
            >
              <Send size={20} />
              <span>Telegram</span>
            </button>
            <button
              onClick={shareViaEmail}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-medium transition-colors"
            >
              <Mail size={20} />
              <span>Email</span>
            </button>
            <button
              onClick={openSMSModal}
              className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium transition-colors"
            >
              <Phone size={20} />
              <span>SMS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Program Terms */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-6">
        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <Gift className="w-6 h-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 text-lg mb-2">Zasady Programu Poleceń</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-amber-800">1</span>
                </div>
                <p className="text-amber-800">
                  Udostępnij swój unikalny link polecający innej firmie.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-amber-800">2</span>
                </div>
                <p className="text-amber-800">
                  Zaproszona firma rejestruje się przez Twój link i aktywuje konto.
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-amber-200 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-amber-800">3</span>
                </div>
                <p className="text-amber-800">
                  <strong>Po dokonaniu pierwszej płatności minimum {minPaymentAmount} zł</strong> przez zaproszoną firmę,
                  na Twoje konto bonusowe zostanie naliczone <strong className="text-amber-900">{bonusAmount} zł</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 p-4 bg-white/60 rounded-xl border border-amber-200">
              <div className="flex items-center gap-2 text-amber-700">
                <CreditCard size={18} />
                <span className="font-semibold">Bonus można wykorzystać na opłacenie subskrypcji</span>
              </div>
              <p className="text-xs text-amber-600 mt-1">
                Twój aktualny balans bonusów: <strong>{currentCompany.bonus_balance?.toFixed(0) || 0} zł</strong>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Send size={20} className="text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalInvited}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Wysłano</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Users size={20} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.registered}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Zarejestrowanych</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <CreditCard size={20} className="text-green-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.withSubscription}</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Z subskrypcją</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4 text-center">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Gift size={20} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.totalEarned + stats.pendingBonus} zł</div>
          <div className="text-xs text-slate-500 uppercase tracking-wider">Łączny bonus</div>
        </div>
      </div>

      {/* Referrals List */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">Lista zaproszonych firm ({referrals.length})</h3>
        </div>

        {referrals.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4 text-left">Firma</th>
                  <th className="px-6 py-4 text-left">Kontakt</th>
                  <th className="px-6 py-4 text-left">Data zaproszenia</th>
                  <th className="px-6 py-4 text-left">Status</th>
                  <th className="px-6 py-4 text-right">Bonus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {referrals.map((referral) => {
                  const statusConfig = REFERRAL_STATUS_CONFIG[referral.status];
                  const bonusConfig = BONUS_STATUS_CONFIG[referral.bonusStatus];

                  return (
                    <tr key={referral.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{referral.companyName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-600">{referral.contactEmail}</div>
                        {referral.contactPhone && (
                          <div className="text-xs text-slate-400">{referral.contactPhone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(referral.invitedAt).toLocaleDateString('pl-PL')}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${statusConfig.bgColor} ${statusConfig.color} ${statusConfig.borderColor}`}>
                          {statusConfig.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-bold text-slate-900">{referral.bonusAmount} zł</div>
                        <div className={`text-xs ${bonusConfig.color}`}>{bonusConfig.label}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-slate-400" />
            </div>
            <h4 className="font-semibold text-slate-700 mb-2">Brak zaproszonych firm</h4>
            <p className="text-slate-500 text-sm max-w-md mx-auto">
              Udostępnij swój link polecający innym firmom, aby zacząć zdobywać bonusy!
            </p>
          </div>
        )}
      </div>

      {/* SMS Modal */}
      {isSMSModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-2xl w-full flex flex-col overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-purple-600 to-purple-500">
              <div>
                <h2 className="text-xl font-black text-white tracking-tight uppercase">Wyślij SMS Zaproszenie</h2>
                <p className="text-xs text-purple-100 font-medium mt-1">Wypełnij dane i wyślij zaproszenie SMS</p>
              </div>
              <button onClick={() => setIsSMSModalOpen(false)} className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all">
                <X size={24}/>
              </button>
            </div>

            <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
              {/* Name & Phone */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Imię</label>
                  <input
                    type="text"
                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="np. Jan"
                    value={smsData.firstName}
                    onChange={(e) => setSmsData({...smsData, firstName: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Numer Telefonu</label>
                  <input
                    type="tel"
                    className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-purple-500 focus:outline-none transition-colors"
                    placeholder="+48 500 123 456"
                    value={smsData.phone}
                    onChange={(e) => setSmsData({...smsData, phone: formatPhoneNumber(e.target.value)})}
                  />
                </div>
              </div>

              {/* SMS Message */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Treść SMS (max 160 znaków)</label>
                <details className="rounded-xl border-2 border-slate-200 bg-white">
                  <summary className="cursor-pointer select-none px-4 py-3 text-xs font-bold text-purple-600 hover:text-purple-800 flex items-center justify-between">
                    <span>Edytuj treść wiadomości</span>
                    <span className={smsData.message.length > 160 ? 'text-red-600 font-bold' : 'text-slate-400'}>
                      {smsData.message.length} / 160
                    </span>
                  </summary>
                  <div className="px-4 pb-4 pt-2 space-y-2">
                    <p className="text-xs text-slate-500">Użyj {'{imię}'} - zostanie automatycznie zastąpione imieniem odbiorcy.</p>
                    <textarea
                      className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-purple-500 focus:outline-none transition-colors resize-none"
                      rows={4}
                      placeholder="Treść SMS..."
                      value={smsData.message}
                      onChange={(e) => setSmsData({...smsData, message: e.target.value})}
                    />
                    <div className="flex justify-between text-xs">
                      <span className={smsData.message.length > 160 ? 'text-red-600 font-bold' : 'text-slate-500'}>
                        Szablon: {smsData.message.length} znaków
                      </span>
                      <span className={resolvedMessage.length > 160 ? 'text-red-600 font-bold' : 'text-green-600'}>
                        Po podstawieniu: {resolvedMessage.length} / 160
                      </span>
                    </div>
                  </div>
                </details>
              </div>

              {/* Preview */}
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-2">Podgląd wiadomości</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">
                  {resolvedMessage}
                </p>
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => setIsSMSModalOpen(false)}
                className="flex-1 text-sm font-black uppercase text-slate-500 hover:text-slate-700 transition-colors"
                disabled={isSendingSMS}
              >
                Anuluj
              </button>
              <button
                onClick={handleSendSMS}
                className="flex-[2] font-black uppercase text-sm tracking-widest bg-purple-600 hover:bg-purple-700 text-white rounded-xl py-3 px-6 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                disabled={isSendingSMS}
              >
                {isSendingSMS ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Wysyłanie...
                  </>
                ) : (
                  <>
                    <Phone size={16} />
                    Wyślij SMS
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
