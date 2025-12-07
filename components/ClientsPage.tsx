

import React, { useState } from 'react';
import { Search, Plus, Trash2, Mail, Phone, MapPin, User, Edit, Briefcase, Users, Handshake } from 'lucide-react';
import { Client, Project, ClientType } from '../types';
import ClientDetailModal from './ClientDetailModal';

interface ClientsPageProps {
    clients: Client[];
    // We need projects to show history in the client card
    projects?: Project[];
    onAddClient: (client: Client) => void;
    onDeleteClient: (client: Client) => void;
    onUpdateClient?: (client: Client) => void;
    // Callback to open a project from the client detail view
    onNavigateToProject?: (project: Project) => void;
    onCreateProject?: (client: Client) => void;
    // NEW: Bulk Add Callback
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
    onBulkAddProjects
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);

    // Filter Tabs: 'ALL' | 'CLIENTS'
    const [activeTab, setActiveTab] = useState<'ALL' | 'CLIENTS'>('ALL');

    const [newClient, setNewClient] = useState<Client>({
        name: '',
        email: '',
        phone: '',
        address: '',
        zipCode: '',
        city: '',
        type: 'PARTICULIER'
    });

    const filteredClients = clients.filter(c => {
        const matchesSearch =
            c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.city?.toLowerCase().includes(searchQuery.toLowerCase());

        if (!matchesSearch) return false;

        // Filter out Partners/Subcontractors from this main list as requested
        // They are now in PartnersPage
        const isPartner = c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT';
        if (isPartner) return false;

        if (activeTab === 'CLIENTS') {
            return !c.type || ['PARTICULIER', 'ENTREPRISE', 'SYNDIC', 'ARCHITECTE'].includes(c.type);
        }

        return true;
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddClient(newClient);
        setIsModalOpen(false);
        setNewClient({ name: '', email: '', phone: '', address: '', zipCode: '', city: '', type: 'PARTICULIER' });
    };

    const getTypeLabel = (type?: ClientType) => {
        switch (type) {
            case 'PARTICULIER': return { label: 'Particulier', class: 'bg-emerald-100 text-emerald-700' };
            case 'ENTREPRISE': return { label: 'Entreprise', class: 'bg-blue-100 text-blue-700' };
            case 'ARCHITECTE': return { label: 'Architecte', class: 'bg-indigo-100 text-indigo-700' };
            case 'SYNDIC': return { label: 'Syndic', class: 'bg-purple-100 text-purple-700' };
            default: return { label: 'Particulier', class: 'bg-slate-100 text-slate-700 dark:text-slate-200' };
        }
    };

    const inputClass = "w-full p-2.5 bg-white dark:bg-slate-900 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white dark:text-white placeholder-slate-400";
    const labelClass = "block text-xs font-semibold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white uppercase mb-1";

    return (
        <div className="space-y-6 animate-fade-in relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Base Clients</h2>
                <div className="flex space-x-3 w-full md:w-auto">
                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200 dark:text-white" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm dark:text-white dark:text-white"
                        />
                    </div>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors text-sm whitespace-nowrap"
                    >
                        <Plus size={18} className="mr-2" />
                        Ajouter
                    </button>
                </div>
            </div>

            {/* TAB SWITCHER */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-fit">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'ALL' ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-emerald-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:text-white dark:text-white'}`}
                >
                    Tous
                </button>
                <button
                    onClick={() => setActiveTab('CLIENTS')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${activeTab === 'CLIENTS' ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-emerald-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:text-white dark:text-white'}`}
                >
                    <Users size={16} className="mr-2" /> Clients
                </button>
            </div>

            {/* Clients List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredClients.length > 0 ? (
                    filteredClients.map((client, index) => {
                        const typeStyle = getTypeLabel(client.type);
                        return (
                            <div key={index} onClick={() => setSelectedClient(client)} className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow group relative cursor-pointer">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center space-x-3">
                                        <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg bg-emerald-100 text-emerald-700`}>
                                            {client.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white leading-tight">{client.name}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase mt-1 inline-block ${typeStyle.class}`}>
                                                {typeStyle.label}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3 text-sm">
                                    <div className="flex items-center text-slate-700 dark:text-slate-200 dark:text-white">
                                        <Mail size={16} className="mr-3 text-slate-700 dark:text-slate-200 dark:text-white" />
                                        <span className="truncate">{client.email || "Non renseigné"}</span>
                                    </div>
                                    <div className="flex items-center text-slate-700 dark:text-slate-200 dark:text-white">
                                        <Phone size={16} className="mr-3 text-slate-700 dark:text-slate-200 dark:text-white" />
                                        <span>{client.phone || "Non renseigné"}</span>
                                    </div>
                                    <div className="flex items-start text-slate-700 dark:text-slate-200 dark:text-white">
                                        <MapPin size={16} className="mr-3 text-slate-700 dark:text-slate-200 dark:text-white mt-0.5" />
                                        <span className="line-clamp-2">
                                            {client.address}
                                            {client.zipCode || client.city ? `, ${client.zipCode} ${client.city}` : ''}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="col-span-full flex flex-col items-center justify-center h-64 text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                        <User size={48} className="mb-4 opacity-50" />
                        <p>Aucun contact trouvé dans cette catégorie</p>
                    </div>
                )}
            </div>

            {/* Add Client Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">Nouveau Contact</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200">
                                <span className="text-2xl">&times;</span>
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className={labelClass}>Type de Contact</label>
                                <select
                                    value={newClient.type}
                                    onChange={e => setNewClient({ ...newClient, type: e.target.value as ClientType })}
                                    className={inputClass}
                                >
                                    <option value="PARTICULIER">Particulier (Client)</option>
                                    <option value="ENTREPRISE">Entreprise (Client)</option>
                                    <option value="ARCHITECTE">Architecte (Apporteur)</option>
                                    <option value="SYNDIC">Syndic de Copro</option>
                                </select>
                            </div>

                            <div>
                                <label className={labelClass}>Nom Complet / Raison Sociale</label>
                                <input required type="text" value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} className={inputClass} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Email</label>
                                    <input type="email" value={newClient.email} onChange={e => setNewClient({ ...newClient, email: e.target.value })} className={inputClass} />
                                </div>
                                <div>
                                    <label className={labelClass}>Téléphone</label>
                                    <input type="tel" value={newClient.phone} onChange={e => setNewClient({ ...newClient, phone: e.target.value })} className={inputClass} />
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Adresse</label>
                                <input type="text" value={newClient.address} onChange={e => setNewClient({ ...newClient, address: e.target.value })} className={inputClass} />
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="col-span-1">
                                    <label className={labelClass}>Code Postal</label>
                                    <input type="text" value={newClient.zipCode} onChange={e => setNewClient({ ...newClient, zipCode: e.target.value })} className={inputClass} />
                                </div>
                                <div className="col-span-2">
                                    <label className={labelClass}>Ville</label>
                                    <input type="text" value={newClient.city} onChange={e => setNewClient({ ...newClient, city: e.target.value })} className={inputClass} />
                                </div>
                            </div>

                            <div className="flex justify-end pt-4 space-x-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-700 dark:text-slate-200 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">Annuler</button>
                                <button type="submit" className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-medium shadow-lg shadow-emerald-200 dark:shadow-none">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Client Detail Modal */}
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
                            setSelectedClient(null); // Close modal
                        }
                    }}
                    onBulkAdd={(projs) => {
                        if (onBulkAddProjects) {
                            onBulkAddProjects(projs);
                            // We keep the modal open to show the new projects in history
                        }
                    }}
                />
            )}
        </div>
    );
};

export default ClientsPage;