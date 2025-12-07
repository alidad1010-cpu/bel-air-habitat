
import React, { useState, useMemo } from 'react';
import { CheckSquare, Plus, Calendar, Check, X, Trash2, ListTodo, Search, Clock, TrendingUp, History, PieChart, Activity, AlertTriangle, BarChart3, ArrowRight } from 'lucide-react';
import { User, PersonalTask, Project, Appointment, ProjectStatus } from '../types';

interface TasksPageProps {
    currentUser: User;
    onUpdateUser: (user: User) => void;
    projects: Project[];
    onUpdateProject: (project: Project) => void;
}

const TasksPage: React.FC<TasksPageProps> = ({ currentUser, onUpdateUser, projects, onUpdateProject }) => {
    const [activeTab, setActiveTab] = useState<'ACTIVE' | 'HISTORY'>('ACTIVE');

    // New Task Form State
    const [newTaskLabel, setNewTaskLabel] = useState('');
    const [newTaskDate, setNewTaskDate] = useState(new Date().toISOString().split('T')[0]);
    const [newTaskTime, setNewTaskTime] = useState('12:00');

    // Appointment Modal State
    const [isApptModalOpen, setIsApptModalOpen] = useState(false);
    const [newAppointment, setNewAppointment] = useState({
        projectId: '',
        title: 'RDV Chantier',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        note: ''
    });

    // Stats Comparison State
    const [monthA, setMonthA] = useState<string>('');
    const [monthB, setMonthB] = useState<string>('');

    // Styles
    const inputClass = "w-full p-3 bg-white dark:bg-slate-900 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dark:text-white placeholder-slate-400 text-sm";
    const labelClass = "block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-white uppercase mb-1";

    // --- DATA PROCESSING ---

    const allTasks = useMemo(() => currentUser.personalTasks || [], [currentUser.personalTasks]);

    // Split Active vs Archived
    const activeTasks = useMemo(() => {
        return allTasks.filter(t => t.status === 'IN_PROGRESS').sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    }, [allTasks]);

    const archivedTasks = useMemo(() => {
        return allTasks.filter(t => t.status !== 'IN_PROGRESS').sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
    }, [allTasks]);

    // Generate available months for stats
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        allTasks.forEach(t => {
            const date = new Date(t.completedAt || t.createdAt);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            months.add(key);
        });
        // Add current month if not exists
        const now = new Date();
        months.add(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);

        return Array.from(months).sort().reverse();
    }, [allTasks]);

    // Set default months for comparison on load
    React.useEffect(() => {
        if (availableMonths.length > 0 && !monthA) setMonthA(availableMonths[0]);
        if (availableMonths.length > 1 && !monthB) setMonthB(availableMonths[1]);
    }, [availableMonths]);

    // --- ACTIONS ---

    const handleAddTask = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newTaskLabel.trim()) return;

        const finalDueDate = newTaskTime ? `${newTaskDate}T${newTaskTime}` : newTaskDate;

        const task: PersonalTask = {
            id: Date.now().toString(),
            label: newTaskLabel,
            dueDate: finalDueDate,
            status: 'IN_PROGRESS',
            createdAt: Date.now()
        };

        const updatedTasks = [task, ...allTasks];
        onUpdateUser({ ...currentUser, personalTasks: updatedTasks });
        setNewTaskLabel('');
    };

    const updateTaskStatus = (taskId: string, newStatus: PersonalTask['status']) => {
        const updatedTasks = allTasks.map(t => {
            if (t.id === taskId) {
                // Logic to determine if late
                if (newStatus === 'DONE_ON_TIME' || newStatus === 'DONE_LATE') {
                    const now = new Date();
                    const due = new Date(t.dueDate.includes('T') ? t.dueDate : `${t.dueDate}T23:59`);
                    // Margin of 15 mins
                    const isLate = now.getTime() > (due.getTime() + 15 * 60000);
                    return { ...t, status: (isLate ? 'DONE_LATE' : 'DONE_ON_TIME') as PersonalTask['status'], completedAt: Date.now() };
                }
                return { ...t, status: newStatus, completedAt: Date.now() };
            }
            return t;
        });
        onUpdateUser({ ...currentUser, personalTasks: updatedTasks });
    };

    const deleteTask = (taskId: string) => {
        const isHistory = activeTab === 'HISTORY';
        const message = isHistory
            ? "Supprimer définitivement de l'historique ?"
            : "Supprimer définitivement ?\n\nSi vous avez raté la tâche, utilisez plutôt 'Abandonner' pour garder une trace.";

        if (window.confirm(message)) {
            const updatedTasks = allTasks.filter(t => t.id !== taskId);
            onUpdateUser({ ...currentUser, personalTasks: updatedTasks });
        }
    };

    const handleSaveAppointment = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newAppointment.projectId) {
            alert("Veuillez sélectionner un chantier.");
            return;
        }
        const targetProject = projects.find(p => p.id === newAppointment.projectId);
        if (targetProject) {
            const appointment: Appointment = {
                id: Date.now().toString(),
                date: newAppointment.date,
                startTime: newAppointment.startTime,
                endTime: newAppointment.endTime,
                title: newAppointment.title,
                status: 'SCHEDULED',
                note: newAppointment.note
            };
            const updatedProject = { ...targetProject, appointments: [...(targetProject.appointments || []), appointment] };
            onUpdateProject(updatedProject);
            setIsApptModalOpen(false);
            setNewAppointment({ projectId: '', title: 'RDV Chantier', date: new Date().toISOString().split('T')[0], startTime: '09:00', endTime: '10:00', note: '' });
            alert("Rendez-vous ajouté à l'agenda !");
        }
    };

    // --- STATS CALCULATION HELPER ---
    const calculateStatsForMonth = (monthKey: string) => {
        if (!monthKey) return null;
        const [year, month] = monthKey.split('-');

        const tasksInMonth = allTasks.filter(t => {
            const d = new Date(t.completedAt || t.createdAt); // Use completion date for stats, or creation if not done
            return d.getFullYear() === parseInt(year) && (d.getMonth() + 1) === parseInt(month);
        });

        const total = tasksInMonth.length;
        if (total === 0) return null;

        const onTime = tasksInMonth.filter(t => t.status === 'DONE_ON_TIME').length;
        const late = tasksInMonth.filter(t => t.status === 'DONE_LATE').length;
        const missed = tasksInMonth.filter(t => t.status === 'MISSED').length;

        return {
            total,
            onTime,
            late,
            missed,
            successRate: Math.round(((onTime) / total) * 100),
            lateRate: Math.round((late / total) * 100),
            missedRate: Math.round((missed / total) * 100),
            label: new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
        };
    };

    const statsA = calculateStatsForMonth(monthA);
    const statsB = calculateStatsForMonth(monthB);

    // Active Projects for dropdown
    const activeProjects = projects.filter(p => p.status !== ProjectStatus.COMPLETED && p.status !== ProjectStatus.CANCELLED && p.status !== ProjectStatus.LOST);

    return (
        <div className="space-y-6 animate-fade-in pb-12 max-w-6xl mx-auto">

            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                        <CheckSquare className="text-emerald-600 dark:text-emerald-400" size={28} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Mes Tâches</h2>
                        <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white">Organisation personnelle</p>
                    </div>
                </div>

                <button
                    onClick={() => setIsApptModalOpen(true)}
                    className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-indigo-200 dark:shadow-none transition-all hover:scale-105"
                >
                    <Calendar size={18} className="mr-2" /> Planifier RDV
                </button>
            </div>

            {/* TABS SWITCHER */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-fit">
                <button
                    onClick={() => setActiveTab('ACTIVE')}
                    className={`flex-1 md:w-40 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'ACTIVE' ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-emerald-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:text-white dark:text-white'}`}
                >
                    <ListTodo size={16} className="mr-2" /> À Faire ({activeTasks.length})
                </button>
                <button
                    onClick={() => setActiveTab('HISTORY')}
                    className={`flex-1 md:w-40 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center ${activeTab === 'HISTORY' ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-emerald-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:text-white dark:text-white'}`}
                >
                    <History size={16} className="mr-2" /> Historique
                </button>
            </div>

            {/* --- ACTIVE TASKS TAB --- */}
            {activeTab === 'ACTIVE' && (
                <div className="space-y-6 animate-in slide-in-from-left-4 fade-in">

                    {/* ADD TASK FORM */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-5">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-4 flex items-center text-sm">
                            <Plus size={16} className="mr-2 text-emerald-500" /> NOUVELLE TÂCHE
                        </h3>
                        <form onSubmit={handleAddTask} className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <input
                                    type="text"
                                    value={newTaskLabel}
                                    onChange={(e) => setNewTaskLabel(e.target.value)}
                                    placeholder="Description de la tâche..."
                                    className={inputClass}
                                />
                            </div>
                            <div className="w-full md:w-40">
                                <input type="date" value={newTaskDate} onChange={(e) => setNewTaskDate(e.target.value)} className={inputClass} />
                            </div>
                            <div className="w-full md:w-32">
                                <input type="time" value={newTaskTime} onChange={(e) => setNewTaskTime(e.target.value)} className={inputClass} />
                            </div>
                            <button type="submit" className="bg-slate-900 dark:bg-slate-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-emerald-600 transition-colors shadow-lg">
                                Ajouter
                            </button>
                        </form>
                    </div>

                    {/* ACTIVE LIST */}
                    <div className="space-y-3">
                        {activeTasks.length === 0 ? (
                            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Check size={32} className="text-emerald-500" />
                                </div>
                                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Tout est en ordre !</h3>
                                <p className="text-slate-700 dark:text-slate-200 dark:text-white">Aucune tâche en cours pour le moment.</p>
                            </div>
                        ) : (
                            activeTasks.map(task => {
                                const now = new Date();
                                const dueString = task.dueDate.includes('T') ? task.dueDate : `${task.dueDate}T23:59`;
                                const due = new Date(dueString);
                                const isLate = now > due;

                                return (
                                    <div key={task.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row md:items-center justify-between group hover:border-emerald-500 transition-all gap-4">
                                        <div className="flex items-center space-x-4">
                                            <div className="flex flex-col space-y-2">
                                                <button
                                                    onClick={() => updateTaskStatus(task.id, 'DONE_ON_TIME')}
                                                    className="w-10 h-10 rounded-xl border-2 border-slate-300 dark:border-slate-600 hover:bg-emerald-500 hover:border-emerald-500 hover:text-slate-900 dark:text-white dark:text-white flex items-center justify-center transition-all text-emerald-600 dark:text-emerald-400 shadow-sm"
                                                    title="Marquer comme fait"
                                                >
                                                    <Check size={20} strokeWidth={3} />
                                                </button>
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white text-lg">{task.label}</p>
                                                <div className="flex items-center space-x-3 mt-1 text-sm">
                                                    <span className={`flex items-center font-medium ${isLate ? 'text-red-600 animate-pulse' : 'text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white'}`}>
                                                        <Clock size={14} className="mr-1.5" />
                                                        {due.toLocaleDateString()} à {due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    {isLate && <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-black uppercase tracking-wide">En Retard</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-end space-x-3 w-full md:w-auto border-t md:border-t-0 border-slate-100 dark:border-slate-800 pt-3 md:pt-0">
                                            <button
                                                onClick={() => updateTaskStatus(task.id, 'MISSED')}
                                                className="px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                                title="Je laisse tomber (Va dans l'historique comme 'Raté')"
                                            >
                                                Abandonner
                                            </button>

                                            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>

                                            <button
                                                onClick={() => deleteTask(task.id)}
                                                className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                                title="Supprimer définitivement (Erreur de saisie)"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* --- HISTORY TAB --- */}
            {activeTab === 'HISTORY' && (
                <div className="space-y-8 animate-in slide-in-from-right-4 fade-in">

                    {/* STATISTICS COMPARISON MODULE */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                                <TrendingUp size={20} className="mr-2 text-indigo-500" /> Statistiques & Graphiques
                            </h3>
                        </div>

                        {availableMonths.length === 0 ? (
                            <p className="text-slate-700 dark:text-slate-200 dark:text-white text-center py-4">Pas assez de données pour générer des statistiques.</p>
                        ) : (
                            <div className="space-y-6">
                                {/* Selectors */}
                                <div className="grid grid-cols-2 gap-8">
                                    <div>
                                        <label className={labelClass}>Mois A (Référence)</label>
                                        <select
                                            value={monthA}
                                            onChange={(e) => setMonthA(e.target.value)}
                                            className={inputClass}
                                        >
                                            {availableMonths.map(m => (
                                                <option key={m} value={m}>{new Date(m).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={labelClass}>Mois B (Comparaison)</label>
                                        <select
                                            value={monthB}
                                            onChange={(e) => setMonthB(e.target.value)}
                                            className={inputClass}
                                        >
                                            <option value="">-- Comparer avec --</option>
                                            {availableMonths.map(m => (
                                                <option key={m} value={m}>{new Date(m).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* VISUAL GRAPHICAL COMPARISON */}
                                <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-6 flex items-center">
                                        <BarChart3 size={16} className="mr-2 text-slate-700 dark:text-slate-200 dark:text-white" /> Graphique Comparatif
                                    </h4>

                                    {/* 1. TOTAL VOLUME */}
                                    <div className="mb-8 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase">Volume Total de Tâches</p>
                                        </div>
                                        <div className="flex flex-col space-y-3">
                                            {statsA && (
                                                <div className="flex items-center">
                                                    <span className="w-32 text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white truncate">{statsA.label}</span>
                                                    <div className="flex-1 bg-white dark:bg-slate-900 dark:bg-slate-800 rounded-full h-8 overflow-hidden relative mx-2 border border-slate-100 dark:border-slate-600">
                                                        <div
                                                            className="bg-blue-500 h-full flex items-center px-3 text-slate-900 dark:text-white dark:text-white text-xs font-bold transition-all duration-1000 ease-out"
                                                            style={{ width: `${Math.min(100, (statsA.total / Math.max(statsA.total, statsB?.total || 1)) * 100)}%` }}
                                                        >
                                                            {statsA.total}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            {statsB && (
                                                <div className="flex items-center">
                                                    <span className="w-32 text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white truncate">{statsB.label}</span>
                                                    <div className="flex-1 bg-white dark:bg-slate-900 dark:bg-slate-800 rounded-full h-8 overflow-hidden relative mx-2 border border-slate-100 dark:border-slate-600">
                                                        <div
                                                            className="bg-indigo-500 h-full flex items-center px-3 text-slate-900 dark:text-white dark:text-white text-xs font-bold transition-all duration-1000 ease-out"
                                                            style={{ width: `${Math.min(100, (statsB.total / Math.max(statsA?.total || 1, statsB.total)) * 100)}%` }}
                                                        >
                                                            {statsB.total}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* 2. SUCCESS RATE */}
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase mb-2">Taux de Réussite (À l'heure)</p>
                                            <div className="space-y-4">
                                                {statsA && (
                                                    <div className="relative pt-1">
                                                        <div className="flex mb-1 items-center justify-between">
                                                            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{statsA.label}</span>
                                                            <span className="text-xs font-bold inline-block text-blue-600 dark:text-blue-400">{statsA.successRate}%</span>
                                                        </div>
                                                        <div className="overflow-hidden h-3 mb-1 text-xs flex rounded bg-blue-100 dark:bg-blue-900/30">
                                                            <div style={{ width: `${statsA.successRate}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-slate-900 dark:text-white dark:text-white justify-center bg-blue-500 transition-all duration-1000"></div>
                                                        </div>
                                                    </div>
                                                )}
                                                {statsB && (
                                                    <div className="relative pt-1">
                                                        <div className="flex mb-1 items-center justify-between">
                                                            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{statsB.label}</span>
                                                            <span className="text-xs font-bold inline-block text-indigo-600 dark:text-indigo-400">{statsB.successRate}%</span>
                                                        </div>
                                                        <div className="overflow-hidden h-3 mb-1 text-xs flex rounded bg-indigo-100 dark:bg-indigo-900/30">
                                                            <div style={{ width: `${statsB.successRate}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-slate-900 dark:text-white dark:text-white justify-center bg-indigo-500 transition-all duration-1000"></div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. LATE & MISSED RATE */}
                                        <div>
                                            <p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase mb-2">Retards & Échecs</p>
                                            <div className="space-y-4">
                                                {statsA && (
                                                    <div className="relative pt-1">
                                                        <div className="flex mb-1 items-center justify-between">
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white">{statsA.label}</span>
                                                            <span className="text-xs font-bold inline-block text-red-500">{statsA.lateRate + statsA.missedRate}%</span>
                                                        </div>
                                                        <div className="overflow-hidden h-3 mb-1 text-xs flex rounded bg-slate-100 dark:bg-slate-800">
                                                            <div style={{ width: `${statsA.lateRate}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-slate-900 dark:text-white dark:text-white justify-center bg-yellow-400 transition-all duration-1000" title="En Retard"></div>
                                                            <div style={{ width: `${statsA.missedRate}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-slate-900 dark:text-white dark:text-white justify-center bg-red-500 transition-all duration-1000" title="Échec"></div>
                                                        </div>
                                                    </div>
                                                )}
                                                {statsB && (
                                                    <div className="relative pt-1">
                                                        <div className="flex mb-1 items-center justify-between">
                                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white">{statsB.label}</span>
                                                            <span className="text-xs font-bold inline-block text-red-500">{statsB.lateRate + statsB.missedRate}%</span>
                                                        </div>
                                                        <div className="overflow-hidden h-3 mb-1 text-xs flex rounded bg-slate-100 dark:bg-slate-800">
                                                            <div style={{ width: `${statsB.lateRate}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-slate-900 dark:text-white dark:text-white justify-center bg-yellow-400 transition-all duration-1000" title="En Retard"></div>
                                                            <div style={{ width: `${statsB.missedRate}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-slate-900 dark:text-white dark:text-white justify-center bg-red-500 transition-all duration-1000" title="Échec"></div>
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="flex justify-end space-x-3 text-[10px] text-slate-700 dark:text-slate-200 dark:text-white">
                                                    <div className="flex items-center"><div className="w-2 h-2 bg-yellow-400 rounded-full mr-1"></div> Retard</div>
                                                    <div className="flex items-center"><div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div> Raté</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ARCHIVED LIST */}
                    <div>
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase text-xs mb-3 ml-1 flex items-center justify-between">
                            <span>Historique Détaillé</span>
                            <span className="bg-slate-200 text-slate-700 dark:text-slate-200 px-2 py-0.5 rounded-full text-[10px]">{archivedTasks.length}</span>
                        </h3>
                        <div className="space-y-2 opacity-90">
                            {archivedTasks.length === 0 ? (
                                <p className="text-slate-700 dark:text-slate-200 dark:text-white italic text-sm p-4">Aucune tâche dans l'historique.</p>
                            ) : (
                                archivedTasks.map(task => (
                                    <div key={task.id} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex justify-between items-center group hover:bg-white dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors">
                                        <div className="flex items-center space-x-3">
                                            {task.status === 'MISSED' ? (
                                                <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center text-red-600 shrink-0"><X size={14} /></div>
                                            ) : (
                                                <div className={`w-6 h-6 rounded flex items-center justify-center text-slate-900 dark:text-white dark:text-white shrink-0 ${task.status === 'DONE_LATE' ? 'bg-yellow-500' : 'bg-emerald-500'}`}><Check size={14} /></div>
                                            )}
                                            <div className="flex flex-col">
                                                <span className={`text-sm font-medium ${task.status === 'MISSED' ? 'text-slate-700 dark:text-slate-200 dark:text-white line-through' : 'text-slate-800 dark:text-slate-100 dark:text-white dark:text-white'}`}>{task.label}</span>
                                                <span className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white flex items-center mt-0.5">
                                                    {new Date(task.completedAt || task.createdAt).toLocaleDateString()}
                                                    {task.status === 'DONE_LATE' && <span className="ml-2 text-yellow-600 font-bold bg-yellow-100 px-1 rounded flex items-center"><Activity size={8} className="mr-1" /> Retard</span>}
                                                    {task.status === 'MISSED' && <span className="ml-2 text-red-500 font-bold bg-red-50 px-1 rounded flex items-center"><AlertTriangle size={8} className="mr-1" /> Raté</span>}
                                                </span>
                                            </div>
                                        </div>
                                        {/* Bouton de suppression TOUJOURS visible, pas seulement au survol */}
                                        <button
                                            onClick={() => deleteTask(task.id)}
                                            className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                            title="Supprimer définitivement"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* APPOINTMENT MODAL */}
            {isApptModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                                <Calendar size={20} className="mr-2 text-indigo-600" /> Planifier un RDV Chantier
                            </h3>
                            <button onClick={() => setIsApptModalOpen(false)} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAppointment} className="p-6 space-y-4">
                            <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-4">
                                <label className={labelClass}>Lier au chantier (Requis)</label>
                                <div className="relative">
                                    <Search size={16} className="absolute left-3 top-3 text-slate-700 dark:text-slate-200 dark:text-white pointer-events-none" />
                                    <select
                                        required
                                        value={newAppointment.projectId}
                                        onChange={(e) => setNewAppointment({ ...newAppointment, projectId: e.target.value })}
                                        className={`${inputClass} pl-10 appearance-none cursor-pointer font-bold`}
                                    >
                                        <option value="">-- Sélectionner un dossier --</option>
                                        {activeProjects.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.client.name} - {p.title}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Titre du RDV</label>
                                <input
                                    type="text"
                                    required
                                    value={newAppointment.title}
                                    onChange={e => setNewAppointment({ ...newAppointment, title: e.target.value })}
                                    className={inputClass}
                                    placeholder="Ex: Visite technique, Prise de mesures..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={newAppointment.date}
                                        onChange={e => setNewAppointment({ ...newAppointment, date: e.target.value })}
                                        className={inputClass}
                                    />
                                </div>
                                <div className="flex space-x-2">
                                    <div className="flex-1">
                                        <label className={labelClass}>Début</label>
                                        <input
                                            type="time"
                                            required
                                            value={newAppointment.startTime}
                                            onChange={e => setNewAppointment({ ...newAppointment, startTime: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className={labelClass}>Fin</label>
                                        <input
                                            type="time"
                                            required
                                            value={newAppointment.endTime}
                                            onChange={e => setNewAppointment({ ...newAppointment, endTime: e.target.value })}
                                            className={inputClass}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className={labelClass}>Notes / Instructions</label>
                                <textarea
                                    value={newAppointment.note}
                                    onChange={e => setNewAppointment({ ...newAppointment, note: e.target.value })}
                                    className={`${inputClass} resize-none`}
                                    rows={2}
                                    placeholder="Détails spécifiques..."
                                />
                            </div>

                            <div className="flex justify-end pt-4 space-x-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                                <button type="button" onClick={() => setIsApptModalOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-200 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Annuler</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 dark:shadow-none">
                                    Ajouter à l'Agenda
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TasksPage;
