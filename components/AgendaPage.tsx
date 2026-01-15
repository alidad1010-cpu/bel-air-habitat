import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Briefcase,
  Plus,
  X,
  Search,
} from 'lucide-react';
import { Project, ProjectStatus, User, Appointment } from '../types';

interface AgendaPageProps {
  projects: Project[];
  onProjectClick: (project: Project) => void;
  currentUser?: User | null;
  onUpdateProject: (project: Project) => void;
}

const AgendaPage: React.FC<AgendaPageProps> = ({
  projects,
  onProjectClick,
  onUpdateProject,
  currentUser,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Input Class for Modal (Defined here or outside)
  const inputClass =
    'w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm';
  const labelClass =
    'block text-xs font-semibold text-slate-700 dark:text-slate-200 uppercase mb-1';

  // Add Appointment Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    projectId: '',
    title: 'RDV Chantier',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    note: '',
    visibility: 'TEAM', // Default
  });

  // Filter projects for dropdown
  const sortedProjectsForDropdown = [...projects].sort((a, b) => {
    if (a.status === ProjectStatus.IN_PROGRESS && b.status !== ProjectStatus.IN_PROGRESS) return -1;
    return 0;
  });

  // ... (Keep helpers: getDaysInMonth, getFirstDayOfMonth, changeMonth, etc.)

  // Updated handleSaveAppointment
  const handleSaveAppointment = (e: React.FormEvent) => {
    e.preventDefault();

    let targetProjectId = newAppointment.projectId;

    // Logic for "No Project" -> Try to find general/internal project
    if (!targetProjectId) {
      const generalProject = projects.find(
        (p) =>
          p.title.toLowerCase().includes('general') ||
          p.title.toLowerCase().includes('divers') ||
          p.title.toLowerCase().includes('interne') ||
          p.client.name.toLowerCase().includes('interne')
      );

      if (generalProject) {
        targetProjectId = generalProject.id;
      } else {
        alert(
          "Aucun dossier sélectionné. Veuillez sélectionner un chantier ou créer un dossier 'Divers' pour les RDV généraux."
        );
        return;
      }
    }

    const targetProject = projects.find((p) => p.id === targetProjectId);
    if (targetProject) {
      const appointment: Appointment = {
        id: Date.now().toString(),
        date: newAppointment.date,
        startTime: newAppointment.startTime,
        endTime: newAppointment.endTime,
        title: newAppointment.title,
        status: 'SCHEDULED',
        note: newAppointment.note,
        visibility: newAppointment.visibility as 'TEAM' | 'PRIVATE',
        createdBy: currentUser?.id,
      };

      const updatedProject = {
        ...targetProject,
        appointments: [...(targetProject.appointments || []), appointment],
      };

      onUpdateProject(updatedProject);
      setIsAddModalOpen(false);

      // Reset
      setNewAppointment((prev) => ({
        ...prev,
        title: 'RDV Chantier',
        note: '',
        projectId: '',
        visibility: 'TEAM',
      }));
    }
  };

  // ... (Helpers: getTypeColor)

  // Helper to get days in month
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const changeMonth = (offset: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + offset, 1));
  };

  const daysInMonth = getDaysInMonth(currentDate);
  const firstDay = getFirstDayOfMonth(currentDate);
  const monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];

  const getTypeColor = (type?: string, isBar = false) => {
    const t = (type || 'Particulier').toLowerCase();

    // Returns full solid background for bars, or light bg with border for dots/badges
    if (t.includes('sinistre'))
      return isBar
        ? 'bg-orange-500 text-slate-900 dark:text-white dark:text-white'
        : 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/50 dark:text-orange-200 dark:border-orange-800';

    if (t.includes('entreprise'))
      return isBar
        ? 'bg-slate-600 text-slate-900 dark:text-white dark:text-white'
        : 'bg-slate-100 text-slate-800 dark:text-slate-100 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-600';

    if (t.includes('sav'))
      return isBar
        ? 'bg-yellow-500 text-slate-900 dark:text-white dark:text-white'
        : 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-200 dark:border-yellow-800';

    if (t.includes('copropriété') || t.includes('bailleur') || t.includes('syndic'))
      return isBar
        ? 'bg-purple-600 text-slate-900 dark:text-white dark:text-white'
        : 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/50 dark:text-purple-200 dark:border-purple-800';

    if (t.includes('architecte'))
      return isBar
        ? 'bg-indigo-600 text-white'
        : 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-200 dark:border-indigo-800';

    // NEW: Sous-traitance (Cyan)
    if (t.includes('sous-traitance'))
      return isBar
        ? 'bg-cyan-600 text-slate-900 dark:text-white dark:text-white'
        : 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/50 dark:text-cyan-200 dark:border-cyan-800';

    // NEW: Partenaire (Amber)
    if (t.includes('partenaire'))
      return isBar
        ? 'bg-amber-600 text-slate-900 dark:text-white dark:text-white'
        : 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/50 dark:text-amber-200 dark:border-amber-800';

    // Default (Particulier)
    return isBar
      ? 'bg-emerald-600 text-white'
      : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-800';
  };

  // Helper to format date manually to YYYY-MM-DD to avoid Timezone issues
  const formatDateStr = (year: number, monthIndex: number, day: number) => {
    const m = String(monthIndex + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  };

  // ... (previous helper)
  const getProjectsForDay = (day: number) => {
    const targetDateStr = formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), day);

    return projects.filter((p) => {
      // 1. Check for Specific Appointment
      if (
        p.appointments?.some((a) => {
          if (a.date !== targetDateStr) return false;
          // Privacy Filter
          if (a.visibility === 'PRIVATE' && a.createdBy !== currentUser?.id) return false;
          return true;
        })
      )
        return true;

      // 2. Check for Project Duration (Active only)
      const isActiveStatus = [
        ProjectStatus.VALIDATED,
        ProjectStatus.IN_PROGRESS,
        ProjectStatus.WAITING_VALIDATION,
        ProjectStatus.NEW,
        ProjectStatus.COMPLETED,
      ].includes(p.status);

      if (isActiveStatus && p.startDate && p.endDate) {
        return targetDateStr >= p.startDate && targetDateStr <= p.endDate;
      }
      return false;
    });
  };

  const daysArray = Array.from({ length: 42 }, (_, i) => {
    // ... same logic
    const dayNumber = i - firstDay + 1;
    const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;
    return {
      day: isCurrentMonth ? dayNumber : null,
      projects: isCurrentMonth ? getProjectsForDay(dayNumber) : [],
    };
  });

  const selectedDayProjects = projects.filter((p) => {
    const dateStr = formatDateStr(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate()
    );

    // 1. Appointment Match with Privacy Filter
    if (
      p.appointments?.some((a) => {
        if (a.date !== dateStr) return false;
        if (a.visibility === 'PRIVATE' && a.createdBy !== currentUser?.id) return false;
        return true;
      })
    )
      return true;

    // 2. Duration Match
    const isActiveStatus = [
      ProjectStatus.VALIDATED,
      ProjectStatus.IN_PROGRESS,
      ProjectStatus.WAITING_VALIDATION,
      ProjectStatus.COMPLETED,
    ].includes(p.status);
    if (isActiveStatus && p.startDate && p.endDate) {
      return dateStr >= p.startDate && dateStr <= p.endDate;
    }
    return false;
  });

  const openAddModal = () => {
    setNewAppointment((prev) => ({
      ...prev,
      date: formatDateStr(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate()
      ),
      visibility: 'TEAM',
    }));
    setIsAddModalOpen(true);
  };

  // ... (styles)

  return (
    <div className="flex flex-col h-full animate-fade-in space-y-6">
      {/* ... (Header & Calendar Grid unchanged) ... */}
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 dark:text-white capitalize flex items-center">
          <CalendarIcon className="mr-3 text-emerald-600" />
          Planning Chantiers
        </h2>
        <div className="flex space-x-3">
          <button
            onClick={openAddModal}
            className="flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors text-sm"
          >
            <Plus size={18} className="mr-2" /> Nouveau RDV
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full">
        {/* Calendar Grid */}
        <div className="flex-1 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white text-lg capitalize">
              {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={() => changeMonth(-1)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 dark:text-white transition-colors"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-slate-700 dark:text-slate-200 dark:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Aujourd'hui
              </button>
              <button
                onClick={() => changeMonth(1)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-200 dark:text-white transition-colors"
              >
                <ChevronRight size={24} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((day) => (
              <div
                key={day}
                className="bg-slate-50 dark:bg-slate-900 p-3 text-center text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase tracking-wide"
              >
                {day}
              </div>
            ))}

            {daysArray.map((item, index) => {
              const isSelected =
                item.day &&
                selectedDate.getDate() === item.day &&
                selectedDate.getMonth() === currentDate.getMonth() &&
                selectedDate.getFullYear() === currentDate.getFullYear();

              const isToday =
                item.day &&
                new Date().getDate() === item.day &&
                new Date().getMonth() === currentDate.getMonth() &&
                new Date().getFullYear() === currentDate.getFullYear();

              const dateStr = item.day
                ? formatDateStr(currentDate.getFullYear(), currentDate.getMonth(), item.day)
                : '';

              return (
                <div
                  key={index}
                  onClick={() =>
                    item.day &&
                    setSelectedDate(
                      new Date(currentDate.getFullYear(), currentDate.getMonth(), item.day)
                    )
                  }
                  className={`min-h-[120px] bg-white dark:bg-slate-900 p-1 relative group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors ${isSelected ? 'ring-2 ring-inset ring-emerald-500 z-10' : ''}`}
                >
                  {item.day && (
                    <>
                      <div className="flex justify-between items-start mb-1 px-1">
                        <span
                          className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-600 text-white' : isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200 dark:text-white'}`}
                        >
                          {item.day}
                        </span>
                      </div>

                      <div className="mt-1 space-y-1 overflow-hidden">
                        {item.projects.map((proj, idx) => {
                          const hasApt = proj.appointments?.some((a) => {
                            if (a.date !== dateStr) return false;
                            if (a.visibility === 'PRIVATE' && a.createdBy !== currentUser?.id)
                              return false;
                            return true;
                          });

                          if (hasApt) {
                            const relevantApt = proj.appointments?.find((a) => a.date === dateStr);
                            const isPrivate = relevantApt?.visibility === 'PRIVATE';

                            return (
                              <div
                                key={`${proj.id}-apt-${idx}`}
                                className={`text-[9px] font-bold truncate px-1 py-0.5 rounded border border-l-4 shadow-sm mb-1 ${isPrivate ? 'bg-slate-100 border-slate-400 text-slate-600' : getTypeColor(proj.folderType)}`}
                                title={`RDV: ${relevantApt?.title || 'RDV'} ${isPrivate ? '(Privé)' : ''}`}
                              >
                                {isPrivate ? '🔒 ' : <Clock size={8} className="inline mr-1" />}
                                {relevantApt?.startTime} -{' '}
                                {isPrivate ? 'Privé' : proj.client.name.split(' ')[0]}
                              </div>
                            );
                          } else {
                            // DURATION BAR
                            return (
                              <div
                                key={`${proj.id}-bar-${idx}`}
                                className={`text-[9px] truncate px-1.5 py-0.5 rounded-sm text-slate-900 dark:text-white font-medium mb-0.5 opacity-90 ${getTypeColor(proj.folderType, true)}`}
                                title={`Chantier En Cours: ${proj.title}`}
                              >
                                {proj.client.name.split(' ')[0]}
                              </div>
                            );
                          }
                        })}

                        {item.projects.length > 4 && (
                          <div className="text-[9px] text-slate-700 dark:text-slate-200 dark:text-white pl-1 italic">
                            + {item.projects.length - 4} autres
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-700 dark:text-slate-200 dark:text-white">
            <div className="flex items-center">
              <span className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></span> Particulier
            </div>
            {/* ... other legend ... */}
            <div className="flex items-center">
              <span className="w-3 h-3 rounded border border-slate-400 bg-slate-100 mr-2"></span> 🔒
              Privé
            </div>
          </div>
        </div>

        {/* Side Panel - Selected Date */}
        <div className="w-full lg:w-96 bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 flex flex-col h-auto lg:h-full">
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white mb-4 border-b border-slate-100 dark:border-slate-800 pb-4 capitalize">
            {selectedDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>

          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            {selectedDayProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-slate-700 dark:text-slate-200 dark:text-white">
                <Briefcase size={48} className="mb-2 opacity-20" />
                <p className="text-sm">Aucun chantier ou RDV ce jour</p>
                <button
                  onClick={openAddModal}
                  className="mt-4 text-emerald-600 text-sm font-bold hover:underline"
                >
                  + Ajouter un RDV
                </button>
              </div>
            ) : (
              selectedDayProjects.map((project) => {
                const dateStr = formatDateStr(
                  selectedDate.getFullYear(),
                  selectedDate.getMonth(),
                  selectedDate.getDate()
                );
                const relevantApt = project.appointments?.find((a) => a.date === dateStr);

                return (
                  <div
                    key={project.id}
                    onClick={() => onProjectClick(project)}
                    className="bg-white dark:bg-slate-900 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-600 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer transition-all shadow-sm hover:shadow-md group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border ${getTypeColor(project.folderType)}`}
                      >
                        {project.folderType || 'Particulier'}
                      </span>
                      {relevantApt ? (
                        relevantApt.visibility === 'PRIVATE' ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-500 text-white flex items-center">
                            🔒 Privé
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-emerald-600 text-white flex items-center">
                            <Clock size={10} className="mr-1" /> Rendez-vous
                          </span>
                        )
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-slate-200 text-slate-700 dark:text-slate-200 dark:bg-slate-600 dark:text-white">
                          Chantier en cours
                        </span>
                      )}
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white text-sm mb-1 group-hover:text-emerald-600 transition-colors">
                      {relevantApt ? relevantApt.title : project.title}
                    </h4>
                    <div className="text-xs text-slate-700 dark:text-slate-200 dark:text-white mb-2 truncate">
                      {project.client.name} - {project.title}
                    </div>
                    {/* ... (rest of details) ... */}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ADD APPOINTMENT MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 rounded-t-2xl">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white flex items-center">
                <Plus size={20} className="mr-2 text-emerald-600" /> Nouveau Rendez-vous
              </h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSaveAppointment} className="p-6 space-y-4">
              {/* Privacy Toggle */}
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg flex justify-center space-x-4 mb-2">
                <button
                  type="button"
                  onClick={() => setNewAppointment({ ...newAppointment, visibility: 'TEAM' })}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${newAppointment.visibility !== 'PRIVATE' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                >
                  👀 Équipe (Public)
                </button>
                <button
                  type="button"
                  onClick={() => setNewAppointment({ ...newAppointment, visibility: 'PRIVATE' })}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${newAppointment.visibility === 'PRIVATE' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200'}`}
                >
                  🔒 Privé (Moi)
                </button>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 mb-4">
                <label className={labelClass}>Lier au chantier (Optionnel)</label>
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-3 text-slate-700 dark:text-slate-200 dark:text-white pointer-events-none"
                  />
                  <select
                    value={newAppointment.projectId}
                    onChange={(e) =>
                      setNewAppointment({ ...newAppointment, projectId: e.target.value })
                    }
                    className={`${inputClass} pl-10 appearance-none cursor-pointer font-bold`}
                  >
                    <option value="">-- Aucun (Général) --</option>
                    {sortedProjectsForDropdown.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.client.name} - {p.title} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>
                {!newAppointment.projectId && (
                  <p className="text-[10px] text-amber-600 mt-2 flex items-center">
                    ⚠️ Nécessite un dossier "Divers" ou "Général" existant pour s'enregistrer.
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Titre du RDV</label>
                <input
                  type="text"
                  required
                  value={newAppointment.title}
                  onChange={(e) => setNewAppointment({ ...newAppointment, title: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Visite technique, Prise de mesures..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* ... Date/Time inputs ... */}
                <div>
                  <label className={labelClass}>Date</label>
                  <input
                    type="date"
                    required
                    value={newAppointment.date}
                    onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
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
                      onChange={(e) =>
                        setNewAppointment({ ...newAppointment, startTime: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div className="flex-1">
                    <label className={labelClass}>Fin</label>
                    <input
                      type="time"
                      required
                      value={newAppointment.endTime}
                      onChange={(e) =>
                        setNewAppointment({ ...newAppointment, endTime: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className={labelClass}>Notes / Instructions</label>
                <textarea
                  value={newAppointment.note}
                  onChange={(e) => setNewAppointment({ ...newAppointment, note: e.target.value })}
                  className={`${inputClass} resize-none`}
                  rows={3}
                  placeholder="Code porte, détails spécifiques..."
                />
              </div>

              <div className="flex justify-end pt-4 space-x-3 border-t border-slate-100 dark:border-slate-800 mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-700 dark:text-slate-200 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 dark:shadow-none"
                >
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

export default AgendaPage;
