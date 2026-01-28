
import React, { useState, useMemo } from 'react';
import { UserPlus, Copy, CheckCircle, Clock, XCircle, AlertTriangle, TrendingUp, DollarSign, Share2, Info, X, Plus } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus, User, Position } from '../../types';
import { REFERRAL_STATUS_LABELS } from '../../constants';

export const EmployeeReferrals = () => {
    const { state, inviteFriend } = useAppContext();
    const { currentUser, users, systemConfig, positions } = state;
    
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    const [formData, setFormData] = useState({ firstName: '', lastName: '', phone: '', targetPosition: '' });

    if (!currentUser) return null;

    // --- LOGIC: Filter Referrals using real bonuses from Positions table ---
    const myReferrals = useMemo(() => {
        return users
            .filter(u => u.referred_by_id === currentUser.id)
            .map(u => {
                const now = new Date();
                const hiredDate = new Date(u.hired_date);
                const diffTime = Math.abs(now.getTime() - hiredDate.getTime());
                const daysWorking = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                
                // Map UserStatus to Referral Status
                let refStatus: 'invited' | 'offered' | 'working' | 'dismissed' = 'invited';
                if (u.status === UserStatus.INVITED || u.status === UserStatus.STARTED || u.status === UserStatus.TESTS_IN_PROGRESS) refStatus = 'invited';
                else if (u.status === UserStatus.TESTS_COMPLETED || u.status === UserStatus.OFFER_SENT || u.status === UserStatus.DATA_REQUESTED) refStatus = 'offered';
                else if (u.status === UserStatus.ACTIVE || u.status === UserStatus.TRIAL) refStatus = 'working';
                else if (u.status === UserStatus.INACTIVE || u.status === UserStatus.REJECTED) refStatus = 'dismissed';

                // Real bonus from positions array
                const positionData = positions.find(p => p.name === u.target_position);
                const bonusAmount = positionData?.referral_bonus || 0;
                
                const isBonusEarned = refStatus === 'working' && daysWorking >= 90;
                const progress = Math.min(100, Math.round((daysWorking / 90) * 100));

                return { ...u, refStatus, bonusAmount, isBonusEarned, daysWorking, progress };
            });
    }, [users, currentUser.id, positions]);

    // --- LOGIC: Balance ---
    const balance = useMemo(() => {
        return myReferrals.reduce((acc, curr) => {
            if (curr.referral_bonus_paid) {
                acc.earned += curr.bonusAmount;
            } else if (curr.isBonusEarned) {
                acc.pendingPayment += curr.bonusAmount;
            } else if (curr.refStatus === 'working') {
                acc.inProgress += curr.bonusAmount;
            }
            return acc;
        }, { earned: 0, pendingPayment: 0, inProgress: 0 });
    }, [myReferrals]);

    const referralLink = `${window.location.origin}/#/candidate/welcome?ref=${currentUser.id}${currentUser.company_id ? `&company=${currentUser.company_id}` : ''}`;

    const handleCopyLink = () => {
        navigator.clipboard.writeText(referralLink);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    const handleInviteSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        inviteFriend(formData.firstName, formData.lastName, formData.phone, formData.targetPosition);
        setFormData({ firstName: '', lastName: '', phone: '', targetPosition: '' });
        setIsInviteModalOpen(false);
    };

    // Filter positions that actually have a referral bonus set in HR settings
    const activeBonuses = useMemo(() => {
        return positions
            .filter(p => (p.referral_bonus || 0) > 0)
            .sort((a, b) => a.order - b.order);
    }, [positions]);

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-8 pb-24">
            {/* Header & Balance */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Zaproś znajomego</h1>
                    <p className="text-slate-500">Zarabiaj bonusy, pomagając znajomym znaleźć pracę w MaxMaster.</p>
                </div>
                <div className="flex gap-4">
                    <div className="bg-green-50 border border-green-200 p-4 rounded-xl text-center min-w-[140px] shadow-sm">
                        <div className="text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">Wypłacone</div>
                        <div className="text-2xl font-black text-green-700">{balance.earned} zł</div>
                    </div>
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl text-center min-w-[140px] shadow-sm">
                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-widest mb-1">Do wypłaty / W toku</div>
                        <div className="text-2xl font-black text-blue-700">{balance.pendingPayment + balance.inProgress} zł</div>
                    </div>
                </div>
            </div>

            {/* Actions Card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div>
                        <h3 className="font-bold text-slate-800 mb-2 flex items-center gap-2">
                            <Share2 size={20} className="text-blue-600"/> Twój link polecający
                        </h3>
                        <p className="text-sm text-slate-500 mb-4">Udostępnij ten link bezpośrednio znajomemu. System automatycznie przypisze go do Ciebie.</p>
                        <div className="flex gap-2">
                            <input 
                                className="flex-1 border border-slate-200 bg-slate-50 p-2 rounded-lg text-xs text-slate-500 font-mono focus:outline-none" 
                                value={referralLink} 
                                readOnly 
                            />
                            <button 
                                onClick={handleCopyLink}
                                className={`p-2 rounded-lg border transition-all ${copySuccess ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                            >
                                {copySuccess ? <CheckCircle size={18}/> : <Copy size={18}/>}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-600 p-6 rounded-2xl shadow-lg text-white flex flex-col justify-between relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform"><UserPlus size={100} /></div>
                    <div className="relative z-10">
                        <h3 className="font-bold mb-2 text-lg">Znasz fachowca?</h3>
                        <p className="text-blue-100 text-sm mb-6">Wpisz dane znajomego, a system wyśle mu SMS z zaproszeniem i Twoim poleceniem.</p>
                        <Button 
                            variant="secondary"
                            fullWidth 
                            className="bg-white hover:bg-blue-50 border-0 font-black shadow-md flex items-center justify-center h-12"
                            onClick={() => setIsInviteModalOpen(true)}
                        >
                            <Plus size={20} className="mr-2 text-blue-600"/> 
                            <span className="text-blue-600">Zaproś znajomego</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* Bonus Info Table - Now using real data from state.positions */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 shadow-sm">
                <div className="flex gap-4 items-start mb-6">
                    <div className="bg-amber-100 p-3 rounded-full text-amber-600 shadow-inner"><Info size={24}/></div>
                    <div>
                        <h4 className="font-bold text-amber-800 text-lg">Zasady Programu Poleceń</h4>
                        <p className="text-sm text-amber-700 leading-relaxed">
                            Bonus jest przyznawany i wypłacany po tym, jak polecony przez Ciebie pracownik przepracuje w MaxMaster <strong>pełne 3 miesiące (90 dni)</strong>.
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {activeBonuses.map((pos) => (
                        <div key={pos.id} className="bg-white/60 p-3 rounded-xl border border-amber-200 text-center shadow-sm hover:bg-white transition-colors">
                            <div className="text-[10px] font-black text-amber-600 uppercase mb-1 tracking-tighter truncate" title={pos.name}>{pos.name}</div>
                            <div className="text-lg font-black text-amber-900">{pos.referral_bonus} zł</div>
                        </div>
                    ))}
                    {activeBonuses.length === 0 && (
                        <div className="col-span-full text-center py-4 text-amber-600 font-medium italic">
                            Aktualnie brak zdefiniowanych bonusów za polecenia.
                        </div>
                    )}
                </div>
            </div>

            {/* Referral List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-800 uppercase text-xs tracking-widest">Twoi poleceni znajomi ({myReferrals.length})</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4">Znajomy</th>
                                <th className="px-6 py-4">Stanowisko</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Postęp (90 dni)</th>
                                <th className="px-6 py-4 text-right">Bonus / Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {myReferrals.map((ref) => {
                                let bonusStatusText = 'Oczekuje';
                                let bonusStatusColor = 'text-slate-400';
                                
                                if (ref.referral_bonus_paid) {
                                    bonusStatusText = 'Wypłacono';
                                    bonusStatusColor = 'text-green-600 font-black';
                                } else if (ref.isBonusEarned) {
                                    bonusStatusText = 'Gotowe do wypłaty';
                                    bonusStatusColor = 'text-blue-600 font-bold';
                                } else if (ref.refStatus === 'working') {
                                    bonusStatusText = 'W procesie naliczania';
                                    bonusStatusColor = 'text-blue-500';
                                }

                                return (
                                    <tr key={ref.id} className="hover:bg-slate-50/80 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{ref.first_name} {ref.last_name}</div>
                                            <div className="text-xs text-slate-500">{ref.phone}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-medium text-slate-600">{ref.target_position || 'Kandydat'}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${
                                                ref.refStatus === 'working' ? 'bg-green-50 text-green-700 border-green-200' :
                                                ref.refStatus === 'dismissed' ? 'bg-red-50 text-red-700 border-red-200' :
                                                'bg-blue-50 text-blue-700 border-blue-200'
                                            }`}>
                                                {REFERRAL_STATUS_LABELS[ref.refStatus]}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {ref.refStatus === 'working' ? (
                                                <div className="w-full max-w-[140px]">
                                                    <div className="flex justify-between text-[10px] mb-1.5 font-bold">
                                                        <span className="text-slate-500">{ref.daysWorking} / 90 dni</span>
                                                        <span className="text-blue-600">{ref.progress}%</span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden shadow-inner">
                                                        <div className="bg-blue-500 h-full transition-all duration-1000 ease-out shadow-sm" style={{ width: `${ref.progress}%` }}></div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <span className="text-slate-400 text-xs italic">Niedostępne</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className={`text-lg font-black ${ref.referral_bonus_paid ? 'text-green-600' : 'text-slate-900'}`}>
                                                {ref.bonusAmount} zł
                                            </div>
                                            <div className={`text-[10px] uppercase tracking-tighter mt-1 ${bonusStatusColor}`}>
                                                {bonusStatusText}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* INVITE MODAL */}
            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsInviteModalOpen(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 animate-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-bold text-slate-900">Zaproś znajomego</h2>
                            <button onClick={() => setIsInviteModalOpen(false)} className="p-1 hover:bg-slate-100 rounded-full transition-colors"><X size={24} className="text-slate-400"/></button>
                        </div>
                        <form onSubmit={handleInviteSubmit} className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Imię</label>
                                    <input 
                                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" 
                                        required 
                                        placeholder="Imię"
                                        value={formData.firstName}
                                        onChange={e => setFormData({...formData, firstName: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Nazwisko</label>
                                    <input 
                                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" 
                                        required 
                                        placeholder="Nazwisko"
                                        value={formData.lastName}
                                        onChange={e => setFormData({...formData, lastName: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Numer telefonu</label>
                                <input 
                                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium" 
                                    required 
                                    placeholder="+48 000 000 000"
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Stanowisko</label>
                                <select 
                                    className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium appearance-none" 
                                    required
                                    value={formData.targetPosition}
                                    onChange={e => setFormData({...formData, targetPosition: e.target.value})}
                                >
                                    <option value="">Wybierz stanowisko...</option>
                                    {positions.map(pos => <option key={pos.id} value={pos.name}>{pos.name}</option>)}
                                </select>
                            </div>
                            <div className="pt-6">
                                <Button type="submit" fullWidth className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 font-black h-14 text-lg">Zaproś znajomego</Button>
                                <button type="button" onClick={() => setIsInviteModalOpen(false)} className="w-full text-center mt-4 text-slate-400 font-medium hover:text-slate-600 transition-colors">Anuluj</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
