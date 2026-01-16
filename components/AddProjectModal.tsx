import React, { useState, useEffect } from 'react';
import { validate, ProjectSchema } from '../utils/validation';
import ErrorHandler, { ErrorType } from '../services/errorService';
import {
  X,
  Mail,
  Phone,
  Calendar,
  Hash,
  User,
  MapPin,
  Briefcase,
  Sparkles,
  Wand2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building,
} from 'lucide-react';
import { Project, ProjectStatus, ContactMethod, Client, Appointment } from '../types';
import { extractProjectDetails } from '../services/geminiService';
import AddressAutocomplete from './AddressAutocomplete';

interface AddProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (project: Project) => void;
  initialClient?: Client | null;
  clients?: Client[];
  projects?: Project[];
}

const AddProjectModal: React.FC<AddProjectModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  initialClient,
  clients = [],
  projects = [],
}) => {
  // Autocomplete State
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // AI Magic State
  const [showMagicInput, setShowMagicInput] = useState(false);
  const [magicText, setMagicText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Form State
  const [formData, setFormData] = useState<{
    businessCode: string;
    title: string;
    description: string;
    clientName: string;
    clientEmail: string;
    clientPhone: string;
    clientAddress: string; // HQ / Billing Address
    siteAddress: string; // Construction Site Address
    siteLat?: number;
    siteLng?: number;
    budget: string;
    vatRate: string; // "0", "10", "20"
    priority: 'Haute' | 'Moyenne' | 'Basse';
    contactMethod: ContactMethod;
    folderType: string;
    startDate: string;
    tagInput: string;
  }>({
    businessCode: '',
    title: '',
    description: '',
    clientName: '',
    clientEmail: '',
    clientPhone: '',
    clientAddress: '',
    siteAddress: '',
    budget: '',
    vatRate: '10', // Default VAT
    priority: 'Moyenne',
    contactMethod: ContactMethod.PHONE,
    folderType: 'Particulier',
    startDate: new Date().toISOString().split('T')[0],
    tagInput: '',
  });

  // Generate Business Code on Open
  useEffect(() => {
    if (isOpen) {
      const generateCode = () => {
        const now = new Date();
        const year = now.getFullYear().toString().slice(-2);
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        // Simple global sequence based on total count
        const sequence = (projects.length + 1).toString().padStart(3, '0');
        return `D-${year}${month}-${sequence}`;
      };

      setFormData((prev) => ({ ...prev, businessCode: generateCode() }));

      if (initialClient) {
        setFormData((prev) => ({
          ...prev,
          clientName: initialClient.name,
          clientEmail: initialClient.email,
          clientPhone: initialClient.phone,
          clientAddress: initialClient.address,
        }));
        // Auto-set folder type based on client type if possible
        if (initialClient.type === 'SOUS_TRAITANT') {
          setFormData((prev) => ({ ...prev, folderType: 'Sous-traitance', vatRate: '0' }));
        } else if (initialClient.type === 'PARTENAIRE') {
          setFormData((prev) => ({ ...prev, folderType: 'Partenaire', vatRate: '0' }));
        } else if (initialClient.type === 'ENTREPRISE' || initialClient.type === 'ARCHITECTE') {
          setFormData((prev) => ({ ...prev, folderType: 'Entreprise' }));
        }
      }
    }
  }, [isOpen, initialClient, projects.length]);

  // Auto-detect Homelife for VAT 0 (Specific Business Rule)
  useEffect(() => {
    const nameUpper = formData.clientName.toUpperCase();
    if (
      (nameUpper.includes('HOMELIFE') || nameUpper.includes('HOME LIFE')) &&
      formData.vatRate !== '0'
    ) {
      setFormData((prev) => ({ ...prev, vatRate: '0' }));
    }
  }, [formData.clientName, formData.vatRate]);

  if (!isOpen) return null;

  const handleClientNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFormData((prev) => ({ ...prev, clientName: val }));

    if (val.length > 1) {
      const matches = clients.filter((c) => c.name.toLowerCase().includes(val.toLowerCase()));
      setFilteredClients(matches);
      setShowSuggestions(matches.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectClient = (client: Client) => {
    setFormData((prev) => ({
      ...prev,
      clientName: client.name,
      clientEmail: client.email || prev.clientEmail,
      clientPhone: client.phone || prev.clientPhone,
      clientAddress: client.address || prev.clientAddress,
      // We don't overwrite siteAddress automatically unless it's empty, to allow different sites for same client
      siteAddress: prev.siteAddress || '',
    }));

    // Auto-set folder type and VAT
    if (client.type === 'SOUS_TRAITANT') {
      setFormData((prev) => ({ ...prev, folderType: 'Sous-traitance', vatRate: '0' }));
    } else if (client.type === 'PARTENAIRE') {
      setFormData((prev) => ({ ...prev, folderType: 'Partenaire', vatRate: '0' }));
    } else if (client.type === 'ENTREPRISE' || client.type === 'ARCHITECTE') {
      setFormData((prev) => ({ ...prev, folderType: 'Entreprise' }));
    }

    setShowSuggestions(false);
  };

  const handleMagicAnalysis = async () => {
    if (!magicText.trim()) return;
    setIsAnalyzing(true);

    try {
      const result = await extractProjectDetails(magicText);

      setFormData((prev) => ({
        ...prev,
        title: result.projectTitle || prev.title,
        description: result.projectDescription || prev.description,
        clientName: result.clientName || prev.clientName,
        clientEmail: result.clientEmail || prev.clientEmail,
        clientPhone: result.clientPhone || prev.clientPhone,
        // AI usually extracts the site address from the prompt
        siteAddress: result.clientAddress || prev.siteAddress,
        // If we don't have a client address yet, assume it's the same for now, user can edit
        clientAddress: prev.clientAddress || result.clientAddress,
        budget: result.estimatedBudget ? result.estimatedBudget.toString() : prev.budget,
        priority: result.priority || prev.priority,
        contactMethod: result.contactMethod || prev.contactMethod,
      }));

      setShowMagicInput(false);
      setMagicText('');
    } catch (error) {
      console.error('AI Error', error);
      alert("L'analyse IA a échoué. Veuillez remplir manuellement.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const initialAppointments: Appointment[] = [];

    // Parse tags from simple comma string if user typed some
    const tags = formData.tagInput
      ? formData.tagInput
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : [];

    const newProject: Project = {
      id: Date.now().toString(),
      businessCode: formData.businessCode,
      title: formData.title,
      description: formData.description,
      status: ProjectStatus.NEW,
      contactMethod: formData.contactMethod,
      createdAt: Date.now(),
      priority: formData.priority,
      folderType: formData.folderType,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
      vatRate: formData.vatRate ? parseFloat(formData.vatRate) : 10,
      startDate: formData.startDate,
      siteAddress: formData.siteAddress, // NEW: Specific site address
      lat: formData.siteLat, // Geocoded Latitude
      lng: formData.siteLng, // Geocoded Longitude
      tags: tags,
      client: {
        name: formData.clientName,
        email: formData.clientEmail,
        phone: formData.clientPhone,
        address: formData.clientAddress, // HQ / Billing Address
      },
      appointments: initialAppointments,
      needsCallback: false,
    };

    // OPTIMIZATION: Validate with Zod before submitting
    const validation = validate(ProjectSchema, newProject);
    if (!validation.success) {
      ErrorHandler.handleAndShow(
        { message: validation.errors.join('\n'), type: ErrorType.VALIDATION },
        'AddProjectModal'
      );
      return;
    }

    onAdd(newProject);
    resetForm();
    onClose();
  };

  const resetForm = () => {
    setFormData((prev) => ({
      ...prev,
      title: '',
      description: '',
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      siteAddress: '',
      siteLat: undefined,
      siteLng: undefined,
      budget: '',
      vatRate: '10',
      priority: 'Moyenne',
      contactMethod: ContactMethod.PHONE,
      folderType: 'Particulier',
      startDate: new Date().toISOString().split('T')[0],
      tagInput: '',
    }));
    setShowSuggestions(false);
    setMagicText('');
    setShowMagicInput(false);
  };

  // Optimized for Mobile and Dark Mode - HIGH CONTRAST
  const inputClass =
    'w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all text-base md:text-sm text-slate-900 dark:text-white placeholder-slate-400';
  const labelClass =
    'block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1 ml-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-900 z-20">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
              Nouveau Dossier
            </h2>
            <div className="flex items-center space-x-2 text-sm mt-1">
              <span className="text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">
                Référence:
              </span>
              <span className="font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded border border-emerald-100 dark:border-emerald-800">
                {formData.businessCode}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:hover:text-slate-200 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* AI MAGIC SECTION */}
        <div className="px-6 pt-6 pb-2">
          <button
            onClick={() => setShowMagicInput(!showMagicInput)}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all duration-300 ${showMagicInput ? 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800' : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white dark:text-white shadow-lg'}`}
          >
            <div className="flex items-center font-bold">
              <Sparkles
                size={20}
                className={`mr-2 ${showMagicInput ? 'text-indigo-600' : 'text-slate-900 dark:text-white dark:text-white'}`}
              />
              <span
                className={
                  showMagicInput
                    ? 'text-indigo-900 dark:text-indigo-200'
                    : 'text-slate-900 dark:text-white dark:text-white'
                }
              >
                Remplissage Magique IA
              </span>
            </div>
            {showMagicInput ? (
              <ChevronUp size={20} className="text-indigo-400" />
            ) : (
              <ChevronDown size={20} className="text-slate-900 dark:text-white dark:text-white" />
            )}
          </button>

          {showMagicInput && (
            <div className="mt-3 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800 animate-in slide-in-from-top-2">
              <p className="text-xs text-indigo-700 dark:text-indigo-300 mb-2 font-medium">
                Collez ici un email, un SMS ou vos notes en vrac. L'IA va remplir le formulaire pour
                vous.
              </p>
              <textarea
                value={magicText}
                onChange={(e) => setMagicText(e.target.value)}
                placeholder="Ex: M. Dupont (06 12 34 56 78) veut refaire sa salle de bain au 10 rue des Lilas. Budget 5000€ environ..."
                className="w-full p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 dark:text-white dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none h-24 mb-3"
              />
              <button
                onClick={handleMagicAnalysis}
                disabled={isAnalyzing || !magicText.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" /> Analyse en cours...
                  </>
                ) : (
                  <>
                    <Wand2 size={18} className="mr-2" /> Analyser et Remplir
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8 pt-2">
          {/* SECTION 1: CLIENT (BILLING/HQ) */}
          <div className="bg-slate-50/80 dark:bg-slate-800/30 p-5 rounded-xl border border-slate-200/60 dark:border-slate-600/50">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center mb-4 text-sm">
              <div className="bg-indigo-100 dark:bg-indigo-900/50 p-1.5 rounded-lg mr-2">
                <User size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              CLIENT / DONNEUR D'ORDRE (FACTURATION)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="relative col-span-1 md:col-span-2">
                <label className={labelClass}>Nom Complet / Raison Sociale</label>
                <input
                  type="text"
                  required
                  value={formData.clientName}
                  onChange={handleClientNameChange}
                  className={`${inputClass} font-bold`}
                  placeholder="Rechercher ou saisir..."
                  autoComplete="off"
                />
                {/* Autocomplete Dropdown */}
                {showSuggestions && (
                  <div className="absolute z-50 left-0 w-full mt-1 bg-white dark:bg-slate-900 dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                    {filteredClients.map((client, idx) => (
                      <div
                        key={idx}
                        onClick={() => selectClient(client)}
                        className="px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-600 cursor-pointer text-sm text-slate-700 dark:text-slate-200 dark:text-white flex flex-col border-b border-slate-100 dark:border-slate-600 last:border-0"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold">{client.name}</span>
                          {client.type && (
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-500 px-1 rounded uppercase">
                              {client.type}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">
                          {client.email} • {client.city}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail
                    size={16}
                    className="absolute left-3 top-3 text-slate-700 dark:text-slate-200 dark:text-white"
                  />
                  <input
                    type="email"
                    value={formData.clientEmail}
                    onChange={(e) => setFormData({ ...formData, clientEmail: e.target.value })}
                    className={`${inputClass} pl-9`}
                    placeholder="client@email.com"
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Téléphone</label>
                <div className="relative">
                  <Phone
                    size={16}
                    className="absolute left-3 top-3 text-slate-700 dark:text-slate-200 dark:text-white"
                  />
                  <input
                    type="text"
                    value={formData.clientPhone}
                    onChange={(e) => setFormData({ ...formData, clientPhone: e.target.value })}
                    className={`${inputClass} pl-9`}
                    placeholder="06..."
                  />
                </div>
              </div>

              <div className="col-span-1 md:col-span-2">
                <label className={labelClass}>Adresse Siège / Facturation</label>
                <AddressAutocomplete
                  value={formData.clientAddress}
                  onChange={(val) => setFormData({ ...formData, clientAddress: val })}
                  className={`${inputClass} pl-9`}
                  placeholder="Adresse principale du client/entreprise"
                />
                <p className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white mt-1 ml-1">
                  Adresse utilisée pour la facturation.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: PROJECT & SITE ADDRESS */}
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center mb-4 text-sm px-1">
              <div className="bg-emerald-100 dark:bg-emerald-900/50 p-1.5 rounded-lg mr-2">
                <Briefcase size={16} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              CHANTIER & DÉTAILS
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
              <div className="col-span-1 md:col-span-2">
                <label className={labelClass}>Titre du Dossier</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className={`${inputClass} font-bold`}
                  placeholder="Ex: Rénovation Salle de Bain"
                />
              </div>

              {/* PROJECT SITE ADDRESS - Distinct from Client HQ */}
              <div className="col-span-1 md:col-span-2">
                <label className={labelClass}>Adresse du Chantier (Lieu des travaux)</label>
                <AddressAutocomplete
                  value={formData.siteAddress}
                  onChange={(val) => setFormData({ ...formData, siteAddress: val })}
                  onSelect={(result) =>
                    setFormData((prev) => ({
                      ...prev,
                      siteAddress: result.fullAddress,
                      siteLat: result.lat,
                      siteLng: result.lng,
                    }))
                  }
                  className={`${inputClass} pl-9 bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800`}
                  placeholder="Adresse où les travaux seront effectués"
                />
                <p className="text-[10px] text-emerald-600/70 mt-1 ml-1 font-medium">
                  Laissez vide si identique à l'adresse de facturation.
                </p>
              </div>

              <div>
                <label className={labelClass}>Type de Dossier</label>
                <select
                  value={formData.folderType}
                  onChange={(e) => setFormData({ ...formData, folderType: e.target.value })}
                  className={inputClass}
                >
                  <option value="Particulier">Particulier</option>
                  <option value="Entreprise">Entreprise</option>
                  <option value="Sous-traitance">Sous-traitance</option>
                  <option value="Partenaire">Partenaire</option>
                  <option value="Sinistre">Sinistre</option>
                  <option value="Copropriété">Copropriété</option>
                  <option value="Bailleur">Bailleur</option>
                  <option value="Architecte">Architecte</option>
                  <option value="SAV">SAV</option>
                </select>
              </div>

              <div>
                <label className={labelClass}>Budget Estimé (€)</label>
                <input
                  type="number"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>

              <div className="md:col-span-2 grid grid-cols-2 gap-4">
                {/* Date de début prominently displayed */}
                <div className="bg-blue-50 dark:bg-blue-900/20 p-1 rounded-lg border border-blue-100 dark:border-blue-800 relative">
                  <label className="absolute -top-2 left-2 px-1 bg-white dark:bg-slate-900 text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase rounded">
                    Début Envisagé
                  </label>
                  <div className="relative">
                    <Calendar
                      size={16}
                      className="absolute left-3 top-3 text-blue-600 dark:text-blue-400"
                    />
                    <input
                      type="date"
                      value={formData.startDate}
                      onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                      className="w-full pl-9 p-2 bg-transparent border-0 focus:ring-0 text-blue-900 dark:text-blue-100 font-bold outline-none h-10"
                    />
                  </div>
                </div>

                {/* VAT RATE SELECTOR */}
                <div className="bg-slate-50 dark:bg-slate-900/20 p-1 rounded-lg border border-slate-200 dark:border-slate-800 relative">
                  <label className="absolute -top-2 left-2 px-1 bg-white dark:bg-slate-900 text-[10px] font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase rounded">
                    TVA & Régime
                  </label>
                  <select
                    value={formData.vatRate}
                    onChange={(e) => setFormData({ ...formData, vatRate: e.target.value })}
                    className="w-full p-2 bg-transparent border-0 focus:ring-0 text-slate-800 dark:text-slate-100 dark:text-white dark:text-white font-bold outline-none h-10 text-sm"
                  >
                    <option value="20">TVA 20% (Standard)</option>
                    <option value="10">TVA 10% (Rénovation)</option>
                    <option value="0">TVA 0% (Autoliquidation)</option>
                  </select>
                </div>
              </div>

              {/* Tags Field */}
              <div className="col-span-1 md:col-span-2">
                <label className={labelClass}>Tags (Séparés par des virgules)</label>
                <input
                  type="text"
                  value={formData.tagInput}
                  onChange={(e) => setFormData({ ...formData, tagInput: e.target.value })}
                  className={inputClass}
                  placeholder="Ex: Plomberie, Urgent, Cuisine..."
                />
              </div>

              <div className="hidden">
                {/* Hidden field for logic if needed later */}
                <input type="text" readOnly value={formData.businessCode} />
              </div>
            </div>

            <div>
              <label className={labelClass}>Description / Notes</label>
              <textarea
                required
                rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={`${inputClass} resize-none`}
                placeholder="Détails de la demande..."
              />
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:hover:text-slate-200 font-medium px-6 py-3 mr-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="bg-slate-900 dark:bg-slate-800 hover:bg-emerald-600 dark:hover:bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-slate-200 dark:shadow-none transition-all hover:scale-105 flex items-center"
            >
              Créer le Dossier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProjectModal;
