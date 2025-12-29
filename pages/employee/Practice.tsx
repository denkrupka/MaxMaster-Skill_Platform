
import React from 'react';
import { CheckSquare, Clock, AlertCircle } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SkillStatus, VerificationType } from '../../types';
import { CHECKLIST_TEMPLATES } from '../../constants';

export const EmployeePractice = () => {
    const { state } = useAppContext();
    const { currentUser, skills, userSkills } = state;

    if (!currentUser) return null;

    const pendingPractice = userSkills
        .filter(us => us.user_id === currentUser.id && (us.status === SkillStatus.THEORY_PASSED || us.status === SkillStatus.PRACTICE_PENDING))
        .map(us => {
            const skill = skills.find(s => s.id === us.skill_id);
            return skill ? { ...us, skill } : null;
        })
        .filter(Boolean) as any[];

    const getChecklist = (skillId: string) => {
        const template = CHECKLIST_TEMPLATES.find(t => t.skill_id === skillId);
        if (template) return template.items;
        // Fallback
        const skill = skills.find(s => s.id === skillId);
        return skill?.criteria?.map((c, i) => ({ id: i, text_pl: c })) || [];
    };

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Weryfikacja Praktyczna</h1>
            <p className="text-slate-500 mb-8">
                Te umiejętności wymagają potwierdzenia przez Brygadzistę na budowie. Zgłoś się do przełożonego, aby zaliczyć zadanie.
            </p>

            <div className="space-y-6">
                {pendingPractice.map(item => (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                            <div className="flex gap-4">
                                <div className="p-3 bg-yellow-100 text-yellow-600 rounded-lg h-fit">
                                    <Clock size={24} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">{item.skill.name_pl}</h3>
                                    <p className="text-sm text-slate-500 mt-1">{item.skill.description_pl}</p>
                                    <div className="mt-2 inline-flex items-center px-2 py-1 rounded bg-green-50 text-green-700 text-xs font-bold border border-green-100">
                                        Nagroda: +{item.skill.hourly_bonus} zł/h
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-6 bg-slate-50">
                            <h4 className="font-bold text-slate-700 text-sm uppercase mb-3 tracking-wide">Kryteria weryfikacji (Checklista)</h4>
                            <div className="space-y-2">
                                {getChecklist(item.skill_id).map((c: any, idx: number) => (
                                    <div key={idx} className="flex items-start gap-3">
                                        <div className="mt-0.5 w-5 h-5 border-2 border-slate-300 rounded flex items-center justify-center bg-white">
                                            <div className="w-2.5 h-2.5 bg-slate-200 rounded-sm"></div>
                                        </div>
                                        <span className="text-sm text-slate-600">{c.text_pl}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 flex items-center gap-2 text-xs text-slate-500 bg-white p-3 rounded border border-slate-200">
                                <AlertCircle size={16} className="text-blue-500"/>
                                <span>Pamiętaj: Brygadzista ocenia jakość wykonania, czas i zachowanie zasad BHP.</span>
                            </div>
                        </div>
                    </div>
                ))}

                {pendingPractice.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
                        <CheckSquare size={48} className="mx-auto text-slate-300 mb-4"/>
                        <h3 className="text-lg font-bold text-slate-700">Wszystko na bieżąco</h3>
                        <p className="text-slate-500 mt-2">
                            Nie masz żadnych oczekujących weryfikacji praktycznych.
                            <br/>
                            Rozwiąż więcej <a href="#/dashboard/tests" className="text-blue-600 hover:underline">testów</a>, aby odblokować nowe zadania.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
