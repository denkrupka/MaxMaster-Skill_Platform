
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play, CheckCircle, Clock, AlertTriangle, ChevronRight, Lock, Circle, ArrowRight, X, ZoomIn } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Test, GradingStrategy, UserStatus, Role, Question } from '../../types';

export const CandidateTestsPage = () => {
    const { state, startTest, submitTest, updateUser } = useAppContext();
    const { currentUser, tests, skills } = state;
    const navigate = useNavigate();
    const location = useLocation();

    // --- State Management ---
    
    // Test Queue derived from previous step or default
    const [testQueue, setTestQueue] = useState<Test[]>([]);
    const [currentTestIndex, setCurrentTestIndex] = useState(0);
    
    // Current Test State
    const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
    const [answers, setAnswers] = useState<number[][]>([]);
    const [testStarted, setTestStarted] = useState(false);
    const [displayedQuestions, setDisplayedQuestions] = useState<Question[]>([]);
    
    // Timer State
    const [timeLeft, setTimeLeft] = useState(30);
    const [startTime, setStartTime] = useState<number | null>(null);

    // Image Zoom State
    const [zoomedImage, setZoomedImage] = useState<string | null>(null);
    
    // Interim Modal
    const [showInterimModal, setShowInterimModal] = useState(false);
    const [lastCompletedTest, setLastCompletedTest] = useState<{test: Test, passed: boolean, score: number} | null>(null);

    // Initialize
    useEffect(() => {
        if (!currentUser) return;

        let queueIds: string[] = [];
        
        // 1. Try to get from location state (Simulated selection)
        if (location.state && location.state.selectedTestIds) {
            queueIds = location.state.selectedTestIds;
        } 

        if (queueIds.length > 0) {
            const queue = tests.filter(t => queueIds.includes(t.id));
            setTestQueue(queue);
        }
    }, [currentUser, tests, location.state]);

    // Active Test Data
    const activeTest = testQueue[currentTestIndex];
    const progressPercent = testQueue.length > 0 ? ((currentTestIndex) / testQueue.length) * 100 : 0;

    // Helper function to shuffle array
    const shuffleArray = <T,>(array: T[]): T[] => {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    };

    // --- Timer Logic ---
    useEffect(() => {
        if (displayedQuestions.length > 0 && testStarted) {
            // Set time based on question config or default 30s
            const questionTime = displayedQuestions[currentQuestionIdx]?.timeLimit || 30;
            setTimeLeft(questionTime);
        }
    }, [currentQuestionIdx, displayedQuestions, testStarted]);

    useEffect(() => {
        if (!testStarted) return;

        if (timeLeft <= 0) {
            // Time is up! Auto advance.
            handleNextQuestion();
            return;
        }

        const timerId = setInterval(() => {
            setTimeLeft(prev => prev - 1);
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft, testStarted, handleNextQuestion]);

    // --- Handlers ---

    const handleStartTest = () => {
        if (!activeTest) return;
        if (!activeTest.questions || activeTest.questions.length === 0) {
            alert("Ten test nie ma jeszcze pytań. Skontaktuj się z administratorem.");
            return;
        }

        // Shuffle and potentially limit questions
        let questionsToUse = [...activeTest.questions];
        questionsToUse = shuffleArray(questionsToUse);

        // If questions_to_display is set and less than total, select that many questions
        if (activeTest.questions_to_display && activeTest.questions_to_display < questionsToUse.length) {
            questionsToUse = questionsToUse.slice(0, activeTest.questions_to_display);
        }

        setDisplayedQuestions(questionsToUse);
        setAnswers(new Array(questionsToUse.length).fill([]));
        setCurrentQuestionIdx(0);
        setTestStarted(true);
        setStartTime(Date.now()); // Capture start time
        startTest(activeTest.skill_ids[0]); // Log

        // Update status to 'tests_in_progress' if not already and ONLY IF CANDIDATE
        if (currentUser && currentUser.status === UserStatus.STARTED && currentUser.role === Role.CANDIDATE) {
            updateUser(currentUser.id, { status: UserStatus.TESTS_IN_PROGRESS });
        }
    };

    const handleAnswerSelect = (optionIdx: number, allowMultiple: boolean) => {
        const currentSelected = answers[currentQuestionIdx] || [];
        let newSelected: number[];

        if (allowMultiple) {
            if (currentSelected.includes(optionIdx)) {
                newSelected = currentSelected.filter(i => i !== optionIdx);
            } else {
                newSelected = [...currentSelected, optionIdx];
            }
        } else {
            newSelected = [optionIdx];
        }

        const newAnswers = [...answers];
        newAnswers[currentQuestionIdx] = newSelected;
        setAnswers(newAnswers);
    };

    const finishCurrentTest = useCallback(async () => {
        if (!activeTest) return;

        // Calculate Duration
        const durationMs = startTime ? Date.now() - startTime : 0;
        const durationSeconds = Math.round(durationMs / 1000);

        // Calculate Score
        let correctCount = 0;
        const totalQuestions = displayedQuestions.length;

        displayedQuestions.forEach((q, idx) => {
            const userAnswers = answers[idx] || [];
            const correctAnswers = q.correctOptionIndices;
            const strategy = q.gradingStrategy || GradingStrategy.ALL_CORRECT;

            let isCorrect = false;

            if (userAnswers.length > 0) {
                if (strategy === GradingStrategy.ANY_CORRECT) {
                    const intersection = userAnswers.filter(a => correctAnswers.includes(a));
                    if (intersection.length > 0) isCorrect = true;
                } else if (strategy === GradingStrategy.MIN_2_CORRECT) {
                    const intersection = userAnswers.filter(a => correctAnswers.includes(a));
                    if (intersection.length >= 2) isCorrect = true;
                } else {
                    const hasAllCorrect = correctAnswers.every(a => userAnswers.includes(a));
                    const hasNoIncorrect = userAnswers.every(a => correctAnswers.includes(a));
                    if (hasAllCorrect && hasNoIncorrect) isCorrect = true;
                }
            }

            if (isCorrect) correctCount++;
        });

        const calculatedScore = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
        const skill = skills.find(s => s.id === activeTest.skill_ids[0]);
        const passed = calculatedScore >= (skill?.required_pass_rate || 80);

        await submitTest(activeTest.id, answers, calculatedScore, passed);

        setLastCompletedTest({ test: activeTest, passed, score: calculatedScore });
        setTestStarted(false); // Stop "running" mode
        setShowInterimModal(true); // Show summary
    }, [activeTest, startTime, displayedQuestions, answers, skills, submitTest]);

    const handleNextQuestion = useCallback(async () => {
        if (currentQuestionIdx < displayedQuestions.length - 1) {
            setCurrentQuestionIdx(currentQuestionIdx + 1);
        } else {
            await finishCurrentTest();
        }
    }, [currentQuestionIdx, displayedQuestions.length, finishCurrentTest]);

    const handleNextTestInQueue = () => {
        setShowInterimModal(false);
        const nextIndex = currentTestIndex + 1;
        if (nextIndex < testQueue.length) {
            setCurrentTestIndex(nextIndex);
            setAnswers([]);
            setCurrentQuestionIdx(0);
        } else {
            handleAllTestsCompleted();
        }
    };

    const handleAllTestsCompleted = () => {
        if (currentUser) {
            if (currentUser.role === Role.CANDIDATE) {
                updateUser(currentUser.id, { status: UserStatus.TESTS_COMPLETED });
                navigate('/candidate/thank-you'); 
            } else {
                navigate('/dashboard/tests'); 
            }
        }
    };

    const handlePause = () => {
        if (currentUser?.role === Role.CANDIDATE) {
            navigate('/candidate/dashboard');
        } else {
            navigate('/dashboard/tests');
        }
    };

    if (!currentUser || testQueue.length === 0) {
        return (
            <div className="p-12 text-center text-slate-500 h-screen flex flex-col items-center justify-center">
                <p className="text-lg font-bold text-slate-700">Brak wybranych testów.</p>
                <p className="text-sm mt-2 mb-6">Nie wybrano żadnego testu do uruchomienia.</p>
                <Button onClick={handlePause}>Wróć do Panelu</Button>
            </div>
        );
    }

    const currentQuestion = displayedQuestions[currentQuestionIdx];

    return (
        <div className="min-h-screen bg-slate-50 flex">
            
            {/* 1. LEFT SIDEBAR (Progress) */}
            <aside className="w-80 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-10 hidden lg:flex">
                <div className="p-6 border-b border-slate-100">
                    <h2 className="font-bold text-slate-900">Twoje Testy</h2>
                    <p className="text-xs text-slate-500 mt-1">Postęp weryfikacji: {Math.round(progressPercent)}%</p>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
                        <div className="bg-blue-600 h-full transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {testQueue.map((test, index) => {
                        const skillName = skills.find(s => s.id === test.skill_ids[0])?.name_pl || test.title;
                        
                        let statusIcon = <Circle size={18} className="text-slate-300"/>;
                        let itemClass = "text-slate-500 hover:bg-slate-100";
                        let statusText = "Oczekuje";

                        if (index < currentTestIndex) {
                            statusIcon = <CheckCircle size={18} className="text-green-500"/>;
                            itemClass = "text-slate-800 bg-green-50/50";
                            statusText = "Zakończony";
                        } else if (index === currentTestIndex) {
                            statusIcon = <Play size={18} className="text-blue-600 fill-blue-100"/>;
                            itemClass = "text-blue-700 bg-blue-50 border-blue-200 shadow-sm";
                            statusText = "W trakcie";
                        }

                        return (
                            <div key={test.id} className={`p-3 rounded-lg border border-transparent flex items-center gap-3 transition-colors ${itemClass}`}>
                                <div className="flex-shrink-0">{statusIcon}</div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold truncate">{skillName}</p>
                                    <p className="text-xs opacity-80">{statusText}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                    <Button variant="ghost" fullWidth onClick={handlePause} className="text-slate-500">
                        Przerwij i wyjdź
                    </Button>
                </div>
            </aside>

            {/* 2. MAIN CONTENT */}
            <main className="flex-1 lg:ml-80 p-6 lg:p-12 flex flex-col max-w-5xl mx-auto w-full">
                
                {/* Header / Timer */}
                <div className="flex justify-between items-center mb-8">
                    <div className="lg:hidden">
                        <span className="text-sm font-bold text-slate-500">Test {currentTestIndex + 1} / {testQueue.length}</span>
                    </div>
                    
                    {testStarted && activeTest && (
                        <div className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-full shadow-sm border text-slate-700 transition-colors ${timeLeft <= 10 ? 'bg-red-50 border-red-200 text-red-600 animate-pulse' : 'bg-white border-slate-200'}`}>
                            <Clock size={18} />
                            <span className="font-mono font-bold">
                                {timeLeft}s
                            </span>
                        </div>
                    )}
                </div>

                {/* TEST AREA */}
                <div className="flex-1">
                    {!testStarted ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center max-w-2xl mx-auto mt-10">
                            <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Play size={40} className="ml-1" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">{activeTest.title}</h2>
                            <p className="text-slate-500 mb-8 leading-relaxed">
                                Test składa się z <strong>
                                    {activeTest.questions_to_display && activeTest.questions_to_display < activeTest.questions.length
                                        ? `${activeTest.questions_to_display} losowo wybranych`
                                        : activeTest.questions.length
                                    } pytań</strong>.
                                <br />
                                Czas na cały test: ok. <strong>{activeTest.time_limit_minutes} min</strong>.
                                <br />
                                Pamiętaj, na każde pytanie masz ograniczony czas. {activeTest.questions_to_display && activeTest.questions_to_display < activeTest.questions.length && <strong>Pytania będą w losowej kolejności!</strong>}
                            </p>
                            <Button size="lg" onClick={handleStartTest} className="px-12 shadow-blue-500/30 shadow-lg">
                                Rozpocznij Test
                            </Button>
                        </div>
                    ) : currentQuestion ? (
                        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-3xl mx-auto animate-in slide-in-from-right duration-300">
                            <div className="mb-6 flex justify-between items-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <span>Pytanie {currentQuestionIdx + 1} z {displayedQuestions.length}</span>
                                <span>Postęp w teście: {Math.round(((currentQuestionIdx + 1) / displayedQuestions.length) * 100)}%</span>
                            </div>

                            {currentQuestion.imageUrl && (
                                <div className="mb-6 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex justify-center relative group cursor-pointer" onClick={() => setZoomedImage(currentQuestion.imageUrl!)}>
                                    <img src={currentQuestion.imageUrl} alt="Ilustracja" className="max-h-64 object-contain" />
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                                        <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" size={32} />
                                    </div>
                                </div>
                            )}

                            <h3 className="text-xl font-bold text-slate-900 mb-6 leading-relaxed">
                                {currentQuestion.text}
                            </h3>

                            {currentQuestion.correctOptionIndices.length > 1 && (
                                <div className="mb-4 flex items-center gap-2 text-sm text-blue-600 bg-blue-50 px-3 py-2 rounded-lg w-fit font-medium">
                                    <CheckCircle size={16} /> W tym pytaniu może być kilka wariantów prawidłowych
                                </div>
                            )}

                            <div className="space-y-3 mb-8">
                                {currentQuestion.options.map((opt, idx) => {
                                    const isSelected = answers[currentQuestionIdx]?.includes(idx);
                                    const isMulti = currentQuestion.correctOptionIndices.length > 1;
                                    
                                    return (
                                        <button
                                            key={idx}
                                            onClick={() => handleAnswerSelect(idx, isMulti)}
                                            className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-4 group ${
                                                isSelected 
                                                ? 'border-blue-500 bg-blue-50 text-blue-800 shadow-sm' 
                                                : 'border-slate-100 hover:border-blue-200 hover:bg-slate-50 text-slate-700'
                                            }`}
                                        >
                                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                                isSelected ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 group-hover:border-blue-300'
                                            }`}>
                                                {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                                            </div>
                                            <span className="font-medium text-base">{opt}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden mb-6">
                                <div 
                                    className={`h-full transition-all duration-1000 ease-linear ${timeLeft <= 5 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                    style={{ width: `${(timeLeft / (currentQuestion.timeLimit || 30)) * 100}%` }}
                                ></div>
                            </div>

                            <div className="flex justify-end pt-6 border-t border-slate-100">
                                <Button
                                    size="lg"
                                    onClick={handleNextQuestion}
                                    className="px-8"
                                >
                                    {currentQuestionIdx < displayedQuestions.length - 1 ? 'Następne Pytanie' : 'Zakończ Test'}
                                    <ChevronRight size={18} className="ml-2" />
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="p-8 text-center text-slate-400">Błąd ładowania pytania.</div>
                    )}
                </div>
            </main>

            {/* 3. INTERIM MODAL */}
            {showInterimModal && lastCompletedTest && (
                <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 text-center animate-in zoom-in duration-300">
                        {lastCompletedTest.passed ? (
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle size={32} />
                            </div>
                        ) : (
                            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                                <X size={32} />
                            </div>
                        )}
                        
                        <h2 className="text-2xl font-bold text-slate-900 mb-2">{lastCompletedTest.passed ? 'Test Zakończony!' : 'Test Niezaliczony'}</h2>
                        
                        <div className="text-slate-500 mb-8 space-y-4">
                            <p>
                                Test: <strong className="text-slate-800">{lastCompletedTest.test.title}</strong>
                                <br/>
                                Wynik: <strong className={lastCompletedTest.passed ? 'text-green-600' : 'text-red-600'}>{lastCompletedTest.score}%</strong>
                            </p>
                            
                            {(!lastCompletedTest.passed && currentUser.status === UserStatus.TRIAL) && (
                                <div className="bg-red-50 p-4 rounded-lg text-sm text-red-700 border border-red-100 flex items-start gap-3 text-left">
                                    <Clock size={18} className="shrink-0 mt-0.5"/>
                                    <span>
                                        Niestety, nie udało się zaliczyć testu. Kolejne podejście będzie możliwe dopiero za <strong>24 godziny</strong>.
                                    </span>
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-3">
                            <Button 
                                fullWidth 
                                size="lg" 
                                onClick={handleNextTestInQueue}
                                className="shadow-lg shadow-blue-500/20"
                            >
                                {currentTestIndex + 1 < testQueue.length ? 'Przejdź do kolejnego testu' : 'Zakończ weryfikację'}
                                <ArrowRight size={18} className="ml-2" />
                            </Button>
                            
                            {currentTestIndex + 1 < testQueue.length && (
                                <Button 
                                    fullWidth 
                                    variant="ghost" 
                                    onClick={handlePause}
                                    className="text-slate-400 hover:text-slate-600"
                                >
                                    Zakończ na teraz (wróć później)
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 4. IMAGE ZOOM MODAL */}
            {zoomedImage && (
                <div 
                    className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
                    onClick={() => setZoomedImage(null)}
                >
                    <button 
                        onClick={() => setZoomedImage(null)}
                        className="absolute top-4 right-4 text-white hover:text-gray-300 bg-white/10 p-2 rounded-full backdrop-blur-sm"
                    >
                        <X size={32} />
                    </button>
                    <img 
                        src={zoomedImage} 
                        alt="Zoomed Question" 
                        className="max-w-full max-h-[90vh] object-contain rounded shadow-2xl animate-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()} 
                    />
                </div>
            )}

        </div>
    );
};
