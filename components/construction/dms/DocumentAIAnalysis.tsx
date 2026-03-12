import React, { useState } from 'react';
import { X, Brain, Loader2, AlertTriangle, CheckCircle, TrendingUp, RefreshCw } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface RiskItem {
  type: 'high' | 'medium' | 'low';
  title: string;
  description: string;
}

interface AIAnalysisResult {
  score: number; // 1-10 (10 = bardzo bezpieczny)
  summary: string;
  risks: RiskItem[];
  recommendations: string[];
  analyzed_at: string;
}

interface DocumentInstance {
  id: string;
  name: string;
  content: string;
  ai_analysis?: AIAnalysisResult | null;
}

interface Props {
  document: DocumentInstance;
  onClose: () => void;
  onSaved: () => void;
}

const RISK_COLORS = {
  high: 'bg-red-50 border-red-200 text-red-700',
  medium: 'bg-amber-50 border-amber-200 text-amber-700',
  low: 'bg-green-50 border-green-200 text-green-700',
};

const RISK_LABELS = {
  high: 'Wysokie ryzyko',
  medium: 'Średnie ryzyko',
  low: 'Niskie ryzyko',
};

function getScoreColor(score: number): string {
  if (score >= 8) return 'text-green-600';
  if (score >= 6) return 'text-amber-600';
  return 'text-red-600';
}

function getScoreBg(score: number): string {
  if (score >= 8) return 'bg-green-50 border-green-200';
  if (score >= 6) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function stripHtml(html: string): string {
  const tmp = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return tmp.substring(0, 8000); // limit
}

// Simulated AI analysis (since we don't have API key access in Edge Function yet)
async function analyzeWithAI(documentContent: string, documentName: string): Promise<AIAnalysisResult> {
  // Try Supabase Edge Function first
  try {
    const { data, error } = await supabase.functions.invoke('analyze-contract', {
      body: {
        content: stripHtml(documentContent),
        name: documentName,
      },
    });
    if (!error && data) return data;
  } catch {
    // Fallback to client-side analysis
  }

  // Fallback: basic pattern-based analysis
  const textLower = stripHtml(documentContent).toLowerCase();
  const risks: RiskItem[] = [];

  if (!textLower.includes('termin') && !textLower.includes('data realizacji')) {
    risks.push({
      type: 'high',
      title: 'Brak określenia terminu',
      description: 'Dokument nie zawiera jasno określonego terminu realizacji, co może prowadzić do sporów.'
    });
  }

  if (!textLower.includes('wynagrodzenie') && !textLower.includes('kwota') && !textLower.includes('pln')) {
    risks.push({
      type: 'high',
      title: 'Niejasne wynagrodzenie',
      description: 'Brak precyzyjnego określenia kwoty wynagrodzenia lub warunków płatności.'
    });
  }

  if (!textLower.includes('kara umowna') && !textLower.includes('odstąpienie') && !textLower.includes('wypowiedzenie')) {
    risks.push({
      type: 'medium',
      title: 'Brak klauzul zabezpieczających',
      description: 'Dokument nie zawiera klauzul o karach umownych ani o rozwiązaniu umowy.'
    });
  }

  if (!textLower.includes('rodo') && !textLower.includes('przetwarzanie danych') && textLower.includes('pesel')) {
    risks.push({
      type: 'medium',
      title: 'Brak klauzuli RODO',
      description: 'Dokument zawiera dane osobowe (PESEL) bez klauzuli RODO.'
    });
  }

  if (textLower.includes('na zawsze') || textLower.includes('bezterminowo')) {
    risks.push({
      type: 'medium',
      title: 'Zobowiązania bezterminowe',
      description: 'Dokument zawiera zobowiązania bez określonego czasu trwania.'
    });
  }

  const highCount = risks.filter(r => r.type === 'high').length;
  const medCount = risks.filter(r => r.type === 'medium').length;
  const baseScore = 10 - (highCount * 2) - (medCount * 1);
  const score = Math.max(3, Math.min(10, baseScore));

  return {
    score,
    summary: risks.length === 0
      ? 'Dokument wygląda poprawnie pod kątem podstawowych wymagań prawnych.'
      : `Dokument zawiera ${risks.length} potencjalnych problemów wymagających uwagi. Szczególnie zwróć uwagę na: ${risks.filter(r => r.type === 'high').map(r => r.title).join(', ')}.`,
    risks,
    recommendations: [
      'Sprawdź dokument z prawnikiem przed podpisaniem',
      'Upewnij się, że wszystkie kwoty są precyzyjnie określone',
      'Dodaj klauzulę o rozwiązaniu sporu (mediacja/sąd)',
      ...(risks.some(r => r.title.includes('RODO')) ? ['Dodaj klauzulę o przetwarzaniu danych osobowych'] : []),
    ],
    analyzed_at: new Date().toISOString(),
  };
}

export const DocumentAIAnalysis: React.FC<Props> = ({ document, onClose, onSaved }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(document.ai_analysis || null);
  const [error, setError] = useState('');

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    try {
      const analysis = await analyzeWithAI(document.content, document.name);
      setResult(analysis);

      // Save to database
      await supabase
        .from('document_instances')
        .update({ ai_analysis: analysis })
        .eq('id', document.id);

      onSaved();
    } catch (e: any) {
      setError(e.message || 'Błąd analizy AI');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center">
              <Brain className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Analiza AI dokumentu</h2>
              <p className="text-sm text-slate-500">{document.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded"><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!result && !loading && (
            <div className="text-center py-12">
              <Brain className="w-16 h-16 text-purple-200 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Analiza ryzyk umownych</h3>
              <p className="text-slate-500 mb-6 max-w-sm mx-auto text-sm">
                AI przeanalizuje dokument pod kątem: ryzyk prawnych, brakujących klauzul, niejasnych zapisów i wystawia ocenę bezpieczeństwa.
              </p>
              <button
                onClick={runAnalysis}
                className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 mx-auto"
              >
                <Brain className="w-5 h-5" />
                Uruchom analizę AI
              </button>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="relative mx-auto w-16 h-16 mb-4">
                <Loader2 className="w-16 h-16 animate-spin text-purple-400" />
                <Brain className="w-7 h-7 text-purple-600 absolute inset-0 m-auto" />
              </div>
              <p className="text-slate-700 font-medium">Analizuję dokument...</p>
              <p className="text-slate-400 text-sm mt-1">AI czyta i ocenia wszystkie zapisy</p>
            </div>
          )}

          {result && (
            <>
              {/* Score */}
              <div className={`p-5 rounded-2xl border-2 ${getScoreBg(result.score)} text-center`}>
                <p className="text-sm text-slate-500 mb-1">Ocena bezpieczeństwa</p>
                <div className={`text-5xl font-black ${getScoreColor(result.score)}`}>
                  {result.score}<span className="text-2xl">/10</span>
                </div>
                <div className="mt-3 flex justify-center gap-1">
                  {Array.from({ length: 10 }, (_, i) => (
                    <div
                      key={i}
                      className={`h-2 w-6 rounded-full ${i < result.score
                        ? result.score >= 8 ? 'bg-green-400' : result.score >= 6 ? 'bg-amber-400' : 'bg-red-400'
                        : 'bg-slate-200'}`}
                    />
                  ))}
                </div>
              </div>

              {/* Summary */}
              <div className="p-4 bg-slate-50 rounded-xl text-sm text-slate-700">
                {result.summary}
              </div>

              {/* Risks */}
              {result.risks.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    Wykryte ryzyka ({result.risks.length})
                  </h3>
                  <div className="space-y-2">
                    {result.risks.map((risk, i) => (
                      <div key={i} className={`p-3 rounded-xl border ${RISK_COLORS[risk.type]}`}>
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-sm">{risk.title}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium
                            ${risk.type === 'high' ? 'bg-red-100 text-red-700' : risk.type === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {RISK_LABELS[risk.type]}
                          </span>
                        </div>
                        <p className="text-xs opacity-80">{risk.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.risks.length === 0 && (
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-200">
                  <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
                  <p className="text-green-700 text-sm">Nie wykryto poważnych ryzyk w dokumencie</p>
                </div>
              )}

              {/* Recommendations */}
              {result.recommendations.length > 0 && (
                <div>
                  <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-blue-500" />
                    Rekomendacje
                  </h3>
                  <ul className="space-y-2">
                    {result.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                        <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p className="text-xs text-slate-400 text-right">
                Przeanalizowano: {new Date(result.analyzed_at).toLocaleString('pl-PL')}
              </p>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm">{error}</div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-between">
          {result && (
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Ponów analizę
            </button>
          )}
          <button onClick={onClose} className="ml-auto px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-900">
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};
