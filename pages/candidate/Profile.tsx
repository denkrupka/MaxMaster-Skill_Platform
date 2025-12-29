
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User as UserIcon, Lock, Mail, Phone, Briefcase, Save, Check, Send, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { UserStatus, User, Role } from '../../types';

export const CandidateProfilePage = () => {
    const { state, updateUser, logCandidateAction, triggerNotification } = useAppContext();
    const { currentUser } = state;
    const [successMsg, setSuccessMsg] = useState('');

    // File Viewer
    const [fileViewer, setFileViewer] = useState<{isOpen: boolean, urls: string[], title: string, index: number}>({ isOpen: false, urls: [], title: '', index: 0 });

    const [formData, setFormData] = useState({
        phone: '',
        password: '',
        confirmPassword: ''
    });

    // Contract Data Form
    const [contractData, setContractData] = useState<Partial<User>>({
        pesel: '',
        birth_date: '',
        citizenship: '',
        document_type: 'Dowód osobisty',
        document_number: '',
        zip_code: '',
        city: '',
        street: '',
        house_number: '',
        apartment_number: '',
        bank_account: '',
        nip: ''
    });

    useEffect(() => {
        if (currentUser) {
            setFormData(prev => ({ ...prev, phone: currentUser.phone || '' }));
            setContractData({
                pesel: currentUser.pesel || '',
                birth_date: currentUser.birth_date || '',
                citizenship: currentUser.citizenship || '',
                document_type: currentUser.document_type || 'Dowód osobisty',
                document_number: currentUser.document_number || '',
                zip_code: currentUser.zip_code || '',
                city: currentUser.city || '',
                street: currentUser.street || '',
                house_number: currentUser.house_number || '',
                apartment_number: currentUser.apartment_number || '',
                bank_account: currentUser.bank_account || '',
                nip: currentUser.nip || ''
            });
        }
    }, [currentUser]);

    // Logic for auto-selecting document type based on citizenship
    useEffect(() => {
        if (contractData.citizenship) {
            const cit = contractData.citizenship;
            if (cit === 'Polskie') {
                setContractData(prev => ({ ...prev, document_type: 'Dowód osobisty' }));
            } else {
                setContractData(prev => ({ ...prev, document_type: 'Paszport' }));
            }
        }
    }, [contractData.citizenship]);

    // --- Input Mask Handlers ---
    
    const handleZipCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 5) val = val.slice(0, 5);
        if (val.length > 2) val = val.slice(0, 2) + '-' + val.slice(2);
        setContractData({ ...contractData, zip_code: val });
    };

    const handleBankAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 26) val = val.slice(0, 26);
        val = val.replace(/(.{4})/g, '$1 ').trim();
        setContractData({ ...contractData, bank_account: val });
    };

    const handlePeselChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, '');
        if (val.length > 11) val = val.slice(0, 11);
        setContractData({ ...contractData, pesel: val });
    };

    if (!currentUser) return null;

    const isDataRequested = currentUser.status === UserStatus.DATA_REQUESTED || currentUser.status === UserStatus.OFFER_SENT;
    const isDataSubmitted = currentUser.status === UserStatus.DATA_SUBMITTED;

    const handleSave = () => {
        if (formData.password && formData.password !== formData.confirmPassword) {
            alert("Hasła nie są identyczne.");
            return;
        }

        const updates: any = { 
            phone: formData.phone,
            ...contractData // Include contract data in main save
        };
        
        updateUser(currentUser.id, updates);
        logCandidateAction(currentUser.id, 'Zaktualizowano profil (Dane osobowe/kontaktowe)');
        
        // Notify HR about update
        const hrLink = currentUser.role === Role.EMPLOYEE ? '/hr/employees' : (currentUser.status === UserStatus.TRIAL ? '/hr/trial' : '/hr/candidates');
        triggerNotification(
            'status_change', 
            'Aktualizacja Danych', 
            `Użytkownik ${currentUser.first_name} ${currentUser.last_name} zaktualizował swoje dane.`, 
            hrLink
        );

        setSuccessMsg('Dane zostały zapisane.');
        setTimeout(() => setSuccessMsg(''), 3000);
        setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    };

    const renderFileViewer = () => {
        if (!fileViewer.isOpen) return null;
        const currentUrl = fileViewer.urls[fileViewer.index];
        const hasNext = fileViewer.index < fileViewer.urls.length - 1;
        const hasPrev = fileViewer.index > 0;
        const isPdf = currentUrl.toLowerCase().endsWith('.pdf');

        return (
            <div className="fixed inset-0 bg-black/90 z-[110] flex flex-col p-4 animate-in fade-in duration-200" onClick={() => setFileViewer({isOpen: false, urls: [], title: '', index: 0})}>
                <div className="flex justify-between items-center mb-4 text-white">
                    <h3 className="font-bold text-lg">{fileViewer.title} {fileViewer.urls.length > 1 && `(${fileViewer.index + 1}/${fileViewer.urls.length})`}</h3>
                    <button onClick={() => setFileViewer({isOpen: false, urls: [], title: '', index: 0})}><X size={24}/></button>
                </div>
                <div className="flex-1 flex items-center justify-center relative overflow-hidden h-full" onClick={e => e.stopPropagation()}>
                    {hasPrev && (
                        <button 
                            className="absolute left-4 z-10 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); setFileViewer(prev => ({...prev, index: prev.index - 1})); }}
                        >
                            <ChevronLeft size={32}/>
                        </button>
                    )}
                    
                    <div className="w-full h-full flex items-center justify-center p-4">
                        {isPdf ? (
                            <iframe src={currentUrl} className="w-full h-full bg-white rounded-lg" title={`Document ${fileViewer.index}`}/>
                        ) : (
                            <img src={currentUrl} alt={`Document ${fileViewer.index}`} className="max-w-full max-h-full object-contain" />
                        )}
                    </div>

                    {hasNext && (
                        <button 
                            className="absolute right-4 z-10 bg-white/10 hover:bg-white/20 p-2 rounded-full text-white transition-colors"
                            onClick={(e) => { e.stopPropagation(); setFileViewer(prev => ({...prev, index: prev.index + 1})); }}
                        >
                            <ChevronRight size={32}/>
                        </button>
                    )}
                </div>
                <div className="h-12 flex justify-center items-center gap-2 mt-2">
                    {fileViewer.urls.map((_, idx) => (
                        <div 
                            key={idx} 
                            className={`w-2 h-2 rounded-full ${idx === fileViewer.index ? 'bg-white' : 'bg-white/30'}`}
                        />
                    ))}
                </div>
            </div>
        );
    };

    // HISTORY TAB RENDERING
    const history = state.candidateHistory.filter(h => h.candidate_id === currentUser.id).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="p-6 max-w-3xl mx-auto pb-24">
             <h1 className="text-2xl font-bold text-slate-900 mb-6">Mój Profil</h1>

             {successMsg && (
                <div className="mb-6 bg-green-100 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center animate-in fade-in slide-in-from-top-2">
                    <Check size={20} className="mr-2"/> {successMsg}
                </div>
            )}

             <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center gap-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-2xl font-bold">
                        {currentUser.first_name[0]}{currentUser.last_name[0]}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold text-slate-900">{currentUser.first_name} {currentUser.last_name}</h2>
                        <p className="text-sm text-slate-500">Kandydat • {currentUser.email}</p>
                    </div>
                 </div>
                 
                 <div className="p-8 space-y-6">
                     
                     {/* Contract Data Section - Visible if Requested or Submitted */}
                     {(isDataRequested || isDataSubmitted || currentUser.status === UserStatus.TRIAL || currentUser.status === UserStatus.ACTIVE) && (
                         <>
                            <div className="mb-6">
                                <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2 text-lg">
                                    Dane osobowe
                                </h3>
                                
                                <div className="space-y-6">
                                    {/* Row 1 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">STANOWISKO</label>
                                            <input 
                                                className="w-full border p-2 rounded bg-slate-50 text-slate-600" 
                                                value={currentUser.target_position || '-'} 
                                                disabled 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">PESEL</label>
                                            <input 
                                                className={`w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors ${(!!currentUser.pesel && currentUser.pesel.length > 0) ? 'text-slate-500 bg-slate-50 cursor-not-allowed' : ''}`}
                                                value={contractData.pesel} 
                                                onChange={handlePeselChange} 
                                                maxLength={11} 
                                                disabled={isDataSubmitted || (!!currentUser.pesel && currentUser.pesel.length > 0)} 
                                                placeholder="XXXXXXXXXXX"
                                            />
                                            {(!!currentUser.pesel && currentUser.pesel.length > 0) && <span className="text-[10px] text-slate-400">Edycja zablokowana</span>}
                                        </div>
                                    </div>

                                    {/* Row 2 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">DATA URODZENIA</label>
                                            <input 
                                                type="date"
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.birth_date} 
                                                onChange={e => setContractData({...contractData, birth_date: e.target.value})}
                                                disabled={isDataSubmitted} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">OBYWATELSTWO</label>
                                            <select 
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.citizenship} 
                                                onChange={e => setContractData({...contractData, citizenship: e.target.value})}
                                                disabled={isDataSubmitted}
                                            >
                                                <option value="">Wybierz...</option>
                                                <option value="Polskie">Polskie</option>
                                                <option value="Ukraińskie">Ukraińskie</option>
                                                <option value="Białoruskie">Białoruskie</option>
                                                <option value="Inne">Inne</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Row 3 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">RODZAJ DOKUMENTU</label>
                                            <select 
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.document_type} 
                                                onChange={e => setContractData({...contractData, document_type: e.target.value})}
                                                disabled={isDataSubmitted}
                                            >
                                                <option value="Dowód osobisty">Dowód osobisty</option>
                                                <option value="Paszport">Paszport</option>
                                                <option value="Karta Pobytu">Karta Pobytu</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR DOKUMENTU</label>
                                            <input 
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.document_number} 
                                                onChange={e => setContractData({...contractData, document_number: e.target.value})}
                                                disabled={isDataSubmitted} 
                                            />
                                        </div>
                                    </div>

                                    {/* Address Header */}
                                    <div className="pt-4 pb-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">Adres Zamieszkania</div>

                                    {/* Row 4 */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ULICA</label>
                                        <input 
                                            className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                            value={contractData.street} 
                                            onChange={e => setContractData({...contractData, street: e.target.value})}
                                            disabled={isDataSubmitted} 
                                        />
                                    </div>

                                    {/* Row 5 */}
                                    <div className="grid grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR DOMU</label>
                                            <input 
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.house_number} 
                                                onChange={e => setContractData({...contractData, house_number: e.target.value})}
                                                disabled={isDataSubmitted} 
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR LOKALU</label>
                                            <input 
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.apartment_number} 
                                                onChange={e => setContractData({...contractData, apartment_number: e.target.value})}
                                                disabled={isDataSubmitted} 
                                            />
                                        </div>
                                    </div>

                                    {/* Row 6 */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">KOD POCZTOWY</label>
                                            <input 
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.zip_code} 
                                                onChange={handleZipCodeChange}
                                                disabled={isDataSubmitted} 
                                                placeholder="XX-XXX"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">MIASTO</label>
                                            <input 
                                                className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors" 
                                                value={contractData.city} 
                                                onChange={e => setContractData({...contractData, city: e.target.value})}
                                                disabled={isDataSubmitted} 
                                            />
                                        </div>
                                    </div>

                                    {/* Bank Header */}
                                    <div className="pt-4 pb-2 border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">Bankowość</div>

                                    {/* Row 7 */}
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">NR KONTA BANKOWEGO</label>
                                        <input 
                                            className="w-full border-b-2 border-slate-200 bg-white p-2 focus:border-blue-500 focus:outline-none transition-colors font-mono tracking-wide" 
                                            value={contractData.bank_account} 
                                            onChange={handleBankAccountChange}
                                            disabled={isDataSubmitted} 
                                            placeholder="00 0000 0000 0000 0000 0000 0000"
                                        />
                                    </div>
                                </div>
                            </div>
                         </>
                     )}

                     <div className="border-t border-slate-100 my-6"></div>

                     {/* Editable Fields */}
                     <div>
                         <h3 className="font-bold text-slate-900 mb-4">Dane Kontaktowe i Bezpieczeństwo</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Numer Telefonu</label>
                                <div className="relative">
                                    <Phone size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        className="w-full border border-slate-300 rounded-lg p-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.phone}
                                        onChange={e => setFormData({...formData, phone: e.target.value})}
                                        placeholder="+48 000 000 000"
                                    />
                                </div>
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Nowe Hasło</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type="password"
                                        className="w-full border border-slate-300 rounded-lg p-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.password}
                                        onChange={e => setFormData({...formData, password: e.target.value})}
                                        placeholder="Wpisz nowe hasło"
                                    />
                                </div>
                             </div>

                             <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Potwierdź Hasło</label>
                                <div className="relative">
                                    <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"/>
                                    <input 
                                        type="password"
                                        className="w-full border border-slate-300 rounded-lg p-3 pl-10 focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.confirmPassword}
                                        onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                                        placeholder="Powtórz hasło"
                                    />
                                </div>
                             </div>
                         </div>
                     </div>
                 </div>

                 <div className="p-6 bg-slate-50 border-t border-slate-200 flex justify-end">
                     <Button onClick={handleSave}>
                         <Save size={18} className="mr-2"/> Zapisz Zmiany
                     </Button>
                 </div>
             </div>

             {/* History Section */}
             <div className="mt-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                 <div className="p-6 border-b border-slate-100 bg-slate-50">
                     <h3 className="font-bold text-slate-900 text-lg">Historia Aktywności</h3>
                 </div>
                 <div className="p-6">
                    <div className="space-y-4">
                        {history.map(h => {
                            let typeBadge = null;
                            const lowerAction = h.action.toLowerCase();
                            
                            // Determine type badge
                            if (lowerAction.includes('test')) {
                                typeBadge = <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 uppercase font-bold ml-2">Teoria</span>;
                            } else if (lowerAction.includes('praktyk') || lowerAction.includes('weryfikacj')) {
                                typeBadge = <span className="text-[10px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded border border-orange-200 uppercase font-bold ml-2">Praktyka</span>;
                            }

                            // Determine if negative (rejected/failed)
                            const isNegative = lowerAction.includes('odrzucono') || lowerAction.includes('niezaliczony') || lowerAction.includes('failed') || lowerAction.includes('błąd');
                            
                            return (
                                <div key={h.id} className={`flex gap-4 p-3 border-b border-slate-100 last:border-0 rounded-lg transition-colors ${isNegative ? 'bg-red-50/50' : 'hover:bg-slate-50'}`}>
                                    <div className="text-slate-400 text-xs w-24 flex-shrink-0 pt-1">
                                        <div className="font-mono">{new Date(h.date).toLocaleDateString()}</div>
                                        <div className="font-mono">{new Date(h.date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                    </div>
                                    <div>
                                        <div className="flex items-center flex-wrap">
                                            <span className={`text-sm font-medium ${isNegative ? 'text-red-700' : 'text-slate-900'}`}>{h.action}</span>
                                            {typeBadge}
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">Użytkownik: <span className="font-semibold">{h.performed_by}</span></div>
                                    </div>
                                </div>
                            );
                        })}
                        {history.length === 0 && <p className="text-slate-400 italic text-sm text-center py-4">Brak historii aktywności.</p>}
                    </div>
                 </div>
             </div>

             {renderFileViewer()}
        </div>
    );
};
