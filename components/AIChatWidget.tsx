import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Sparkles,
  Loader2,
  Bot,
  User as UserIcon,
  Minimize2,
  Maximize2,
  Trash2,
  HardHat,
} from 'lucide-react';
import { callRouteLLM } from '../services/routellmService';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AIChatWidgetProps {
  currentPage?: string;
  contextData?: string;
  userName?: string;
}

const SYSTEM_PROMPT = `Tu es l'assistant IA de Bel Air Habitat, une entreprise spécialisée dans la rénovation d'habitat.
Tu aides les utilisateurs à gérer leurs chantiers, clients, dépenses et planning.
Tu réponds toujours en français, de manière professionnelle, concise et utile.
Tu connais les sujets suivants :
- Gestion de projets de rénovation (phases : diagnostic, devis, préparation, démolition, gros œuvre, second œuvre, finitions, nettoyage, réception)
- Suivi financier (budgets, dépenses, factures)
- Gestion des clients et partenaires sous-traitants
- Planning et agenda des chantiers
- Normes et réglementations du bâtiment en France
- Estimation de coûts de rénovation
Si on te demande quelque chose hors de ton domaine, redirige poliment vers les fonctionnalités de l'application.`;

const AIChatWidget: React.FC<AIChatWidgetProps> = ({ currentPage, contextData, userName }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
      setShowPulse(false);
    }
  }, [isOpen]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Build context-aware messages
      const contextNote = currentPage 
        ? `\n[L'utilisateur est actuellement sur la page : ${currentPage}]` 
        : '';
      const dataNote = contextData 
        ? `\n[Données contextuelles : ${contextData}]` 
        : '';
      const userNote = userName 
        ? `\n[Utilisateur : ${userName}]` 
        : '';

      const llmMessages = [
        { role: 'system' as const, content: SYSTEM_PROMPT + contextNote + dataNote + userNote },
        ...messages.slice(-8).map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })),
        { role: 'user' as const, content: trimmed },
      ];

      const response = await callRouteLLM(llmMessages, {
        model: 'openai/gpt-4o-mini',
        temperature: 0.7,
        maxTokens: 800,
      });

      const assistantMessage: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Désolé, je ne peux pas répondre pour le moment. Vérifiez votre connexion ou réessayez plus tard.',
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, currentPage, contextData, userName]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const quickActions = [
    { label: 'Estimer un coût', prompt: 'Aide-moi à estimer le coût d\'une rénovation.' },
    { label: 'Résumé projet', prompt: 'Génère un résumé de l\'état de mes projets en cours.' },
    { label: 'Conseils planning', prompt: 'Quels conseils pour optimiser le planning de mes chantiers ?' },
  ];

  // Floating bubble
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 group"
        aria-label="Ouvrir l'assistant IA"
      >
        <div className={`relative p-4 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg shadow-teal-500/30 hover:shadow-xl hover:shadow-teal-500/40 hover:scale-105 transition-all duration-200 ${showPulse ? 'animate-pulse-soft' : ''}`}>
          <MessageCircle size={24} />
          <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-white animate-pulse" />
        </div>
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
          Assistant IA Bel Air
        </div>
      </button>
    );
  }

  // Chat panel
  const panelSize = isExpanded
    ? 'w-[480px] h-[640px]'
    : 'w-[380px] h-[520px]';

  return (
    <div className={`fixed bottom-6 right-6 z-50 ${panelSize} flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-elevated overflow-hidden animate-scale-in`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-white/20 rounded-lg">
            <Sparkles size={16} />
          </div>
          <div>
            <div className="font-semibold text-sm">Assistant IA</div>
            <div className="text-[10px] text-teal-100">Bel Air Habitat</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
              title="Effacer la conversation"
            >
              <Trash2 size={14} />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title={isExpanded ? 'Réduire' : 'Agrandir'}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"
            title="Fermer"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 mb-4">
              <HardHat size={32} className="text-teal-600 dark:text-teal-400" />
            </div>
            <h4 className="font-semibold text-slate-900 dark:text-white mb-1">Bonjour{userName ? `, ${userName}` : ''} !</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">
              Je suis votre assistant IA dédié à la gestion de vos projets de rénovation. Comment puis-je vous aider ?
            </p>
            <div className="w-full space-y-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(action.prompt);
                    setTimeout(() => inputRef.current?.focus(), 100);
                  }}
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-300 hover:border-teal-300 dark:hover:border-teal-700 hover:bg-teal-50/50 dark:hover:bg-teal-950/20 transition-all flex items-center gap-2"
                >
                  <Sparkles size={14} className="text-teal-500 flex-shrink-0" />
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center mt-0.5">
                    <Bot size={14} className="text-white" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-600 text-white rounded-br-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-md'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                  <div className={`text-[10px] mt-1 ${
                    msg.role === 'user' ? 'text-teal-200' : 'text-slate-400'
                  }`}>
                    {new Date(msg.timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {msg.role === 'user' && (
                  <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center mt-0.5">
                    <UserIcon size={14} className="text-slate-600 dark:text-slate-300" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2.5">
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
                  <Bot size={14} className="text-white" />
                </div>
                <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl rounded-bl-md">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez une question..."
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className="p-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
        <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5 text-center">
          Propulsé par IA • Bel Air Habitat
        </div>
      </div>
    </div>
  );
};

export default AIChatWidget;
