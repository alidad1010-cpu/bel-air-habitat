
import React, { useState, useMemo } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, Search, MoreVertical, Phone, Mail, MapPin, DollarSign, Calendar, Mic, Sparkles, FileText, Upload, X, Trash2, Flame, Thermometer, Snowflake, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { Prospect, ProspectStatus, ProspectNote } from '../types';
import { analyzeProspectNote, parseProspectList } from '../services/geminiService';

interface ProspectionPageProps {
    prospects: Prospect[];
    onAddProspect: (p: Prospect) => void;
    onUpdateProspect: (p: Prospect) => void;
    onDeleteProspect: (id: string) => void;
    onConvertToClient: (p: Prospect) => void;
}

const COLUMNS = [
    { id: ProspectStatus.NEW, title: 'Nouveaux Leads', color: 'border-sky-500', bgHeader: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300' },
    { id: ProspectStatus.CONTACTED, title: 'Prise de Contact', color: 'border-blue-500', bgHeader: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
    { id: ProspectStatus.OFFER_SENT, title: 'Offre Envoyée', color: 'border-amber-500', bgHeader: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
    { id: ProspectStatus.NEGOTIATION, title: 'Négociation', color: 'border-purple-500', bgHeader: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
    { id: ProspectStatus.WON, title: 'Gagné / Signé', color: 'border-emerald-500', bgHeader: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
    { id: ProspectStatus.LOST, title: 'Perdu', color: 'border-red-500', bgHeader: 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' },
];

// Lead scoring function - computes score based on estimate, recency, notes, status
function computeLeadScore(prospect: Prospect): { score: number; label: 'HOT' | 'WARM' | 'COLD'; color: string; icon: typeof Flame; reason: string } {
    let score = 0;
    const reasons: string[] = [];
    
    // 1. Estimated amount (max 30 pts)
    if (prospect.estimatedAmount) {
        if (prospect.estimatedAmount >= 20000) { score += 30; reasons.push('Budget élevé'); }
        else if (prospect.estimatedAmount >= 10000) { score += 20; reasons.push('Budget moyen'); }
        else if (prospect.estimatedAmount >= 5000) { score += 10; reasons.push('Petit budget'); }
        else { score += 5; }
    }
    
    // 2. Interaction recency (max 25 pts)
    const daysSinceInteraction = prospect.lastInteraction
        ? Math.floor((Date.now() - prospect.lastInteraction) / (1000 * 60 * 60 * 24))
        : 999;
    if (daysSinceInteraction <= 3) { score += 25; reasons.push('Contact récent'); }
    else if (daysSinceInteraction <= 7) { score += 20; reasons.push('Contact < 7j'); }
    else if (daysSinceInteraction <= 14) { score += 10; }
    else if (daysSinceInteraction <= 30) { score += 5; }
    else { reasons.push('Pas de contact récent'); }
    
    // 3. Status progression (max 25 pts)
    if (prospect.status === ProspectStatus.NEGOTIATION) { score += 25; reasons.push('En négociation'); }
    else if (prospect.status === ProspectStatus.OFFER_SENT) { score += 20; reasons.push('Offre envoyée'); }
    else if (prospect.status === ProspectStatus.CONTACTED) { score += 15; }
    else if (prospect.status === ProspectStatus.NEW) { score += 5; }
    
    // 4. Notes frequency / engagement (max 20 pts)
    const noteCount = prospect.notes?.length || 0;
    if (noteCount >= 5) { score += 20; reasons.push(`${noteCount} notes`); }
    else if (noteCount >= 3) { score += 15; }
    else if (noteCount >= 1) { score += 10; }
    
    // 5. Has next action scheduled (+bonus)
    if (prospect.nextActionDate) {
        const nextDate = new Date(prospect.nextActionDate);
        if (nextDate >= new Date()) { score += 5; reasons.push('Relance planifiée'); }
    }
    
    // Classify
    if (score >= 60) return { score, label: 'HOT', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800', icon: Flame, reason: reasons.slice(0, 2).join(', ') };
    if (score >= 35) return { score, label: 'WARM', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800', icon: Thermometer, reason: reasons.slice(0, 2).join(', ') };
    return { score, label: 'COLD', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800', icon: Snowflake, reason: reasons.slice(0, 2).join(', ') };
}

// Generate follow-up suggestion
function getFollowUpSuggestion(prospect: Prospect): string | null {
    const now = Date.now();
    const daysSinceInteraction = prospect.lastInteraction
        ? Math.floor((now - prospect.lastInteraction) / (1000 * 60 * 60 * 24))
        : null;
    
    if (prospect.status === ProspectStatus.WON || prospect.status === ProspectStatus.LOST) return null;
    
    if (!prospect.lastInteraction) return '📞 Premier contact à établir';
    if (daysSinceInteraction && daysSinceInteraction > 14) return `⚠️ Relancer – Aucun contact depuis ${daysSinceInteraction}j`;
    if (prospect.status === ProspectStatus.NEW && daysSinceInteraction && daysSinceInteraction > 3) return '📞 Appeler pour prise de contact';
    if (prospect.status === ProspectStatus.CONTACTED && !prospect.estimatedAmount) return '💰 Qualifier le budget estimé';
    if (prospect.status === ProspectStatus.OFFER_SENT && daysSinceInteraction && daysSinceInteraction > 5) return '📧 Relancer sur le devis envoyé';
    if (prospect.status === ProspectStatus.NEGOTIATION) return '🤝 Préparer un argumentaire de clôture';
    if (prospect.nextActionDate && new Date(prospect.nextActionDate) < new Date()) return '🔴 Relance en retard !';
    return null;
}

const ProspectionPage: React.FC<ProspectionPageProps> = ({ prospects, onAddProspect, onUpdateProspect, onDeleteProspect, onConvertToClient }) => {
    const [searchQuery, setSearchQuery] = useState('');
    // OPTIMIZATION: Debounce search query
    const debouncedSearchQuery = useDebounce(searchQuery, 300);
    const [selectedProspect, setSelectedProspect] = useState<Prospect | null>(null);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [showLeadScoring, setShowLeadScoring] = useState(false);

    // Compute lead scores for all active prospects
    const leadScores = useMemo(() => {
        return prospects
            .filter(p => p.status !== ProspectStatus.WON && p.status !== ProspectStatus.LOST)
            .map(p => ({ prospect: p, ...computeLeadScore(p), followUp: getFollowUpSuggestion(p) }))
            .sort((a, b) => b.score - a.score);
    }, [prospects]);

    const hotCount = leadScores.filter(l => l.label === 'HOT').length;
    const warmCount = leadScores.filter(l => l.label === 'WARM').length;
    const coldCount = leadScores.filter(l => l.label === 'COLD').length;

    // DND Handler
    const onDragEnd = (result: DropResult) => {
        const { destination, source, draggableId } = result;

        if (!destination) return;
        if (destination.droppableId === source.droppableId && destination.index === source.index) return;

        const prospect = prospects.find(p => p.id === draggableId);
        if (prospect) {
            const newStatus = destination.droppableId as ProspectStatus;
            // Optimistic update via parent
            onUpdateProspect({ ...prospect, status: newStatus, lastInteraction: Date.now() });
        }
    };

    const handleAddLead = () => {
        const newLead: Prospect = {
            id: Date.now().toString(),
            status: ProspectStatus.NEW,
            contactName: 'Nouveau Prospect',
            createdAt: Date.now(),
        };
        onAddProspect(newLead);
        setSelectedProspect(newLead);
    };

    // OPTIMIZATION: Memoize filtered prospects with debounced search
    const filteredProspects = useMemo(() => {
        const lowerQuery = debouncedSearchQuery.toLowerCase();
        return prospects.filter(p =>
            p.contactName.toLowerCase().includes(lowerQuery) ||
            p.companyName?.toLowerCase().includes(lowerQuery)
        );
    }, [prospects, debouncedSearchQuery]);

    return (
        <div className="h-[calc(100vh-80px)] flex flex-col p-4 md:p-6 space-y-6 animate-fade-in">
            {/* Header / Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex items-center space-x-4 w-full md:w-auto">
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Pipeline Commercial</h2>
                    <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-3 py-1 rounded-full text-sm font-bold border border-slate-200 dark:border-slate-700">
                        {prospects.length} Dossiers
                    </span>
                </div>

                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher un prospect..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-900 dark:text-white transition-all shadow-sm"
                        />
                    </div>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors font-medium text-sm border border-slate-200 dark:border-slate-700"
                    >
                        <Upload size={18} className="mr-2" />
                        Import
                    </button>
                    <button
                        onClick={handleAddLead}
                        className="flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm shadow-lg shadow-emerald-500/20 active:scale-95 transform"
                    >
                        <Plus size={18} className="mr-2" />
                        Nouveau Lead
                    </button>
                </div>
            </div>

            {/* Lead Scoring Summary Bar */}
            <div className="flex flex-wrap items-center gap-3">
                <button
                    onClick={() => setShowLeadScoring(!showLeadScoring)}
                    className="flex items-center space-x-2 bg-white dark:bg-slate-900 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all text-sm font-bold"
                >
                    <Sparkles size={16} className="text-amber-500" />
                    <span className="text-slate-700 dark:text-slate-300">Lead Scoring IA</span>
                </button>
                <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                        <Flame size={12} className="mr-1" /> {hotCount} HOT
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        <Thermometer size={12} className="mr-1" /> {warmCount} WARM
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                        <Snowflake size={12} className="mr-1" /> {coldCount} COLD
                    </span>
                </div>
            </div>

            {/* Lead Scoring Panel (togglable) */}
            {showLeadScoring && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-amber-50 to-red-50 dark:from-amber-900/10 dark:to-red-900/10">
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm flex items-center">
                            <Sparkles size={16} className="mr-2 text-amber-500" /> Scoring IA & Suggestions de Relance
                        </h3>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[300px] overflow-y-auto">
                        {leadScores.map(({ prospect, score, label, color, icon: Icon, reason, followUp }) => (
                            <div key={prospect.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors" onClick={() => setSelectedProspect(prospect)}>
                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${color}`}>
                                        <Icon size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{prospect.contactName}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{reason}</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4 flex-shrink-0 ml-4">
                                    {followUp && (
                                        <span className="hidden lg:inline-flex items-center text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg max-w-[250px] truncate">
                                            {followUp}
                                        </span>
                                    )}
                                    <div className={`px-3 py-1 rounded-lg text-xs font-black border ${color}`}>
                                        {score}/100 {label}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Kanban Board */}
            <DragDropContext onDragEnd={onDragEnd}>
                <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
                    <div className="flex h-full space-x-4 min-w-[1500px] px-2">
                        {COLUMNS.map(col => (
                            <div key={col.id} className="flex flex-col w-80 shrink-0 h-full">
                                {/* Column Header */}
                                <div className={`flex items-center justify-between p-3 rounded-t-xl border-t border-x border-slate-200 dark:border-slate-800 ${col.bgHeader} shadow-sm z-10 relative`}>
                                    <h3 className="font-bold text-sm tracking-wide">{col.title}</h3>
                                    <span className="bg-white/50 dark:bg-black/20 px-2 py-0.5 rounded text-xs font-bold">
                                        {filteredProspects.filter(p => p.status === col.id).length}
                                    </span>
                                </div>

                                {/* Column Body */}
                                <Droppable droppableId={col.id}>
                                    {(provided, snapshot) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className={`flex-1 bg-slate-100/50 dark:bg-slate-950/30 border-x border-b border-slate-200 dark:border-slate-800 rounded-b-xl p-3 space-y-3 overflow-y-auto custom-scrollbar transition-all ${snapshot.isDraggingOver ? 'bg-emerald-50/50 dark:bg-emerald-900/10 ring-2 ring-emerald-500/20' : ''}`}
                                        >
                                            {filteredProspects
                                                .filter(p => p.status === col.id)
                                                .map((prospect, index) => (
                                                    <Draggable key={prospect.id} draggableId={prospect.id} index={index}>
                                                        {(provided, snapshot) => (
                                                            <div
                                                                ref={provided.innerRef}
                                                                {...provided.draggableProps}
                                                                {...provided.dragHandleProps}
                                                                onClick={() => setSelectedProspect(prospect)}
                                                                className={`bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-lg hover:shadow-emerald-500/10 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 transition-all cursor-pointer group relative ${snapshot.isDragging ? 'shadow-2xl rotate-2 scale-105 z-50 ring-2 ring-emerald-500' : ''}`}
                                                                style={provided.draggableProps.style}
                                                            >
                                                                {prospect.companyName && (
                                                                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center">
                                                                        <FileText size={10} className="mr-1" />
                                                                        {prospect.companyName}
                                                                    </div>
                                                                )}
                                                                <h4 className="font-bold text-slate-800 dark:text-white mb-2 line-clamp-2">{prospect.contactName}</h4>

                                                                <div className="space-y-1.5 mb-3">
                                                                    {prospect.estimatedAmount ? (
                                                                        <div className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 px-2 py-1 rounded w-fit">
                                                                            <DollarSign size={12} className="mr-1" />
                                                                            {prospect.estimatedAmount.toLocaleString()} €
                                                                        </div>
                                                                    ) : null}
                                                                    {prospect.nextActionDate && (
                                                                        <div className="flex items-center text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 px-2 py-1 rounded w-fit">
                                                                            <Calendar size={12} className="mr-1" />
                                                                            {new Date(prospect.nextActionDate).toLocaleDateString()}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Follow-up suggestion */}
                                                                {(() => {
                                                                    const fu = getFollowUpSuggestion(prospect);
                                                                    return fu ? (
                                                                        <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg px-2 py-1 mb-2 truncate">
                                                                            {fu}
                                                                        </div>
                                                                    ) : null;
                                                                })()}

                                                                <div className="flex items-center justify-between pt-2 border-t border-slate-50 dark:border-slate-800/50">
                                                                    <div className="flex items-center space-x-2">
                                                                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300 shadow-inner">
                                                                            {prospect.contactName.charAt(0)}
                                                                        </div>
                                                                        {/* Lead score badge */}
                                                                        {(() => {
                                                                            const ls = computeLeadScore(prospect);
                                                                            const LsIcon = ls.icon;
                                                                            return (
                                                                                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black border ${ls.color}`}>
                                                                                    <LsIcon size={9} className="mr-0.5" />{ls.label}
                                                                                </span>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                                        {new Date(prospect.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </Draggable>
                                                ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </div>
                </div>
            </DragDropContext>

            {/* MODALS */}
            {selectedProspect && (
                <ProspectDetailModal
                    prospect={selectedProspect}
                    onClose={() => setSelectedProspect(null)}
                    onUpdate={(u) => { onUpdateProspect(u); setSelectedProspect(u); }}
                    onDelete={() => { onDeleteProspect(selectedProspect.id); setSelectedProspect(null); }}
                    onConvertToClient={onConvertToClient}
                />
            )}

            {isImportModalOpen && (
                <ImportProspectModal
                    onClose={() => setIsImportModalOpen(false)}
                    onImport={(newProspects) => {
                        newProspects.forEach(p => onAddProspect(p));
                        setIsImportModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

// --- SUB-COMPONENTS ---

interface ProspectDetailModalProps {
    prospect: Prospect;
    onClose: () => void;
    onUpdate: (p: Prospect) => void;
    onDelete: () => void;
    onConvertToClient: (p: Prospect) => void;
}

const ProspectDetailModal: React.FC<ProspectDetailModalProps> = ({ prospect, onClose, onUpdate, onDelete, onConvertToClient }) => {
    const [noteInput, setNoteInput] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleAIAnalysis = async () => {
        if (!noteInput.trim()) return;
        setIsAnalyzing(true);
        try {
            const result = await analyzeProspectNote(noteInput);
            const now = Date.now();

            const newNote: ProspectNote = {
                id: now.toString(),
                content: noteInput,
                date: now,
                author: 'Vous'
            };

            const updates: Partial<Prospect> = {
                notes: [newNote, ...(prospect.notes || [])]
            };

            if (result.nextActionDate) updates.nextActionDate = result.nextActionDate;
            if (result.estimatedAmount) updates.estimatedAmount = result.estimatedAmount;

            // Also update last interaction
            updates.lastInteraction = now;

            onUpdate({ ...prospect, ...updates });
            setNoteInput(''); // Clear input after success
        } catch (e) {
            console.error(e);
        } finally {
            setIsAnalyzing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-sm animate-in fade-in">
            <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex justify-between items-start mb-6 border-b border-slate-100 dark:border-slate-800 pb-4">
                    <div className="flex-1 mr-4">
                        <div className="flex items-center space-x-2 mb-2">
                            <div className={`w-3 h-3 rounded-full ${prospect.status === ProspectStatus.WON ? 'bg-emerald-500' :
                                prospect.status === ProspectStatus.LOST ? 'bg-red-500' :
                                    prospect.status === ProspectStatus.NEW ? 'bg-sky-500' : 'bg-slate-500'
                                }`} />
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 uppercase tracking-wider">
                                {COLUMNS.find(c => c.id === prospect.status)?.title || prospect.status}
                            </span>
                        </div>
                        <input
                            type="text"
                            className="text-2xl font-bold text-slate-800 dark:text-white bg-transparent outline-none w-full placeholder-slate-400"
                            placeholder="Nom du Contact"
                            value={prospect.contactName}
                            onChange={e => onUpdate({ ...prospect, contactName: e.target.value })}
                        />
                        <input
                            type="text"
                            className="bg-transparent text-sm font-medium text-slate-500 focus:text-slate-800 dark:focus:text-white outline-none w-full mt-1"
                            placeholder="Nom de l'entreprise..."
                            value={prospect.companyName || ''}
                            onChange={e => onUpdate({ ...prospect, companyName: e.target.value })}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        {prospect.status === ProspectStatus.WON && (
                            <button
                                onClick={() => { if (confirm('Confirmer la conversion en client ?')) onConvertToClient(prospect); }}
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                            >
                                <Sparkles size={14} /> Convertir en Client
                            </button>
                        )}
                        <button onClick={() => { if (confirm('Supprimer définitivement ?')) onDelete(); }} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Supprimer">
                            <Trash2 size={20} />
                        </button>
                        <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {/* Info Card */}
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-4 shadow-sm">
                        <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center uppercase tracking-wide">
                            <FileText size={16} className="mr-2 text-emerald-500" /> Coordonnées
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="group flex items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                                <Phone size={16} className="text-slate-400 mr-3 group-focus-within:text-emerald-500" />
                                <input
                                    type="tel"
                                    className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-white placeholder-slate-400"
                                    placeholder="Téléphone"
                                    value={prospect.phone || ''}
                                    onChange={e => onUpdate({ ...prospect, phone: e.target.value })}
                                />
                                {prospect.phone && (
                                    <a href={`tel:${prospect.phone}`} className="text-slate-400 hover:text-emerald-500 p-1">
                                        <Phone size={14} className="fill-current" />
                                    </a>
                                )}
                            </div>
                            <div className="group flex items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                                <Mail size={16} className="text-slate-400 mr-3 group-focus-within:text-emerald-500" />
                                <input
                                    type="email"
                                    className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-white placeholder-slate-400"
                                    placeholder="Email"
                                    value={prospect.email || ''}
                                    onChange={e => onUpdate({ ...prospect, email: e.target.value })}
                                />
                            </div>
                            <div className="group flex items-center bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all md:col-span-2">
                                <MapPin size={16} className="text-slate-400 mr-3 group-focus-within:text-emerald-500" />
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent text-sm outline-none text-slate-800 dark:text-white placeholder-slate-400"
                                    placeholder="Ville / Adresse"
                                    value={prospect.city || ''}
                                    onChange={e => onUpdate({ ...prospect, city: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Potential Card */}
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 p-5 rounded-2xl border border-emerald-100 dark:border-emerald-900/30 space-y-4">
                        <h3 className="font-bold text-sm text-emerald-800 dark:text-emerald-400 flex items-center uppercase tracking-wide">
                            <Sparkles size={16} className="mr-2" /> Potentiel & Actions
                        </h3>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-500 mb-1.5 block uppercase">Montant Estimé (€)</label>
                                <div className="relative group">
                                    <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-500" />
                                    <input
                                        type="number"
                                        className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-100 font-bold focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm group-hover:border-emerald-400"
                                        value={prospect.estimatedAmount || ''}
                                        onChange={e => onUpdate({ ...prospect, estimatedAmount: parseFloat(e.target.value) })}
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-bold text-emerald-700 dark:text-emerald-500 mb-1.5 block uppercase">Prochaine Action</label>
                                <div className="relative group">
                                    <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600 dark:text-emerald-500" />
                                    <input
                                        type="date"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-900 dark:text-emerald-100 focus:ring-2 focus:ring-emerald-500 outline-none transition-all shadow-sm group-hover:border-emerald-400"
                                        value={prospect.nextActionDate || ''}
                                        onChange={e => onUpdate({ ...prospect, nextActionDate: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI & History Section */}
                    <div className="flex flex-col space-y-4">
                        <div className="flex justify-between items-center">
                            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 flex items-center uppercase tracking-wide">
                                <MoreVertical size={16} className="mr-2 text-purple-500" /> Historique & Notes
                            </h3>
                        </div>

                        {/* AI Input Area */}
                        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-slate-800 dark:to-slate-800/50 p-1 rounded-2xl border border-indigo-100 dark:border-slate-700 shadow-sm focus-within:ring-2 focus-within:ring-purple-500/20 transition-all">
                            <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                                <textarea
                                    className="w-full bg-transparent p-4 text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none resize-none min-h-[80px]"
                                    placeholder="Notez votre échange ici (ex: 'J'ai eu Marc, budget 10k, rappeler mardi')..."
                                    value={noteInput}
                                    onChange={e => setNoteInput(e.target.value)}
                                />
                                <div className="flex justify-between items-center px-2 pb-2 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 pt-2">
                                    <div className="flex space-x-2">
                                        <button className="p-2 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20" title="Dicter (Bientôt)">
                                            <Mic size={18} />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleAIAnalysis}
                                        disabled={!noteInput.trim() || isAnalyzing}
                                        className="flex items-center space-x-2 bg-slate-900 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-xs font-bold transition-all shadow-lg shadow-indigo-500/10"
                                    >
                                        {isAnalyzing ? (
                                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                                        ) : (
                                            <Sparkles size={14} className="text-yellow-300" />
                                        )}
                                        <span>Résumer & Analyser</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 max-h-[300px] overflow-y-auto custom-scrollbar pr-2 mt-2">
                            {prospect.notes?.map(note => (
                                <div key={note.id} className="relative bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-100 dark:border-slate-700 text-sm shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${note.author === 'IA Assistant' || note.author === 'Import' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'}`}>
                                            {note.author || 'Vous'}
                                        </span>
                                        <span className="text-[10px] text-slate-400">{new Date(note.date).toLocaleString()}</span>
                                    </div>
                                    <p className="text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">{note.content}</p>
                                </div>
                            ))}
                            {(!prospect.notes || prospect.notes.length === 0) && (
                                <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                                    <FileText size={24} className="mb-2 opacity-20" />
                                    <span className="text-xs italic">Aucune note pour le moment.</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- IMPORT MODAL ---
interface ImportProspectModalProps {
    onClose: () => void;
    onImport: (p: Prospect[]) => void;
}

const ImportProspectModal: React.FC<ImportProspectModalProps> = ({ onClose, onImport }) => {
    const [text, setText] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const handleImport = async () => {
        if (!text.trim()) return;
        setIsProcessing(true);
        try {
            const result = await parseProspectList(text);
            const prospects: Prospect[] = result.map(raw => ({
                id: Date.now().toString() + Math.random().toString().slice(2, 6),
                status: (raw.status as ProspectStatus) || ProspectStatus.NEW,
                companyName: raw.companyName,
                contactName: raw.contactName || 'Inconnu',
                email: raw.email,
                phone: raw.phone,
                city: raw.city,
                estimatedAmount: raw.estimatedAmount,
                notes: raw.notes ? [{ id: Date.now().toString(), content: raw.notes, date: Date.now(), author: 'Import' }] : [],
                createdAt: Date.now(),
                source: 'Import AI'
            }));
            onImport(prospects);
        } catch (e) {
            console.error(e);
            alert("Erreur lors de l'import AI");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden p-6 space-y-4 animate-in zoom-in-95">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Upload size={20} className="text-emerald-500" /> Importer des Prospects
                    </h3>
                    <button onClick={onClose}><X size={20} className="text-slate-400 hover:text-slate-600" /></button>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                        <strong>Intelligence Artificielle :</strong> Copiez-collez simplement le contenu brut de votre fichier Excel ou CSV ci-dessous. Gemini va analyser et structurer les colonnes (Nom, Email, Tel, Budget...) automatiquement.
                    </p>
                </div>

                <textarea
                    className="w-full h-48 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
                    placeholder={`Exemple de contenu brut :
                    
Nom, Email, Tel, Budget
Jean Dupont, jean@mail.com, 0600000000, 15000
Entreprise ABC, contact@abc.com, 0102030405, 50000
...`}
                    value={text}
                    onChange={e => setText(e.target.value)}
                />

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleImport}
                        disabled={isProcessing || !text.trim()}
                        className="w-full flex justify-center items-center px-4 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? (
                            <>
                                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                                Analyse et Structuration...
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} className="mr-2 text-yellow-300" />
                                Importer avec Gemini
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ProspectionPage;
