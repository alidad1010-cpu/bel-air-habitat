import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Calendar,
  CheckSquare,
  XCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CheckCircle2,
  PhoneCall,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  StickyNote,
  Send,
  Trash2,
  Mic,
  Users,
  LayoutDashboard,
  Activity,
  Sparkles,
  Zap,
  Target,
  HardHat,
  Hammer,
  PaintBucket,
  ShieldCheck,
  AlertTriangle,
  Eye,
  ChevronRight,
  Building2,
  Wallet,
  CalendarDays,
  CircleDot,
  Timer,
} from 'lucide-react';
import { Project, ProjectStatus, User, AppNotification } from '../types';
import { SharedNote } from '../App';
import { DashboardCharts } from './DashboardCharts';

interface DashboardProps {
  projects: Project[];
  onNavigate: (tab: string, statusFilter?: ProjectStatus | 'ALL' | null) => void;
  notes?: SharedNote[];
  onAddNote?: (text: string) => void;
  onDeleteNote?: (id: string) => void;
  currentUser?: User;
  notifications?: AppNotification[];
}

// ─── MODERN METRIC CARD ─────────────────────────────────────────────
interface MetricCardProps {
  value: number | string;
  label: string;
  icon: React.ElementType;
  color: 'teal' | 'amber' | 'rose' | 'blue' | 'emerald' | 'violet' | 'slate';
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
  subtitle?: string;
}

const colorMap = {
  teal: {
    iconBg: 'bg-teal-50 dark:bg-teal-950/30',
    iconColor: 'text-teal-600 dark:text-teal-400',
    accent: 'text-teal-600',
    ring: 'ring-teal-100 dark:ring-teal-900/30',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    accent: 'text-amber-600',
    ring: 'ring-amber-100 dark:ring-amber-900/30',
  },
  rose: {
    iconBg: 'bg-rose-50 dark:bg-rose-950/30',
    iconColor: 'text-rose-600 dark:text-rose-400',
    accent: 'text-rose-600',
    ring: 'ring-rose-100 dark:ring-rose-900/30',
  },
  blue: {
    iconBg: 'bg-blue-50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    accent: 'text-blue-600',
    ring: 'ring-blue-100 dark:ring-blue-900/30',
  },
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    accent: 'text-emerald-600',
    ring: 'ring-emerald-100 dark:ring-emerald-900/30',
  },
  violet: {
    iconBg: 'bg-violet-50 dark:bg-violet-950/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    accent: 'text-violet-600',
    ring: 'ring-violet-100 dark:ring-violet-900/30',
  },
  slate: {
    iconBg: 'bg-slate-100 dark:bg-slate-800',
    iconColor: 'text-slate-600 dark:text-slate-400',
    accent: 'text-slate-600',
    ring: 'ring-slate-100 dark:ring-slate-800',
  },
};

const MetricCard: React.FC<MetricCardProps> = ({ value, label, icon: Icon, color, trend, onClick, subtitle }) => {
  const c = colorMap[color];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-soft hover:shadow-medium hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 group ring-1 ${c.ring}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-xl ${c.iconBg}`}>
          <Icon size={20} strokeWidth={1.8} className={c.iconColor} />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-semibold px-2 py-1 rounded-lg ${
            trend.isPositive 
              ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30' 
              : 'text-rose-700 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/30'
          }`}>
            {trend.isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {trend.isPositive ? '+' : ''}{trend.value}%
          </div>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-0.5">
        {value}
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</div>
      {subtitle && <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">{subtitle}</div>}
      <div className="mt-3 flex items-center text-xs font-medium text-slate-400 group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
        Voir détails <ChevronRight size={14} className="ml-0.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </button>
  );
};

const MemoizedMetricCard = React.memo(MetricCard);

// ─── AI INSIGHTS WIDGET ─────────────────────────────────────────────
const AIInsightsWidget: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const insights = useMemo(() => {
    const results: Array<{ icon: React.ElementType; text: string; type: 'warning' | 'success' | 'info' }> = [];
    
    // Late projects
    const lateCount = projects.filter(p => {
      if (!p.endDate) return false;
      return new Date(p.endDate) < new Date() && 
        ![ProjectStatus.COMPLETED, ProjectStatus.REFUSED, ProjectStatus.LOST, ProjectStatus.CANCELLED].includes(p.status);
    }).length;
    if (lateCount > 0) {
      results.push({ icon: AlertTriangle, text: `${lateCount} chantier${lateCount > 1 ? 's' : ''} en retard — action requise`, type: 'warning' });
    }

    // Callbacks needed
    const callbackCount = projects.filter(p => p.needsCallback).length;
    if (callbackCount > 0) {
      results.push({ icon: PhoneCall, text: `${callbackCount} rappel${callbackCount > 1 ? 's' : ''} client en attente`, type: 'warning' });
    }

    // High budget projects in progress
    const highBudget = projects.filter(p => p.status === ProjectStatus.IN_PROGRESS && (p.budget || 0) > 50000);
    if (highBudget.length > 0) {
      results.push({ icon: Eye, text: `${highBudget.length} chantier${highBudget.length > 1 ? 's' : ''} à fort budget en cours (>50K€)`, type: 'info' });
    }

    // Success rate
    const wonProjects = projects.filter(p => [ProjectStatus.VALIDATED, ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED, ProjectStatus.WAITING_VALIDATION].includes(p.status)).length;
    const lostProjects = projects.filter(p => [ProjectStatus.LOST, ProjectStatus.REFUSED, ProjectStatus.CANCELLED].includes(p.status)).length;
    const total = wonProjects + lostProjects;
    if (total > 5) {
      const rate = Math.round((wonProjects / total) * 100);
      results.push({ 
        icon: rate >= 60 ? Target : AlertCircle, 
        text: `Taux de conversion : ${rate}% (${wonProjects}/${total} dossiers)`, 
        type: rate >= 60 ? 'success' : 'info' 
      });
    }

    // New projects this month
    const now = new Date();
    const thisMonth = projects.filter(p => {
      const created = new Date(p.createdAt);
      return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
    }).length;
    if (thisMonth > 0) {
      results.push({ icon: Zap, text: `${thisMonth} nouveau${thisMonth > 1 ? 'x' : ''} dossier${thisMonth > 1 ? 's' : ''} ce mois`, type: 'info' });
    }

    // If no insights, add a default one
    if (results.length === 0) {
      results.push({ icon: CheckCircle2, text: 'Tout est en ordre — aucune alerte en cours', type: 'success' });
    }

    return results.slice(0, 5); // Max 5 insights
  }, [projects]);

  const typeStyles = {
    warning: 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/40',
    success: 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40',
    info: 'bg-blue-50 dark:bg-blue-950/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800/40',
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md shadow-violet-500/20">
          <Sparkles size={20} />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">Insights IA</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Analyse intelligente de votre activité</p>
        </div>
        <div className="ml-auto px-2 py-1 bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 text-[10px] font-bold rounded-full uppercase tracking-wider">
          Auto
        </div>
      </div>

      <div className="space-y-2.5">
        {insights.map((insight, i) => {
          const IconComponent = insight.icon;
          return (
            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${typeStyles[insight.type]}`}>
              <IconComponent size={16} className="mt-0.5 flex-shrink-0" />
              <span className="font-medium leading-snug">{insight.text}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── RENOVATION PROGRESS CARDS ──────────────────────────────────────
const RenovationProgressSection: React.FC<{ projects: Project[]; onNavigate: DashboardProps['onNavigate'] }> = ({ projects, onNavigate }) => {
  const activeProjects = useMemo(() => {
    return projects
      .filter(p => p.status === ProjectStatus.IN_PROGRESS || p.status === ProjectStatus.VALIDATED)
      .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
      .slice(0, 4);
  }, [projects]);

  if (activeProjects.length === 0) return null;

  const getPhaseIcon = (status: ProjectStatus) => {
    switch(status) {
      case ProjectStatus.VALIDATED: return Clock;
      case ProjectStatus.IN_PROGRESS: return HardHat;
      default: return Briefcase;
    }
  };

  const getProgress = (project: Project): number => {
    if (project.phases && project.phases.length > 0) {
      const completed = project.phases.filter(p => p.status === 'COMPLETED').length;
      return Math.round((completed / project.phases.length) * 100);
    }
    // Estimate from status
    if (project.status === ProjectStatus.VALIDATED) return 10;
    if (project.status === ProjectStatus.IN_PROGRESS) return 50;
    return 0;
  };

  const formatBudget = (n?: number) => {
    if (!n) return '—';
    return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft p-6">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/30">
            <HardHat size={20} className="text-teal-600 dark:text-teal-400" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">Chantiers Actifs</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">{activeProjects.length} chantier{activeProjects.length > 1 ? 's' : ''} en cours</p>
          </div>
        </div>
        <button 
          onClick={() => onNavigate('projects', ProjectStatus.IN_PROGRESS)}
          className="text-xs font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 transition-colors"
        >
          Voir tout <ArrowUpRight size={14} />
        </button>
      </div>

      <div className="space-y-3">
        {activeProjects.map((project) => {
          const progress = getProgress(project);
          const PhaseIcon = getPhaseIcon(project.status);
          const isLate = project.endDate && new Date(project.endDate) < new Date();
          
          return (
            <div
              key={project.id}
              onClick={() => onNavigate('projects', project.status)}
              className="flex items-center gap-4 p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-teal-200 dark:hover:border-teal-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 cursor-pointer transition-all group"
            >
              <div className={`p-2 rounded-lg flex-shrink-0 ${
                isLate 
                  ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-500' 
                  : project.status === ProjectStatus.IN_PROGRESS 
                    ? 'bg-teal-50 dark:bg-teal-950/30 text-teal-600 dark:text-teal-400' 
                    : 'bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400'
              }`}>
                <PhaseIcon size={18} />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-slate-900 dark:text-white truncate">{project.title}</span>
                  {isLate && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded-md uppercase">Retard</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                  <span className="truncate">{project.client.name}</span>
                  {project.budget && <span className="font-medium text-slate-600 dark:text-slate-300">{formatBudget(project.budget)}</span>}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <div className="text-sm font-bold text-slate-900 dark:text-white">{progress}%</div>
                </div>
                <div className="w-16 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      isLate ? 'bg-rose-500' : progress >= 75 ? 'bg-emerald-500' : 'bg-teal-500'
                    }`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <ChevronRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-teal-500 transition-colors" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── FINANCIAL SUMMARY (MODERN) ─────────────────────────────────────
const FinancialSummary: React.FC<{ projects: Project[] }> = ({ projects }) => {
  const stats = useMemo(() => {
    let secured = 0, potential = 0, waiting = 0;
    projects.forEach((p) => {
      const amount = p.budget || 0;
      if ([ProjectStatus.VALIDATED, ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED].includes(p.status))
        secured += amount;
      else if ([ProjectStatus.QUOTE_SENT, ProjectStatus.NEW].includes(p.status))
        potential += amount;
      else if (p.status === ProjectStatus.WAITING_VALIDATION) waiting += amount;
    });
    return { secured, potential, waiting, total: secured + potential + waiting };
  }, [projects]);

  const format = (n: number) =>
    n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

  const segments = [
    { label: 'Sécurisé', value: stats.secured, color: 'bg-emerald-500', textColor: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-50 dark:bg-emerald-950/20' },
    { label: 'En attente', value: stats.waiting, color: 'bg-blue-500', textColor: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
    { label: 'Potentiel', value: stats.potential, color: 'bg-amber-500', textColor: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-50 dark:bg-amber-950/20' },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
          <Wallet size={20} className="text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">Trésorerie</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Volume d'affaires HT</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-lg font-bold text-slate-900 dark:text-white">{format(stats.total)}</div>
          <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Total</div>
        </div>
      </div>

      {stats.total > 0 && (
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex mb-5">
          {segments.map((seg, i) => {
            const width = (seg.value / stats.total) * 100;
            if (width === 0) return null;
            return (
              <div
                key={i}
                className={`${seg.color} h-full ${i === 0 ? 'rounded-l-full' : ''} ${i === segments.length - 1 ? 'rounded-r-full' : ''} transition-all`}
                style={{ width: `${width}%` }}
                title={`${seg.label}: ${format(seg.value)}`}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {segments.map((seg, i) => (
          <div key={i} className={`${seg.bgColor} rounded-xl p-3 text-center`}>
            <div className={`text-sm font-bold ${seg.textColor}`}>{format(seg.value)}</div>
            <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 uppercase tracking-wider">{seg.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── QUICK NOTES (TEAM WALL) ────────────────────────────────────────
const QuickNotes: React.FC<{
  notes?: SharedNote[];
  onAdd?: (text: string) => void;
  onDelete?: (id: string) => void;
  currentUser?: User;
}> = ({ notes = [], onAdd, onDelete, currentUser }) => {
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SR();
      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.lang = 'fr-FR';
        recognitionRef.current.interimResults = false;
        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setInputText(prev => (prev ? prev + ' ' : '') + transcript);
          setIsListening(false);
        };
        recognitionRef.current.onerror = () => setIsListening(false);
        recognitionRef.current.onend = () => setIsListening(false);
      }
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (isListening) recognitionRef.current.stop();
    else { setIsListening(true); recognitionRef.current.start(); }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && onAdd) { onAdd(inputText); setInputText(''); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft p-6 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2.5 rounded-xl bg-violet-50 dark:bg-violet-950/30">
          <StickyNote size={20} className="text-violet-600 dark:text-violet-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">Mur d'équipe</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">Notes partagées</p>
        </div>
        <span className="ml-auto text-[10px] font-bold bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-wider">
          <Users size={10} /> Partagé
        </span>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={isListening ? '🎤 Je vous écoute...' : 'Écrire une note...'}
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl pl-4 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-slate-900 dark:text-white transition-all placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={toggleListening}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
              isListening 
                ? 'bg-rose-500 text-white animate-pulse' 
                : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isListening ? <div className="w-2 h-2 rounded-full bg-white" /> : <Mic size={14} />}
          </button>
        </div>
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-teal-600 hover:bg-teal-700 text-white p-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
        >
          <Send size={16} />
        </button>
      </form>

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[120px] max-h-[280px]">
        {notes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm py-8">
            <StickyNote size={28} className="mb-2 text-slate-300 dark:text-slate-600" />
            <p className="font-medium">Aucune note épinglée</p>
            <p className="text-xs mt-1">Commencez à partager vos idées !</p>
          </div>
        ) : (
          notes.map(note => {
            const isAuthor = currentUser?.id === note.authorId;
            return (
              <div
                key={note.id}
                className="p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:border-slate-200 dark:hover:border-slate-700 transition-all group relative bg-slate-50/50 dark:bg-slate-800/30"
              >
                <div className="flex justify-between items-start mb-1.5">
                  <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wide">
                    {note.authorName}
                  </span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(note.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{note.content}</p>
                {isAuthor && onDelete && (
                  <button
                    onClick={() => onDelete(note.id)}
                    className="absolute top-2 right-2 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

// ─── QUICK ACTIONS BAR ──────────────────────────────────────────────
const QuickActions: React.FC<{ onNavigate: DashboardProps['onNavigate'] }> = ({ onNavigate }) => {
  const actions = [
    { label: 'Agenda', icon: CalendarDays, onClick: () => onNavigate('agenda'), color: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30' },
    { label: 'Tâches', icon: CheckSquare, onClick: () => onNavigate('tasks'), color: 'text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/30' },
    { label: 'Clients', icon: Users, onClick: () => onNavigate('clients'), color: 'text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/30' },
    { label: 'Dépenses', icon: DollarSign, onClick: () => onNavigate('expenses'), color: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' },
    { label: 'Partenaires', icon: Building2, onClick: () => onNavigate('partners'), color: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30' },
    { label: 'Prospection', icon: Target, onClick: () => onNavigate('prospection'), color: 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/30' },
  ];

  return (
    <div className="flex gap-2 flex-wrap">
      {actions.map(a => (
        <button
          key={a.label}
          onClick={a.onClick}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 hover:shadow-soft transition-all text-sm font-medium shadow-soft`}
        >
          <div className={`p-1.5 rounded-lg ${a.color}`}>
            <a.icon size={14} />
          </div>
          <span className="text-slate-700 dark:text-slate-300">{a.label}</span>
        </button>
      ))}
    </div>
  );
};

// ─── PIPELINE OVERVIEW ─────────────────────────────────────────────
const PipelineOverview: React.FC<{ projects: Project[]; onNavigate: DashboardProps['onNavigate'] }> = ({ projects, onNavigate }) => {
  const stages = useMemo(() => [
    { label: 'Nouveaux', status: ProjectStatus.NEW, icon: CircleDot, count: projects.filter(p => p.status === ProjectStatus.NEW).length, color: 'teal' },
    { label: 'Devis envoyés', status: ProjectStatus.QUOTE_SENT, icon: Send, count: projects.filter(p => p.status === ProjectStatus.QUOTE_SENT).length, color: 'amber' },
    { label: 'Validés', status: ProjectStatus.VALIDATED, icon: CheckCircle2, count: projects.filter(p => p.status === ProjectStatus.VALIDATED).length, color: 'blue' },
    { label: 'En cours', status: ProjectStatus.IN_PROGRESS, icon: HardHat, count: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length, color: 'emerald' },
    { label: 'Facturation', status: ProjectStatus.WAITING_VALIDATION, icon: DollarSign, count: projects.filter(p => p.status === ProjectStatus.WAITING_VALIDATION).length, color: 'violet' },
    { label: 'Terminés', status: ProjectStatus.COMPLETED, icon: ShieldCheck, count: projects.filter(p => p.status === ProjectStatus.COMPLETED).length, color: 'slate' },
  ], [projects]);

  const pipelineColors: Record<string, string> = {
    teal: 'bg-teal-500',
    amber: 'bg-amber-500',
    blue: 'bg-blue-500',
    emerald: 'bg-emerald-500',
    violet: 'bg-violet-500',
    slate: 'bg-slate-400',
  };

  const total = stages.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-950/30">
          <Activity size={20} className="text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white text-base">Pipeline Commercial</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">{total} dossiers au total</p>
        </div>
      </div>

      {/* Visual pipeline bar */}
      {total > 0 && (
        <div className="h-3 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex mb-5">
          {stages.map((stage, i) => {
            const width = (stage.count / total) * 100;
            if (width === 0) return null;
            return (
              <div
                key={i}
                className={`${pipelineColors[stage.color]} h-full transition-all`}
                style={{ width: `${width}%` }}
                title={`${stage.label}: ${stage.count}`}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {stages.map((stage, i) => {
          const StageIcon = stage.icon;
          return (
            <button
              key={i}
              onClick={() => onNavigate('projects', stage.status)}
              className="flex flex-col items-center p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group text-center"
            >
              <div className={`w-2 h-2 rounded-full ${pipelineColors[stage.color]} mb-2`} />
              <div className="text-xl font-bold text-slate-900 dark:text-white">{stage.count}</div>
              <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-tight">{stage.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════════
const Dashboard: React.FC<DashboardProps> = ({
  projects,
  onNavigate,
  notes = [],
  onAddNote,
  onDeleteNote,
  currentUser,
}) => {
  const stats = useMemo(() => ({
    total: projects.length,
    newProjects: projects.filter(p => p.status === ProjectStatus.NEW).length,
    inProgress: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length,
    completed: projects.filter(p => p.status === ProjectStatus.COMPLETED).length,
    late: projects.filter(p => {
      if (!p.endDate) return false;
      return new Date(p.endDate) < new Date() &&
        ![ProjectStatus.COMPLETED, ProjectStatus.REFUSED, ProjectStatus.LOST, ProjectStatus.CANCELLED].includes(p.status);
    }).length,
    quoteSent: projects.filter(p => p.status === ProjectStatus.QUOTE_SENT).length,
    validated: projects.filter(p => p.status === ProjectStatus.VALIDATED).length,
    callbacks: projects.filter(p => p.needsCallback).length,
    totalBudget: projects.reduce((sum, p) => sum + (p.budget || 0), 0),
  }), [projects]);

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  }, []);

  return (
    <div className="space-y-6 pb-8 animate-fade-in">
      {/* ─── HEADER ──────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {greeting}, {currentUser?.fullName?.split(' ')[0] || 'Admin'} 👋
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            {' • '}
            <span className="text-teal-600 dark:text-teal-400 font-medium">{stats.total} dossiers</span>
          </p>
        </div>
        <QuickActions onNavigate={onNavigate} />
      </div>

      {/* ─── CALLBACK ALERT ──────────────────────────────── */}
      {stats.callbacks > 0 && (
        <button
          onClick={() => onNavigate('projects')}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-md shadow-rose-500/20 hover:shadow-lg hover:shadow-rose-500/30 transition-all group"
        >
          <div className="flex items-center gap-3 font-semibold">
            <PhoneCall size={20} className="animate-bounce" />
            {stats.callbacks} rappel{stats.callbacks > 1 ? 's' : ''} client en attente
          </div>
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
      )}

      {/* ─── TOP METRIC CARDS ────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MemoizedMetricCard
          value={stats.newProjects}
          label="Nouveaux Dossiers"
          icon={Zap}
          color="teal"
          onClick={() => onNavigate('projects', ProjectStatus.NEW)}
        />
        <MemoizedMetricCard
          value={stats.inProgress}
          label="Chantiers en Cours"
          icon={HardHat}
          color="emerald"
          onClick={() => onNavigate('projects', ProjectStatus.IN_PROGRESS)}
        />
        <MemoizedMetricCard
          value={stats.completed}
          label="Terminés"
          icon={CheckCircle2}
          color="blue"
          onClick={() => onNavigate('projects', ProjectStatus.COMPLETED)}
        />
        <MemoizedMetricCard
          value={stats.late}
          label="En Retard"
          icon={AlertTriangle}
          color={stats.late > 0 ? 'rose' : 'slate'}
          onClick={() => onNavigate('projects', 'ALL')}
          subtitle={stats.late > 0 ? 'Action requise' : 'Aucun retard'}
        />
      </div>

      {/* ─── PIPELINE OVERVIEW ───────────────────────────── */}
      <PipelineOverview projects={projects} onNavigate={onNavigate} />

      {/* ─── MAIN CONTENT GRID ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          <RenovationProgressSection projects={projects} onNavigate={onNavigate} />
          <FinancialSummary projects={projects} />
          
          {/* Charts Section */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30">
                <BarChart3 size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white text-base">Analyses & Statistiques</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Performance et évolution de l'activité</p>
              </div>
            </div>
            <DashboardCharts projects={projects} />
          </div>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-6">
          <AIInsightsWidget projects={projects} />
          <QuickNotes
            notes={notes}
            onAdd={onAddNote}
            onDelete={onDeleteNote}
            currentUser={currentUser}
          />
        </div>
      </div>
    </div>
  );
};

export default React.memo(Dashboard);
