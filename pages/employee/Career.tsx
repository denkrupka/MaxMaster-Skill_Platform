
import React, { useMemo } from 'react';
import { TrendingUp, Award, Star, CheckCircle, Lock, User, Briefcase, ChevronRight, Zap, BookOpen, Shield } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { SkillCategory, SkillStatus } from '../../types';

interface CareerStep {
    id: number;
    title: string;
    description: string;
    requiredCategories: SkillCategory[];
    minSkillsRequired: number; // Threshold to consider "ready" for next
    responsibilities: string[];
}

const CAREER_PATH: CareerStep[] = [
    {
        id: 1,
        title: 'Pomocnik',
        description: 'Początek kariery. Nauka podstaw i wsparcie zespołu.',
        requiredCategories: [SkillCategory.INNE, SkillCategory.UPRAWNIENIA],
        minSkillsRequired: 1, // e.g. BHP or basic intro
        responsibilities: [
            'Dbanie o porządek na stanowisku pracy',
            'Pomoc w transporcie materiałów',
            'Wsparcie elektromonterów w prostych pracach'
        ]
    },
    {
        id: 2,
        title: 'Elektromonter',
        description: 'Samodzielny montaż tras i okablowania.',
        requiredCategories: [SkillCategory.MONTAZ, SkillCategory.ELEKTRYKA],
        minSkillsRequired: 3,
        responsibilities: [
            'Montaż tras kablowych (koryta, drabinki)',
            'Układanie okablowania',
            'Montaż osprzętu (gniazda, łączniki)'
        ]
    },
    {
        id: 3,
        title: 'Elektryk',
        description: 'Zaawansowane prace łączeniowe i pomiary.',
        requiredCategories: [SkillCategory.ELEKTRYKA, SkillCategory.AUTOMATYKA, SkillCategory.UPRAWNIENIA],
        minSkillsRequired: 5,
        responsibilities: [
            'Prefabrykacja i podłączanie rozdzielnic',
            'Wykonywanie pomiarów elektrycznych',
            'Czytanie schematów ideowych'
        ]
    },
    {
        id: 4,
        title: 'Brygadzista',
        description: 'Zarządzanie małym zespołem i weryfikacja jakości.',
        requiredCategories: [SkillCategory.BRYGADZISTA, SkillCategory.UPRAWNIENIA],
        minSkillsRequired: 2,
        responsibilities: [
            'Organizacja pracy zespołu',
            'Weryfikacja jakości wykonania (Odbiory wewnętrzne)',
            'Raportowanie postępów do Kierownika'
        ]
    },
    {
        id: 5,
        title: 'Koordynator Robót',
        description: 'Nadzór nad odcinkiem robót i materiałami.',
        requiredCategories: [SkillCategory.BRYGADZISTA, SkillCategory.POMIARY],
        minSkillsRequired: 4,
        responsibilities: [
            'Zamawianie materiałów',
            'Rozwiązywanie kolizji na budowie',
            'Harmonogramowanie prac'
        ]
    },
    {
        id: 6,
        title: 'Kierownik Robót',
        description: 'Pełna odpowiedzialność za kontrakt i ludzi.',
        requiredCategories: [SkillCategory.BRYGADZISTA, SkillCategory.INNE], // Placeholder logic
        minSkillsRequired: 5,
        responsibilities: [
            'Rozliczenia finansowe budowy',
            'Kontakt z Inwestorem',
            'Nadzór nad BHP i dokumentacją'
        ]
    }
];

export const EmployeeCareer = () => {
    const { state } = useAppContext();
    const { currentUser, skills, userSkills } = state;

    if (!currentUser) return null;

    // --- LOGIC: Determine Current Level Index ---
    // Fallback to 0 (Pomocnik) if exact match not found
    const currentLevelIndex = useMemo(() => {
        const idx = CAREER_PATH.findIndex(step => step.title === currentUser.target_position);
        return idx !== -1 ? idx : 0;
    }, [currentUser.target_position]);

    // --- LOGIC: Calculate Progress Per Level ---
    const getLevelProgress = (step: CareerStep) => {
        // Find all system skills that match the categories required by this step
        const relevantSkills = skills.filter(s => step.requiredCategories.includes(s.category));
        
        // Count how many of these the user has CONFIRMED
        const userConfirmedCount = relevantSkills.reduce((acc, skill) => {
            const hasSkill = userSkills.find(us => us.skill_id === skill.id && us.status === SkillStatus.CONFIRMED);
            return hasSkill ? acc + 1 : acc;
        }, 0);

        // Cap at the requirement for display logic (e.g. don't show 5/3) or show actual? 
        // Let's show actual vs min required.
        const percentage = Math.min(100, Math.round((userConfirmedCount / step.minSkillsRequired) * 100));

        return {
            userCount: userConfirmedCount,
            required: step.minSkillsRequired,
            percentage,
            relevantSkills
        };
    };

    return (
        <div className="p-6 max-w-4xl mx-auto pb-24">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Ścieżka Rozwoju</h1>
                <p className="text-slate-500">
                    Twoja droga awansu w MaxMaster. Zdobywaj umiejętności, aby odblokować kolejne poziomy i wyższe stawki.
                </p>
            </div>

            <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-8 top-8 bottom-8 w-0.5 bg-slate-200 hidden md:block"></div>

                <div className="space-y-8">
                    {CAREER_PATH.map((step, index) => {
                        const isPast = index < currentLevelIndex;
                        const isCurrent = index === currentLevelIndex;
                        const isFuture = index > currentLevelIndex;
                        
                        const progress = getLevelProgress(step);

                        return (
                            <div key={step.id} className={`relative flex flex-col md:flex-row gap-6 ${isFuture ? 'opacity-70' : 'opacity-100'}`}>
                                
                                {/* Timeline Icon */}
                                <div className="hidden md:flex flex-col items-center z-10">
                                    <div className={`
                                        w-16 h-16 rounded-full border-4 flex items-center justify-center shadow-sm transition-all
                                        ${isCurrent ? 'bg-blue-600 border-blue-100 text-white scale-110 shadow-blue-200' : ''}
                                        ${isPast ? 'bg-green-100 border-green-50 text-green-600' : ''}
                                        ${isFuture ? 'bg-slate-50 border-slate-200 text-slate-400' : ''}
                                    `}>
                                        {isPast ? <CheckCircle size={24}/> : (isCurrent ? <TrendingUp size={28}/> : <Lock size={24}/>)}
                                    </div>
                                </div>

                                {/* Content Card */}
                                <div className={`flex-1 rounded-2xl border transition-all duration-300 overflow-hidden ${
                                    isCurrent 
                                    ? 'bg-white border-blue-200 shadow-lg ring-1 ring-blue-100' 
                                    : (isPast ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100')
                                }`}>
                                    
                                    {/* Card Header */}
                                    <div className={`px-6 py-4 flex justify-between items-center ${isCurrent ? 'bg-blue-50/50' : ''}`}>
                                        <div>
                                            <div className="flex items-center gap-3">
                                                <h3 className={`text-lg font-bold ${isCurrent ? 'text-blue-800' : 'text-slate-800'}`}>
                                                    {step.title}
                                                </h3>
                                                {isCurrent && (
                                                    <span className="bg-blue-600 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                                                        <User size={10}/> Twój poziom
                                                    </span>
                                                )}
                                                {isPast && (
                                                    <span className="bg-green-100 text-green-700 text-[10px] uppercase font-bold px-2 py-0.5 rounded-full">
                                                        Zaliczone
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-sm text-slate-500 mt-1">{step.description}</p>
                                        </div>
                                        {isFuture && <Lock size={20} className="text-slate-300"/>}
                                    </div>

                                    {/* Card Body */}
                                    <div className="p-6 pt-4 space-y-6">
                                        
                                        {/* Responsibilities */}
                                        <div>
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                                                <Briefcase size={14}/> Odpowiedzialność
                                            </h4>
                                            <ul className="space-y-2">
                                                {step.responsibilities.map((resp, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                                        <div className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCurrent ? 'bg-blue-400' : 'bg-slate-300'}`}></div>
                                                        {resp}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>

                                        {/* Requirements Progress */}
                                        <div className={`bg-slate-50 rounded-xl p-4 border ${isCurrent ? 'border-blue-100' : 'border-slate-100'}`}>
                                            <div className="flex justify-between items-end mb-2">
                                                <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-2">
                                                    <Award size={14} className={isCurrent ? 'text-blue-500' : 'text-slate-400'}/> Wymagane Kompetencje
                                                </h4>
                                                <div className="text-right">
                                                    <span className={`text-lg font-bold ${progress.userCount >= progress.required ? 'text-green-600' : 'text-slate-700'}`}>
                                                        {progress.userCount}
                                                    </span>
                                                    <span className="text-sm text-slate-400"> / {progress.required}</span>
                                                </div>
                                            </div>
                                            
                                            {/* Progress Bar */}
                                            <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden mb-3">
                                                <div 
                                                    className={`h-full transition-all duration-1000 ${
                                                        progress.userCount >= progress.required ? 'bg-green-500' : (isCurrent ? 'bg-blue-500' : 'bg-slate-400')
                                                    }`} 
                                                    style={{ width: `${progress.percentage}%` }}
                                                ></div>
                                            </div>

                                            <div className="flex flex-wrap gap-2 mt-3">
                                                {step.requiredCategories.map((cat, i) => (
                                                    <span key={i} className="text-[10px] border border-slate-200 bg-white text-slate-500 px-2 py-1 rounded shadow-sm">
                                                        {cat}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        {/* CTA for Current Level */}
                                        {isCurrent && (
                                            <div className="flex justify-end pt-2">
                                                <div className="text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg font-medium flex items-center gap-2">
                                                    <Zap size={14}/>
                                                    Uzupełnij brakujące umiejętności w zakładce "Testy", aby awansować.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
