
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { Calendar, CheckSquare, XCircle, Clock, AlertCircle, ArrowRight, Briefcase, PlayCircle, CheckCircle2, Map, List, MapPin, PhoneCall, TrendingUp, DollarSign, BarChart3, Trophy, Archive, StickyNote, Send, Trash2, Mic, Users, LayoutDashboard } from 'lucide-react';
import { Project, ProjectStatus, User } from '../types';
import { SharedNote } from '../App';

interface DashboardProps {
    projects: Project[];
    onNavigate: (tab: string, statusFilter?: ProjectStatus | null) => void;
    notes?: SharedNote[];
    onAddNote?: (text: string) => void;
    onDeleteNote?: (id: string) => void;
    currentUser?: User;
    sharedMemo?: string;
    onUpdateMemo?: (text: string) => void;
}

// PREMIUM STAT CARD COMPONENT
interface StatCardProps {
    count: number;
    title: string;
    description?: string;
    variant: 'blue' | 'emerald' | 'rose' | 'amber' | 'violet' | 'sky' | 'slate';
    icon: React.ElementType;
    onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ count, title, description, variant, icon: Icon, onClick }) => {

    // Updated Theme mapping for MAX CONTRAST
    const themes: Record<string, { text: string; bg: string; border: string; glow: string }> = {
        blue: { text: 'text-blue-800 dark:text-blue-100', bg: 'bg-blue-100 dark:bg-blue-900/50', border: 'hover:border-blue-500/50', glow: 'group-hover:shadow-blue-500/20' },
        emerald: { text: 'text-emerald-800 dark:text-emerald-100', bg: 'bg-emerald-100 dark:bg-emerald-900/50', border: 'hover:border-emerald-500/50', glow: 'group-hover:shadow-emerald-500/20' },
        rose: { text: 'text-rose-800 dark:text-rose-100', bg: 'bg-rose-100 dark:bg-rose-900/50', border: 'hover:border-rose-500/50', glow: 'group-hover:shadow-rose-500/20' },
        amber: { text: 'text-amber-800 dark:text-amber-100', bg: 'bg-amber-100 dark:bg-amber-900/50', border: 'hover:border-amber-500/50', glow: 'group-hover:shadow-amber-500/20' },
        violet: { text: 'text-violet-800 dark:text-violet-100', bg: 'bg-violet-100 dark:bg-violet-900/50', border: 'hover:border-violet-500/50', glow: 'group-hover:shadow-violet-500/20' },
        sky: { text: 'text-sky-800 dark:text-sky-100', bg: 'bg-sky-100 dark:bg-sky-900/50', border: 'hover:border-sky-500/50', glow: 'group-hover:shadow-sky-500/20' },
        slate: { text: 'text-slate-800 dark:text-slate-100 dark:text-white', bg: 'bg-slate-200 dark:bg-slate-800', border: 'hover:border-slate-500/50', glow: 'group-hover:shadow-slate-500/20' },
    };

    const theme = themes[variant] || themes['slate'];

    return (
        <div
            onClick={onClick}
            className={`glass-card relative overflow-hidden rounded-2xl p-6 cursor-pointer group flex flex-col justify-between h-44 border border-t border-white/60 dark:border-white/10 ${theme.border} hover:shadow-2xl ${theme.glow}`}
        >
            {/* Background Glow */}
            <div className={`absolute -right-6 -top-6 w-32 h-32 rounded-full opacity-10 blur-3xl transition-opacity duration-500 group-hover:opacity-20 ${theme.bg.split(' ')[0].replace('100', '500')}`}></div>

            <div className="relative z-10 flex justify-between items-start">
                <div>
                    <div className={`text-5xl font-black tracking-tighter mb-1 ${theme.text} drop-shadow-sm`}>{count}</div>
                    <div className="font-extrabold text-slate-800 dark:text-slate-100 dark:text-white leading-tight text-lg">{title}</div>
                </div>
                <div className={`p-3.5 rounded-xl ${theme.bg} ${theme.text} shadow-sm ring-1 ring-black/5 dark:ring-white/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
                    <Icon size={28} />
                </div>
            </div>

            <div className="relative z-10 mt-auto pt-4">
                {description && <div className="text-xs font-medium text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white truncate">{description}</div>}
                <div className={`mt-2 flex items-center text-[10px] font-bold uppercase tracking-wider ${theme.text} dark:text-white/80 opacity-0 transform translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300`}>
                    Voir les dossiers <ArrowRight size={12} className="ml-1" />
                </div>
            </div>
        </div>
    );
}

const QuickMemo = ({ notes = [], onAdd, onDelete, currentUser }: { notes?: SharedNote[], onAdd?: (text: string) => void, onDelete?: (id: string) => void, currentUser?: User }) => {
    const [inputText, setInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const listRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<any>(null);

    interface SpeechRecognition extends EventTarget {
        continuous: boolean;
        lang: string;
        interimResults: boolean;
        start: () => void;
        stop: () => void;
        onresult: (event: any) => void;
        onerror: (event: any) => void;
        onend: (event: any) => void;
    }

    useEffect(() => {
        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition() as SpeechRecognition;
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
        if (!recognitionRef.current) return alert("Fonction non supportée.");
        if (isListening) recognitionRef.current.stop();
        else { setIsListening(true); recognitionRef.current.start(); }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim() && onAdd) { onAdd(inputText); setInputText(''); }
    };

    return (
        <div className="glass-card rounded-2xl p-6 h-full flex flex-col relative min-h-[400px]">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 dark:border-slate-800/50 pb-3">
                <div className="flex items-center text-amber-500 font-bold">
                    <StickyNote className="mr-2" size={20} />
                    <h3>Mur d'équipe</h3>
                </div>
                <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center">
                    <Users size={10} className="mr-1" /> Partagé
                </span>
            </div>

            <form onSubmit={handleSubmit} className="flex gap-2 mb-4">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={isListening ? "Je vous écoute..." : "Écrire une note..."}
                        className="w-full bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl pl-3 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-amber-400 outline-none text-slate-900 dark:text-white dark:text-white transition-all"
                    />
                    <button
                        type="button"
                        onClick={toggleListening}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-slate-900 dark:text-white dark:text-white animate-pulse' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-amber-500'}`}
                    >
                        {isListening ? <div className="w-2 h-2 rounded-full bg-white dark:bg-slate-900" /> : <Mic size={16} />}
                    </button>
                </div>
                <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="bg-amber-500 hover:bg-amber-600 text-slate-900 dark:text-white dark:text-white p-2.5 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-amber-500/20"
                >
                    <Send size={18} />
                </button>
            </form>

            <div ref={listRef} className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
                {notes.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-700 dark:text-slate-200 dark:text-white text-sm italic opacity-60">
                        <StickyNote size={32} className="mb-2" />
                        <p>Aucune note épinglée.</p>
                    </div>
                ) : (
                    notes.map((note) => {
                        const isAuthor = currentUser?.id === note.authorId;
                        return (
                            <div key={note.id} className="bg-slate-50/50 dark:bg-slate-900/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800 transition-all group relative backdrop-blur-sm">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-200 uppercase tracking-wide">{note.authorName}</span>
                                    <span className="text-[9px] text-slate-700 dark:text-slate-200 dark:text-white">
                                        {new Date(note.createdAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                                <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white leading-relaxed">{note.content}</p>
                                {isAuthor && onDelete && (
                                    <button
                                        onClick={() => onDelete(note.id)}
                                        className="absolute top-2 right-2 text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-50 dark:hover:bg-rose-900/30 p-1.5 rounded-lg"
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

const FinancialOverview = ({ projects }: { projects: Project[] }) => {
    const stats = useMemo(() => {
        let secured = 0, potential = 0, waiting = 0;
        projects.forEach(p => {
            const amount = p.budget || 0;
            if ([ProjectStatus.VALIDATED, ProjectStatus.IN_PROGRESS, ProjectStatus.COMPLETED].includes(p.status)) secured += amount;
            else if ([ProjectStatus.QUOTE_SENT, ProjectStatus.NEW].includes(p.status)) potential += amount;
            else if (p.status === ProjectStatus.WAITING_VALIDATION) waiting += amount;
        });
        return { secured, potential, waiting, total: secured + potential + waiting };
    }, [projects]);

    const format = (n: number) => n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

    return (
        <div className="glass-card rounded-2xl p-6 h-full flex flex-col justify-between">
            <div className="flex items-center mb-6">
                <div className="p-2.5 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl mr-4 shadow-lg shadow-emerald-500/20 text-white dark:text-white">
                    <TrendingUp size={24} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Aperçu Financier</h2>
                    <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white font-medium">Flux de trésorerie (HT)</p>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-200 tracking-wider">Sécurisé</div>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{format(stats.secured)}</div>
                    <div className="h-1.5 w-full bg-emerald-100 dark:bg-emerald-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-slate-700 dark:text-slate-200 dark:text-white tracking-wider">En Clôture</div>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 dark:text-white">{format(stats.waiting)}</div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-500 dark:bg-slate-400 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                </div>
                <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase text-amber-500 dark:text-amber-200 tracking-wider">Potentiel</div>
                    <div className="text-xl font-black text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{format(stats.potential)}</div>
                    <div className="h-1.5 w-full bg-amber-100 dark:bg-amber-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full" style={{ width: '100%' }}></div>
                    </div>
                </div>
            </div>

            {/* Total Gauge */}
            {stats.total > 0 && (
                <div className="relative pt-2 mt-auto">
                    <div className="flex justify-between text-xs font-bold mb-2">
                        <span className="text-slate-700 dark:text-slate-200 dark:text-white">Répartition du volume d'affaires</span>
                        <span className="text-indigo-600 dark:text-indigo-200">{format(stats.total)} Total</span>
                    </div>
                    <div className="h-4 w-full bg-slate-100 dark:bg-slate-900/50 rounded-lg overflow-hidden flex ring-1 ring-slate-200 dark:ring-slate-700">
                        <div style={{ width: `${(stats.secured / stats.total) * 100}%` }} className="bg-emerald-500 h-full border-r border-white/20" title="Sécurisé"></div>
                        <div style={{ width: `${(stats.waiting / stats.total) * 100}%` }} className="bg-slate-500 h-full border-r border-white/20" title="En Clôture"></div>
                        <div style={{ width: `${(stats.potential / stats.total) * 100}%` }} className="bg-amber-400 h-full" title="Potentiel"></div>
                    </div>
                </div>
            )}
        </div>
    );
}

const LeafletMap = ({ projects }: { projects: Project[] }) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<any>(null);

    useEffect(() => {
        if (!mapRef.current) return;
        const L = (window as any).L;
        if (!L) return;

        if (!mapInstance.current) {
            mapInstance.current = L.map(mapRef.current).setView([48.8566, 2.3522], 10);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(mapInstance.current);
        }

        const validProjects = projects.filter(p => p.lat && p.lng);
        if (validProjects.length > 0) {
            const group = L.featureGroup().addTo(mapInstance.current);
            mapInstance.current.eachLayer((layer: any) => { if (layer instanceof L.Marker) mapInstance.current.removeLayer(layer); });

            validProjects.forEach(p => {
                const marker = L.marker([p.lat, p.lng]).addTo(mapInstance.current);
                marker.bindPopup(`<div style="font-family: 'Outfit', sans-serif; color: #1e293b;"><strong>${p.title}</strong><br/>${p.client.name}<br/>${p.status}</div>`);
            });

            try {
                if (validProjects.length > 1) {
                    const bounds = L.latLngBounds(validProjects.map(p => [p.lat!, p.lng!]));
                    mapInstance.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
                } else {
                    mapInstance.current.setView([validProjects[0].lat!, validProjects[0].lng!], 13);
                }
            } catch (e) { }
        }
    }, [projects]);

    return <div ref={mapRef} className="w-full h-[400px] rounded-xl z-0" />;
};

// GLOBAL STATS SECTION
const GlobalStats = ({ projects }: { projects: Project[] }) => {
    const stats = useMemo(() => {
        const total = projects.length;
        const won = projects.filter(p => [ProjectStatus.VALIDATED, ProjectStatus.IN_PROGRESS, ProjectStatus.WAITING_VALIDATION, ProjectStatus.COMPLETED].includes(p.status)).length;
        const lost = projects.filter(p => [ProjectStatus.LOST, ProjectStatus.REFUSED, ProjectStatus.CANCELLED].includes(p.status)).length;
        return { total, won, lost };
    }, [projects]);

    return (
        <div className="mt-12 mb-8 animate-fade-in-up">
            <div className="flex items-center mb-6 px-1">
                <BarChart3 className="text-indigo-500 mr-3" size={24} />
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Statistiques Globales</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card rounded-2xl p-6 flex items-center justify-between border-b-4 border-indigo-500">
                    <div>
                        <div className="text-indigo-600 dark:text-white text-xs font-black uppercase tracking-wider mb-2">Total Dossiers</div>
                        <div className="text-5xl font-black text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{stats.total}</div>
                    </div>
                    <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-2xl text-indigo-500"> <List size={32} /> </div>
                </div>

                <div className="glass-card rounded-2xl p-6 flex items-center justify-between border-b-4 border-emerald-500">
                    <div>
                        <div className="text-emerald-600 dark:text-white text-xs font-black uppercase tracking-wider mb-2">Taux de Succès</div>
                        <div className="text-5xl font-black text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{stats.total > 0 ? Math.round((stats.won / stats.total) * 100) : 0}%</div>
                    </div>
                    <div className="bg-emerald-50 dark:bg-emerald-900/30 p-4 rounded-2xl text-emerald-500"> <Trophy size={32} /> </div>
                </div>

                <div className="glass-card rounded-2xl p-6 flex items-center justify-between border-b-4 border-rose-500">
                    <div>
                        <div className="text-rose-600 dark:text-white text-xs font-black uppercase tracking-wider mb-2">Perdus</div>
                        <div className="text-5xl font-black text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{stats.lost}</div>
                    </div>
                    <div className="bg-rose-50 dark:bg-rose-900/30 p-4 rounded-2xl text-rose-500"> <Archive size={32} /> </div>
                </div>
            </div>
        </div>
    );
};

// MAIN DASHBOARD COMPONENT
const Dashboard: React.FC<DashboardProps> = ({ projects, onNavigate, notes = [], onAddNote, onDeleteNote, currentUser }) => {
    const [viewMode, setViewMode] = useState<'LIST' | 'MAP'>('LIST');

    const stats = useMemo(() => {
        return {
            available: projects.filter(p => p.status === ProjectStatus.NEW).length,
            applied: projects.filter(p => p.status === ProjectStatus.QUOTE_SENT).length,
            upcoming: projects.filter(p => p.status === ProjectStatus.VALIDATED).length,
            inProgress: projects.filter(p => p.status === ProjectStatus.IN_PROGRESS).length,
            finished: projects.filter(p => p.status === ProjectStatus.COMPLETED).length,
            declined: projects.filter(p => p.status === ProjectStatus.LOST).length,
            validating: projects.filter(p => p.status === ProjectStatus.WAITING_VALIDATION).length,
            refused: projects.filter(p => p.status === ProjectStatus.REFUSED).length,
            late: projects.filter(p => {
                if (!p.endDate) return false;
                return new Date(p.endDate) < new Date() && p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.REFUSED && p.status !== ProjectStatus.LOST;
            }).length,
            callbacks: projects.filter(p => p.needsCallback).length
        };
    }, [projects]);

    return (
        <div className="space-y-12 pb-12 animate-fade-in-up">

            {/* 1. Header & Agenda */}
            <section>
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div className="flex items-center">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl mr-4 shadow-lg shadow-indigo-500/30 text-white dark:text-white">
                            <LayoutDashboard size={28} />
                        </div>
                        <div>
                            <h2 className="text-3xl font-extrabold text-slate-800 dark:text-slate-100 dark:text-white tracking-tight">Tableau de Bord</h2>
                            <p className="text-slate-700 dark:text-slate-200 dark:text-white font-medium">{currentUser?.fullName || 'Utilisateur'} • {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                        </div>
                    </div>
                    <div className="flex bg-white dark:bg-slate-900/50 dark:bg-slate-900/50 backdrop-blur-md p-1.5 rounded-xl border border-white/20 shadow-sm">
                        <button onClick={() => onNavigate('tasks')} className="px-4 py-2 rounded-lg text-slate-700 dark:text-slate-200 dark:text-white font-bold hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-700 hover:shadow-sm transition-all flex items-center"><CheckSquare size={18} className="mr-2" /> Tâches</button>
                        <div className="w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>
                        <button onClick={() => setViewMode('LIST')} className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-900 dark:bg-slate-800 shadow text-indigo-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-indigo-500'}`}><List size={20} /></button>
                        <button onClick={() => setViewMode('MAP')} className={`p-2 rounded-lg transition-all ${viewMode === 'MAP' ? 'bg-white dark:bg-slate-900 dark:bg-slate-800 shadow text-indigo-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-indigo-500'}`}><Map size={20} /></button>
                    </div>
                </div>

                {stats.callbacks > 0 && (
                    <div onClick={() => onNavigate('projects')} className="mb-8 cursor-pointer group">
                        <div className="bg-gradient-to-r from-red-500 to-rose-600 text-white dark:text-white p-4 rounded-xl shadow-lg shadow-red-500/30 flex items-center justify-between animate-pulse hover:animate-none transition-transform hover:scale-[1.01]">
                            <div className="flex items-center font-bold text-lg">
                                <PhoneCall className="mr-3 animate-bounce" />
                                {stats.callbacks} Rappel(s) Client(s) en attente !
                            </div>
                            <ArrowRight className="opacity-80 group-hover:translate-x-2 transition-transform" />
                        </div>
                    </div>
                )}

                {viewMode === 'LIST' ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="md:col-span-2">
                            <div
                                onClick={() => onNavigate('agenda')}
                                className="glass-card rounded-3xl p-8 relative overflow-hidden group cursor-pointer h-64 flex flex-col justify-center items-center border border-indigo-200 dark:border-indigo-900 hover:border-indigo-400 transition-all"
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                                <div className="absolute -right-20 -top-20 bg-indigo-500/10 w-64 h-64 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>

                                <div className="bg-white dark:bg-slate-900 p-6 rounded-full shadow-xl shadow-indigo-100 dark:shadow-none mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Calendar size={48} className="text-indigo-600 dark:text-indigo-200" />
                                </div>
                                <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-white transition-colors">Mon Planning</h3>
                                <p className="text-slate-700 dark:text-slate-200 dark:text-white font-medium flex items-center group-hover:text-indigo-500 dark:group-hover:text-indigo-200">
                                    Accéder à l'agenda complet <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                                </p>
                            </div>
                        </div>
                        <div className="md:col-span-1">
                            <div className="glass-card rounded-3xl p-8 h-64 flex flex-col justify-center items-center text-center">
                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase tracking-widest mb-4">Prochain RDV</div>
                                <div className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-2">Aucun RDV imminent</div>
                                <p className="text-slate-700 dark:text-slate-200 dark:text-white text-sm">Profitez-en pour traiter vos dossiers !</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass-card rounded-3xl p-4 border border-indigo-100 dark:border-slate-800">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <h3 className="font-bold text-lg flex items-center text-indigo-900 dark:text-white dark:text-white"><MapPin className="mr-2 text-indigo-500" /> Carte des Chantiers</h3>
                            <span className="text-xs font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1 rounded-full">Vue Satellite</span>
                        </div>
                        <div className="rounded-2xl overflow-hidden shadow-inner border border-slate-200 dark:border-slate-800">
                            <LeafletMap projects={projects} />
                        </div>
                    </div>
                )}
            </section>

            {/* 2. Financial & Memo */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 h-full">
                    <FinancialOverview projects={projects} />
                </div>
                <div className="h-full">
                    <QuickMemo notes={notes} onAdd={onAddNote} onDelete={onDeleteNote} currentUser={currentUser} />
                </div>
            </div>

            {/* 3. Workflow Steps */}

            {/* NEW / INCOMING */}
            <section>
                <div className="flex items-center mb-6 px-1">
                    <div className="w-1.5 h-8 bg-sky-500 rounded-full mr-3"></div>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase tracking-tight">1. Flux Entrant</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard count={stats.available} title="A Traiter" variant="sky" icon={CheckSquare} onClick={() => onNavigate('projects', ProjectStatus.NEW)} />
                    <StatCard count={stats.applied} title="Devis Envoyés" variant="amber" icon={Send} onClick={() => onNavigate('projects', ProjectStatus.QUOTE_SENT)} />
                    <StatCard count={stats.declined} title="Perdus / Sans suite" variant="rose" icon={XCircle} onClick={() => onNavigate('projects', ProjectStatus.LOST)} />
                </div>
            </section>

            {/* ACTIVE / PRODUCTION */}
            <section>
                <div className="flex items-center mb-6 px-1">
                    <div className="w-1.5 h-8 bg-emerald-500 rounded-full mr-3"></div>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase tracking-tight">2. Production</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard count={stats.upcoming} title="Validés (À Venir)" variant="violet" icon={Clock} onClick={() => onNavigate('projects', ProjectStatus.VALIDATED)} />
                    <StatCard count={stats.inProgress} title="En Cours (Actifs)" variant="emerald" icon={Briefcase} onClick={() => onNavigate('projects', ProjectStatus.IN_PROGRESS)} />
                    <StatCard count={stats.late} title="En Retard" variant="rose" icon={AlertCircle} onClick={() => onNavigate('projects', 'ALL')} />
                </div>
            </section>

            {/* CLOSING */}
            <section>
                <div className="flex items-center mb-6 px-1">
                    <div className="w-1.5 h-8 bg-slate-500 rounded-full mr-3"></div>
                    <h2 className="text-xl font-extrabold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase tracking-tight">3. Clôture</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <StatCard count={stats.validating} title="Facturation" variant="amber" icon={DollarSign} onClick={() => onNavigate('projects', ProjectStatus.WAITING_VALIDATION)} />
                    <StatCard count={stats.finished} title="Clôturés" variant="slate" icon={CheckCircle2} onClick={() => onNavigate('projects', ProjectStatus.COMPLETED)} />
                    <StatCard count={stats.refused} title="Refusés / Litiges" variant="rose" icon={XCircle} onClick={() => onNavigate('projects', ProjectStatus.REFUSED)} />
                </div>
            </section>

            {/* Global Stats Footer */}
            <GlobalStats projects={projects} />

        </div>
    );
};

export default React.memo(Dashboard);
