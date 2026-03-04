import React, { useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { validate, ClientSchema } from '../utils/validation';
import ErrorHandler, { ErrorType } from '../services/errorService';
import AddressAutocomplete from './AddressAutocomplete';
import {
  Search,
  Plus,
  Mail,
  Phone,
  User,
  Briefcase,
  AlertTriangle,
  MapPin,
  Eye,
  DollarSign,
  FileText,
  Users,
  Building2,
  Hammer,
  Crown,
  Handshake,
  ChevronRight,
  SlidersHorizontal,
  X,
  ArrowUpDown,
} from 'lucide-react';

import { Client, Project, ClientType } from '../types';
import ClientDetailModal from './ClientDetailModal';

interface ClientsPageProps {
  clients: Client[];
  projects?: Project[];
  onAddClient: (client: Client) => void;
  onDeleteClient: (client: Client) => void;
  onUpdateClient?: (client: Client) => void;
  onNavigateToProject?: (project: Project) => void;
  onCreateProject?: (client: Client) => void;
  onBulkAddProjects?: (projects: Project[]) => void;
}

const ClientsPage: React.FC<ClientsPageProps> = ({
  clients,
  projects = [],
  onAddClient,
  onDeleteClient,
  onUpdateClient,
  onNavigateToProject,
  onCreateProject,
  onBulkAddProjects,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [typeFilter, setTypeFilter] = useState<ClientType | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'name' | 'projects' | 'revenue'>('name');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  const [newClient, setNewClient] = useState<Client>({
    name: '',
    email: '',
    phone: '',
    address: '',
    zipCode: '',
    city: '',
    type: 'PARTICULIER',
  });

  // Calculate client statistics
  const clientStats = useMemo(() => {
    const stats = new Map<string, { projectsCount: number; revenue: number }>();
    projects.forEach((project) => {
      if (project.client?.id) {
        const existing = stats.get(project.client.id) || { projectsCount: 0, revenue: 0 };
        stats.set(project.client.id, {
          projectsCount: existing.projectsCount + 1,
          revenue: existing.revenue + (project.budget || 0),
        });
      }
    });
    return stats;
  }, [projects]);

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    const lowerQuery = debouncedSearchQuery.toLowerCase().trim();
    let filtered = clients.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(lowerQuery) ||
        c.email?.toLowerCase().includes(lowerQuery) ||
        c.phone?.toLowerCase().includes(lowerQuery) ||
        c.city?.toLowerCase().includes(lowerQuery) ||
        c.zipCode?.toLowerCase().includes(lowerQuery);

      if (!matchesSearch) return false;
      if (typeFilter !== 'ALL' && c.type !== typeFilter) return false;

      if (lowerQuery.length > 0) return true;

      const isPartner = c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT';
      const nameLower = (c.name || '').toLowerCase();
      const normalizedName = nameLower.replace(/[^a-z0-9]/g, '');
      if (
        nameLower.includes('coop') ||
        nameLower.includes('syndic') ||
        normalizedName.includes('coop') ||
        /\bcop\b/.test(nameLower) ||
        nameLower.includes('cop ')
      ) {
        return true;
      }
      if (isPartner) return false;
      return true;
    });

    filtered = [...filtered].sort((a, b) => {
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      if (sortBy === 'projects') {
        const aS = clientStats.get(a.id || '') || { projectsCount: 0, revenue: 0 };
        const bS = clientStats.get(b.id || '') || { projectsCount: 0, revenue: 0 };
        return bS.projectsCount - aS.projectsCount;
      }
      if (sortBy === 'revenue') {
        const aS = clientStats.get(a.id || '') || { projectsCount: 0, revenue: 0 };
        const bS = clientStats.get(b.id || '') || { projectsCount: 0, revenue: 0 };
        return bS.revenue - aS.revenue;
      }
      return 0;
    });

    return filtered;
  }, [clients, debouncedSearchQuery, typeFilter, sortBy, clientStats]);

  const checkDuplicates = useCallback((client: Client) => {
    if (!client.email && !client.phone) return null;
    const duplicates = clients.filter((c) => {
      if (c.id === client.id) return false;
      const emailMatch = client.email && c.email && client.email.toLowerCase() === c.email.toLowerCase();
      const phoneMatch = client.phone && c.phone && client.phone.replace(/\s/g, '') === c.phone.replace(/\s/g, '');
      return emailMatch || phoneMatch;
    });
    if (duplicates.length > 0) return `Attention: Un client similaire existe déjà (${duplicates[0].name})`;
    return null;
  }, [clients]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const validation = validate(ClientSchema, newClient);
    if (!validation.success) {
      ErrorHandler.handleAndShow(
        { message: validation.errors.join('\n'), type: ErrorType.VALIDATION },
        'ClientsPage - Add Client'
      );
      return;
    }
    const dup = checkDuplicates(newClient);
    if (dup) {
      setDuplicateWarning(dup);
      setTimeout(() => setDuplicateWarning(null), 5000);
    }
    onAddClient(newClient);
    setIsModalOpen(false);
    setNewClient({ name: '', email: '', phone: '', address: '', zipCode: '', city: '', type: 'PARTICULIER' });
    setDuplicateWarning(null);
  }, [newClient, onAddClient, checkDuplicates]);

  const handleAddressSelect = useCallback((result: { fullAddress: string; street: string; city: string; zipCode: string }) => {
    setNewClient((prev) => ({
      ...prev,
      address: result.street || result.fullAddress,
      city: result.city,
      zipCode: result.zipCode,
    }));
  }, []);

  const getTypeLabel = useCallback((type?: ClientType) => {
    switch (type) {
      case 'PARTICULIER': return { label: 'Particulier', cls: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400', icon: User, color: 'emerald' };
      case 'ENTREPRISE': return { label: 'Entreprise', cls: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400', icon: Building2, color: 'blue' };
      case 'ARCHITECTE': return { label: 'Architecte', cls: 'bg-violet-50 text-violet-700 dark:bg-violet-950/30 dark:text-violet-400', icon: Hammer, color: 'violet' };
      case 'SYNDIC': return { label: 'Syndic', cls: 'bg-purple-50 text-purple-700 dark:bg-purple-950/30 dark:text-purple-400', icon: Crown, color: 'purple' };
      case 'PARTENAIRE': return { label: 'Partenaire', cls: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400', icon: Handshake, color: 'amber' };
      case 'SOUS_TRAITANT': return { label: 'Sous-Traitant', cls: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/30 dark:text-cyan-400', icon: Handshake, color: 'cyan' };
      case 'BAILLEUR': return { label: 'Bailleur', cls: 'bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400', icon: Building2, color: 'orange' };
      case 'SCI': return { label: 'SCI', cls: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400', icon: Users, color: 'rose' };
      default: return { label: 'Particulier', cls: 'bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-400', icon: User, color: 'slate' };
    }
  }, []);

  // Avatar color mapping
  const avatarColors: Record<string, string> = {
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
    violet: 'bg-violet-500',
    purple: 'bg-purple-500',
    amber: 'bg-amber-500',
    cyan: 'bg-cyan-500',
    orange: 'bg-orange-500',
    rose: 'bg-rose-500',
    slate: 'bg-slate-500',
  };

  const inputClass =
    'w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 text-sm transition-all';
  const labelClass =
    'block text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5';

  // Summary stats
  const totalRevenue = useMemo(() => {
    let total = 0;
    clientStats.forEach(s => total += s.revenue);
    return total;
  }, [clientStats]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ─── HEADER ──────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Base Clients
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3">
            <span className="font-semibold text-teal-600 dark:text-teal-400">{filteredClients.length}</span> client{filteredClients.length > 1 ? 's' : ''}
            {totalRevenue > 0 && (
              <>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {totalRevenue.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
                </span> de CA
              </>
            )}
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm hover:shadow-md transition-all text-sm"
        >
          <Plus size={18} />
          Nouveau Client
        </button>
      </div>

      {/* ─── SEARCH & FILTERS ────────────────────────────── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              name="client-search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Rechercher par nom, email, téléphone, ville..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400 transition-all"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative">
              <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as ClientType | 'ALL')}
                className="pl-8 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="ALL">Tous les types</option>
                <option value="PARTICULIER">Particuliers</option>
                <option value="ENTREPRISE">Entreprises</option>
                <option value="ARCHITECTE">Architectes</option>
                <option value="SYNDIC">Syndics</option>
                <option value="BAILLEUR">Bailleurs</option>
                <option value="SCI">SCI</option>
              </select>
            </div>

            <div className="relative">
              <ArrowUpDown size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'projects' | 'revenue')}
                className="pl-8 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none appearance-none cursor-pointer transition-all"
              >
                <option value="name">Tri: Nom</option>
                <option value="projects">Tri: Projets</option>
                <option value="revenue">Tri: CA</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ─── CLIENT CARDS GRID ───────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredClients.length > 0 ? (
          filteredClients.map((client, index) => {
            const typeInfo = getTypeLabel(client.type);
            const TypeIcon = typeInfo.icon;
            const stats = clientStats.get(client.id || '') || { projectsCount: 0, revenue: 0 };
            const avatarColor = avatarColors[typeInfo.color] || 'bg-slate-500';

            return (
              <div
                key={client.id || index}
                onClick={() => setSelectedClient(client)}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft hover:shadow-medium hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200 cursor-pointer group p-5"
              >
                {/* Top row: Avatar + Name + Badge */}
                <div className="flex items-start gap-3.5 mb-4">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center text-white font-bold text-lg flex-shrink-0 ${avatarColor}`}>
                    {client.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm leading-tight truncate">
                      {client.name}
                    </h3>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md mt-1 ${typeInfo.cls}`}>
                      <TypeIcon size={10} />
                      {typeInfo.label}
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClient(client);
                    }}
                    className="p-2 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950/30 dark:hover:text-teal-400 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Eye size={16} />
                  </button>
                </div>

                {/* Stats row */}
                {stats.projectsCount > 0 && (
                  <div className="flex items-center gap-4 mb-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                      <Briefcase size={13} className="text-slate-400" />
                      {stats.projectsCount} projet{stats.projectsCount > 1 ? 's' : ''}
                    </div>
                    {stats.revenue > 0 && (
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <DollarSign size={13} />
                        {new Intl.NumberFormat('fr-FR', {
                          style: 'currency',
                          currency: 'EUR',
                          maximumFractionDigits: 0,
                        }).format(stats.revenue)}
                      </div>
                    )}
                  </div>
                )}

                {/* Contact info */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <Mail size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate text-xs">{client.email || 'Non renseigné'}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-slate-600 dark:text-slate-400">
                    <Phone size={14} className="text-slate-400 flex-shrink-0" />
                    <span className="truncate text-xs">{client.phone || 'Non renseigné'}</span>
                  </div>
                  {(client.address || client.city) && (
                    <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-400">
                      <MapPin size={14} className="text-slate-400 flex-shrink-0 mt-0.5" />
                      <span className="text-xs line-clamp-1">
                        {client.address}{client.zipCode || client.city ? `, ${client.zipCode} ${client.city}` : ''}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onCreateProject) onCreateProject(client);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm"
                  >
                    <Plus size={14} />
                    Projet
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClient(client);
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    <FileText size={14} />
                    Détails
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full flex flex-col items-center justify-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-2xl mb-4">
              <User size={32} className="text-slate-400" />
            </div>
            <p className="font-semibold text-slate-600 dark:text-slate-300">Aucun client trouvé</p>
            <p className="text-sm mt-1">Essayez de modifier vos filtres ou ajoutez un nouveau client</p>
          </div>
        )}
      </div>

      {/* ─── ADD CLIENT MODAL ────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-elevated overflow-hidden animate-scale-in border border-slate-200 dark:border-slate-800">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Nouveau Client
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className={labelClass}>Type de Contact</label>
                <select
                  value={newClient.type}
                  onChange={(e) => setNewClient({ ...newClient, type: e.target.value as ClientType })}
                  className={inputClass}
                >
                  <option value="PARTICULIER">Particulier (Client)</option>
                  <option value="ENTREPRISE">Entreprise (Client)</option>
                  <option value="SCI">SCI (Société Civile Immobilière)</option>
                  <option value="BAILLEUR">Bailleur Social / Privé</option>
                  <option value="ARCHITECTE">Architecte (Apporteur)</option>
                  <option value="SYNDIC">Syndic de Copro</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Nom Complet / Raison Sociale</label>
                <input
                  required
                  type="text"
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({ ...newClient, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Téléphone</label>
                  <input
                    type="tel"
                    value={newClient.phone}
                    onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Adresse</label>
                <AddressAutocomplete
                  value={newClient.address}
                  onChange={(val) => setNewClient({ ...newClient, address: val })}
                  onSelect={handleAddressSelect}
                  placeholder="Saisir une adresse..."
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1">
                  <label className={labelClass}>Code Postal</label>
                  <input
                    type="text"
                    value={newClient.zipCode}
                    onChange={(e) => setNewClient({ ...newClient, zipCode: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Ville</label>
                  <input
                    type="text"
                    value={newClient.city}
                    onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {duplicateWarning && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-200">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}

              <div className="flex justify-end pt-4 space-x-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-sm font-medium transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-semibold shadow-sm transition-colors"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CLIENT DETAIL MODAL ─────────────────────────── */}
      {selectedClient && (
        <ClientDetailModal
          client={selectedClient}
          projects={projects}
          isOpen={!!selectedClient}
          onClose={() => setSelectedClient(null)}
          onDelete={() => {
            onDeleteClient(selectedClient);
            setSelectedClient(null);
          }}
          onUpdate={(updated) => {
            if (onUpdateClient) onUpdateClient(updated);
            setSelectedClient(updated);
          }}
          onProjectClick={(p) => {
            if (onNavigateToProject) {
              setSelectedClient(null);
              onNavigateToProject(p);
            }
          }}
          onCreateProject={(c) => {
            if (onCreateProject) {
              onCreateProject(c);
              setSelectedClient(null);
            }
          }}
          onBulkAdd={(projs) => {
            if (onBulkAddProjects) {
              onBulkAddProjects(projs);
            }
          }}
        />
      )}
    </div>
  );
};

export default React.memo(ClientsPage);
