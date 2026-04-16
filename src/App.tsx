/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { 
  Mic, 
  MicOff, 
  FileText, 
  ClipboardCheck, 
  User, 
  Calendar, 
  GraduationCap, 
  Briefcase, 
  Stethoscope, 
  Link as LinkIcon,
  Loader2,
  Trash2,
  Copy,
  Check,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Types ---

interface InterviewData {
  nome: string;
  idade: string;
  escolaridade: string;
  profissiografia: string;
  doenca: string;
  nexoCausalidade: string;
}

// --- Gemini Service ---

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function extractInterviewData(transcription: string): Promise<InterviewData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: transcription,
    config: {
      systemInstruction: `Você é um assistente especializado em organizar relatos de entrevistas ocupacionais na Advocacia Franco. Sua tarefa é extrair e organizar as informações de forma clara, coesa e formal, mantendo total fidelidade ao depoimento original sem qualquer enriquecimento interpretativo.

DIRETRIZES DE EXTRAÇÃO:
1. NOME, IDADE, ESCOLARIDADE: Extraia conforme relatado.
2. DOENÇA E CID: Identifique a doença relatada e atribua o código CID-10 correspondente.
3. PROFISSIOGRAFIA: Identifique a profissão e descreva as funções realizadas baseando-se EXCLUSIVAMENTE nas atividades narradas pelo entrevistado.
4. NEXO DE CAUSALIDADE: Transcreva e organize o relato do entrevistado sobre por que a doença alegada o impede ou dificulta de exercer suas funções laborais.

REGRAS DE OURO:
- BASEIE-SE EXCLUSIVAMENTE no que foi dito. Proibido usar conhecimento externo.
- NÃO acrescente explicações técnicas, termos médicos não citados ou relações de causa e efeito não mencionadas pelo entrevistado.
- NÃO amplie o conteúdo. Apenas reescreva o que foi dito de forma clara e formal.
- Se não identificado, use "Não informado".
- Retorne os dados em formato JSON.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          nome: { type: Type.STRING },
          idade: { type: Type.STRING },
          escolaridade: { type: Type.STRING },
          profissiografia: { type: Type.STRING },
          doenca: { type: Type.STRING },
          nexoCausalidade: { type: Type.STRING },
        },
        required: ["nome", "idade", "escolaridade", "profissiografia", "doenca", "nexoCausalidade"]
      }
    }
  });

  try {
    return JSON.parse(response.text || "{}") as InterviewData;
  } catch (e) {
    console.error("Error parsing Gemini response:", e);
    throw new Error("Falha ao processar a transcrição.");
  }
}

// --- Components ---

export default function App() {
  const [transcription, setTranscription] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<InterviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [interimText, setInterimText] = useState('');
  
  const recognitionRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when transcription or interimText changes
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [transcription, interimText]);

  useEffect(() => {
    // Initialize Web Speech API if available
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        
        if (finalTranscript) {
          setTranscription(prev => {
            const trimmedPrev = prev.trim();
            if (!trimmedPrev) return finalTranscript;
            // Continuous flow: append with comma and space
            return trimmedPrev + ', ' + finalTranscript;
          });
          setInterimText('');
        } else {
          // Clean interim transcript to avoid excessive spaces
          setInterimText(interimTranscript.trim());
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };
    }
  }, []);

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (!recognitionRef.current) {
        alert("Reconhecimento de voz não suportado neste navegador.");
        return;
      }
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  const handleProcess = async () => {
    if (!transcription.trim()) return;
    
    setIsProcessing(true);
    setError(null);
    try {
      const data = await extractInterviewData(transcription);
      setResult(data);
    } catch (err) {
      setError("Ocorreu um erro ao processar a entrevista. Tente novamente.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `Ficha de Entrevista:

Nome: ${result.nome}
Idade: ${result.idade}
Escolaridade: ${result.escolaridade}
Profissiografia: ${result.profissiografia}
Doença: ${result.doenca}
Nexo de Causalidade: ${result.nexoCausalidade}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearAll = () => {
    setTranscription('');
    setResult(null);
    setError(null);
  };

  const handleFieldChange = (field: keyof InterviewData, value: string) => {
    if (!result) return;
    setResult({ ...result, [field]: value });
  };

  return (
    <div className="min-h-screen flex flex-col bg-bg-main">
      {/* Header */}
      <header className="bg-primary text-white px-10 py-6 flex items-center justify-between border-b border-accent/20">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-bold tracking-tight text-accent">Advocacia Franco</span>
          <div className="h-6 w-[1px] bg-white/10 hidden sm:block" />
          <div className="hidden sm:block">
            <h1 className="text-xs font-bold tracking-[0.3em] uppercase text-white/90">Ficha Profissiográfica</h1>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-4">
          <div className="px-3 py-1 rounded border border-accent/20 text-[9px] font-bold uppercase tracking-widest text-accent/80">
            Saúde do Trabalhador • v2.0
          </div>
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[4fr_6fr] gap-[1px] bg-border-main overflow-hidden">
        {/* Left Column: Input */}
        <section className="bg-card-bg p-12 flex flex-col space-y-10 border-r border-border-main">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-accent" />
              Transcrição em Tempo Real
            </h2>
            {isRecording && (
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Gravando</span>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col space-y-8">
            <div className="relative flex-1">
              <div 
                ref={scrollContainerRef}
                className="w-full h-full p-8 rounded-xl border border-border-main bg-[#fafafa] text-text-main text-base leading-loose overflow-y-auto shadow-inner relative scroll-smooth focus-within:border-accent/40 transition-colors"
              >
                <div className="whitespace-pre-wrap break-words min-h-full pb-10">
                  {transcription}
                  {interimText && (
                    <span className="text-accent opacity-60"> {interimText}</span>
                  )}
                  {!transcription && !interimText && (
                    <span className="text-gray-300 italic">O texto transcrito aparecerá aqui conforme você fala...</span>
                  )}
                </div>
                {!isRecording && (
                  <textarea
                    value={transcription}
                    onChange={(e) => setTranscription(e.target.value)}
                    className="absolute inset-0 w-full h-full p-8 bg-transparent outline-none resize-none opacity-0 focus:opacity-100 focus:bg-[#fafafa] transition-opacity"
                  />
                )}
              </div>
              {transcription && (
                <button 
                  onClick={clearAll}
                  className="absolute top-4 right-4 p-2 text-gray-300 hover:text-red-500 transition-colors bg-white rounded-full shadow-sm"
                  title="Limpar tudo"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-5">
              <button
                onClick={toggleRecording}
                className={`flex items-center justify-center gap-3 py-3.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all border ${
                  isRecording 
                  ? 'bg-red-50 text-red-600 border-red-200 animate-pulse' 
                  : 'bg-white text-text-main border-border-main hover:bg-bg-main hover:border-accent/30'
                }`}
              >
                {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
                {isRecording ? 'Parar' : 'Gravar'}
              </button>
              
              <button
                onClick={handleProcess}
                disabled={!transcription.trim() || isProcessing}
                className="flex items-center justify-center gap-3 py-3.5 rounded-md text-xs font-bold uppercase tracking-widest bg-primary text-accent hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
                {isProcessing ? 'Processando...' : 'Gerar Ficha'}
              </button>
            </div>
          </div>

          {error && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-red-50 border border-red-100 text-red-600 rounded text-xs font-bold uppercase"
            >
              {error}
            </motion.div>
          )}
        </section>

        {/* Right Column: Result */}
        <section className="bg-card-bg p-12 flex flex-col relative overflow-y-auto">
          <div className="border-b border-border-main pb-6 mb-10 flex items-center justify-between">
            <h2 className="text-[10px] font-black text-primary uppercase tracking-[0.3em] flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-accent" />
              Dados Consolidados
            </h2>
            {result && (
              <button 
                onClick={handleCopy}
                className="flex items-center gap-2 text-[10px] font-bold bg-primary text-accent hover:bg-black px-5 py-2.5 rounded shadow-sm transition-all uppercase tracking-widest"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copiado' : 'Copiar Ficha'}
              </button>
            )}
          </div>

          <div className="flex-1">
            <AnimatePresence mode="wait">
              {isProcessing ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full flex flex-col items-center justify-center text-center p-12 bg-[#fafafa] rounded-lg border border-border-main"
                >
                  <Loader2 size={48} className="text-accent animate-spin mb-6" />
                  <h3 className="text-xs font-bold text-primary uppercase tracking-[0.2em]">Processando Análise</h3>
                  <p className="text-text-muted text-sm mt-3 italic">
                    O Gemini está extraindo as evidências para o nexo causal.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  key="form"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="ficha-grid grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6"
                >
                  <InfoField 
                    label="Nome Completo" 
                    value={result?.nome} 
                    onChange={(val) => handleFieldChange('nome', val)}
                  />
                  <InfoField 
                    label="Idade" 
                    value={result?.idade} 
                    onChange={(val) => handleFieldChange('idade', val)}
                  />
                  <InfoField 
                    label="Escolaridade" 
                    value={result?.escolaridade} 
                    onChange={(val) => handleFieldChange('escolaridade', val)}
                  />
                  <InfoField 
                    label="Doença Relatada" 
                    value={result?.doenca} 
                    onChange={(val) => handleFieldChange('doenca', val)}
                  />
                  <InfoField 
                    label="Profissiografia" 
                    value={result?.profissiografia} 
                    onChange={(val) => handleFieldChange('profissiografia', val)}
                    fullWidth 
                    large
                  />
                  <InfoField 
                    label="Nexo de Causalidade" 
                    value={result?.nexoCausalidade} 
                    onChange={(val) => handleFieldChange('nexoCausalidade', val)}
                    fullWidth
                    large
                    highlight
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-card-bg px-10 py-6 border-t border-border-main flex justify-end gap-5">
        <button 
          onClick={clearAll}
          className="px-8 py-3 rounded border border-border-main text-xs font-bold text-text-main hover:bg-bg-main hover:border-accent/30 transition-all uppercase tracking-[0.2em]"
        >
          Refazer Transcrição
        </button>
        <button 
          onClick={() => alert('Função de exportação em desenvolvimento.')}
          className="px-8 py-3 rounded bg-primary text-accent text-xs font-bold hover:bg-black transition-all uppercase tracking-[0.2em] shadow-md"
        >
          Exportar PDF Laudo
        </button>
      </footer>
    </div>
  );
}

function InfoField({ 
  label, 
  value, 
  onChange,
  fullWidth = false, 
  highlight = false,
  large = false
}: { 
  label: string; 
  value?: string; 
  onChange?: (val: string) => void;
  fullWidth?: boolean;
  highlight?: boolean;
  large?: boolean;
}) {
  const isEmpty = !value;
  
  return (
    <div className={`${fullWidth ? 'col-span-full' : ''} flex flex-col space-y-2`}>
      <label className="text-[10px] font-extrabold text-text-muted uppercase tracking-[0.2em]">{label}</label>
      <div className={`rounded-md border transition-all ${
        highlight 
        ? 'bg-[#fdf9f0] border-accent/30 text-primary' 
        : isEmpty 
          ? 'bg-white border-dashed border-border-main text-text-muted/40' 
          : 'bg-bg-main border-border-main text-primary'
      } ${large ? 'min-h-[140px]' : 'min-h-[48px]'} flex`}>
        <textarea
          value={value || ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="—"
          className={`w-full h-full bg-transparent px-5 py-4 outline-none resize-none text-[15px] font-medium leading-relaxed ${isEmpty ? 'placeholder:text-text-muted/40' : ''}`}
          rows={large ? 5 : 1}
        />
      </div>
    </div>
  );
}
