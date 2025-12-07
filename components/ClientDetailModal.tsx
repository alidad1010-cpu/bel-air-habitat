
import React, { useState, useEffect, useRef } from 'react';
import { X, MapPin, Phone, Mail, User, Clock, Briefcase, Trash2, Plus, Edit, Save, FileText, Upload, Loader2, ExternalLink, StickyNote, Key, Shield, Tag, FileSpreadsheet, Wand2 } from 'lucide-react';
import { Client, Project, ProjectStatus, ClientDocument, ClientType, ContactMethod } from '../types';
import { uploadFileToCloud } from '../services/firebaseService';
import { parseProjectList, BulkProjectData } from '../services/geminiService';
import AddressAutocomplete from './AddressAutocomplete';

interface ClientDetailModalProps {
  client: Client;
  projects: Project[];
  isOpen: boolean;
  onClose: () => void;
  onDelete: () => void;
  onUpdate?: (client: Client) => void;
  onProjectClick: (project: Project) => void;
  onCreateProject?: (client: Client) => void;
  onBulkAdd?: (projects: Project[]) => void;
}

const ClientDetailModal: React.FC<ClientDetailModalProps> = ({ 
    client, 
    projects, 
    isOpen, 
    onClose, 
    onDelete, 
    onUpdate, 
    onProjectClick, 
    onCreateProject,
    onBulkAdd 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'INFO' | 'DOCS'>('INFO');
  const [formData, setFormData] = useState<Client>(client);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // BULK IMPORT STATE
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [isAnalyzingBulk, setIsAnalyzingBulk] = useState(false);
  const [parsedProjects, setParsedProjects] = useState<BulkProjectData[]>([]);

  useEffect(() => {
      setFormData(client);
  }, [client]);

  if (!isOpen) return null;

  // Filter projects belonging to this client
  const clientProjects = projects.filter(p => 
      (p.client.email && p.client.email.toLowerCase() === client.email.toLowerCase()) ||
      (p.client.name.toLowerCase() === client.name.toLowerCase()) ||
      (client.id && p.client.id === client.id)
  ).sort((a, b) => b.createdAt - a.createdAt);

  const getStatusColor = (status: ProjectStatus) => {
      switch(status) {
          case ProjectStatus.NEW: return 'bg-sky-100 text-sky-700';
          case ProjectStatus.IN_PROGRESS: return 'bg-emerald-100 text-emerald-700';
          case ProjectStatus.COMPLETED: return 'bg-slate-200 text-slate-700 dark:text-slate-200';
          case ProjectStatus.VALIDATED: return 'bg-violet-100 text-violet-700';
          case ProjectStatus.WAITING_VALIDATION: return 'bg-yellow-100 text-yellow-700';
          default: return 'bg-gray-100 text-gray-700 dark:text-gray-200';
      }
  };

  const handleSave = () => {
      if (onUpdate) onUpdate(formData);
      setIsEditing(false);
  }
  
  const handleClose = () => {
      if (isEditing) {
          if (window.confirm("Vous avez des modifications non enregistrées. Voulez-vous fermer sans sauvegarder ?")) {
              setIsEditing(false);
              onClose();
          }
      } else {
          onClose();
      }
  }

  // Helper to convert file to Base64 (Fallback)
  const fileToBase64 = (file: File): Promise<string> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(file);
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = error => reject(error);
      });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setIsUploading(true);
      try {
          const clientId = formData.id || 'temp_' + Date.now();
          const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const path = `clients/${clientId}/documents/${Date.now()}_${safeName}`;
          
          let url;
          try {
             url = await uploadFileToCloud(path, file);
          } catch(e) {
             console.warn("Cloud upload failed, fallback to local base64");
             if (file.size > 2 * 1024 * 1024) throw new Error("Fichier trop lourd pour sauvegarde locale (Max 2Mo)");
             url = await fileToBase64(file);
          }

          const newDoc: ClientDocument = {
              id: Date.now().toString(),
              name: file.name,
              type: file.type.includes('pdf') ? 'PDF' : 'IMAGE',
              date: new Date().toISOString(),
              url: url
          };

          const updatedClient = {
              ...formData,
              documents: [...(formData.documents || []), newDoc]
          };
          
          setFormData(updatedClient);
          if (onUpdate) onUpdate(updatedClient);

      } catch (error: any) {
          console.error("Upload failed", error);
          alert(`Erreur: ${error.message}`);
      } finally {
          setIsUploading(false);
          if(e.target) e.target.value = '';
      }
  };

  const deleteDocument = (docId: string) => {
      if(confirm("Supprimer ce document ?")) {
          const updatedClient = {
              ...formData,
              documents: formData.documents?.filter(d => d.id !== docId)
          };
          setFormData(updatedClient);
          if (onUpdate) onUpdate(updatedClient);
      }
  };

  const updateAccessCode = (field: string, value: string) => {
      setFormData({
          ...formData,
          accessCodes: {
              ...formData.accessCodes,
              [field]: value
          }
      });
  };

  const getTypeLabel = (type?: ClientType) => {
    switch(type) {
        case 'PARTICULIER': return 'Particulier';
        case 'ENTREPRISE': return 'Entreprise';
        case 'ARCHITECTE': return 'Architecte';
        case 'SYNDIC': return 'Syndic';
        case 'SOUS_TRAITANT': return 'Sous-Traitant';
        case 'PARTENAIRE': return 'Partenaire';
        default: return 'Particulier';
    }
  };

  // --- BULK IMPORT LOGIC ---
  
  const analyzeBulkText = async () => {
      if (!bulkText.trim()) return;
      setIsAnalyzingBulk(true);
      try {
          const result = await parseProjectList(bulkText);
          setParsedProjects(result);
      } catch (error) {
          alert("Erreur d'analyse IA. Vérifiez votre texte.");
      } finally {
          setIsAnalyzingBulk(false);
      }
  };

  const confirmBulkImport = () => {
      if (onBulkAdd) {
          const newProjects: Project[] = parsedProjects.map(p => ({
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              businessCode: p.businessCode || `IMP-${Date.now()}`,
              title: `${p.projectType || 'Projet'} - ${p.endCustomerName || 'Client Inconnu'}`,
              description: `Client Final: ${p.endCustomerName}\nDetails: ${p.description || ''}\nTél Contact: ${p.phone || ''}`,
              status: ProjectStatus.NEW,
              contactMethod: ContactMethod.PHONE,
              createdAt: Date.now(),
              priority: 'Moyenne',
              folderType: client.type === 'ENTREPRISE' ? 'Sous-traitance' : 'Particulier',
              budget: p.budget || 0,
              startDate: p.startDate,
              endDate: p.endDate,
              siteAddress: p.siteAddress,
              client: {
                  name: client.name, // The main client (e.g., Home Life)
                  email: client.email,
                  phone: client.phone,
                  address: client.address
              },
              needsCallback: false
          }));
          
          onBulkAdd(newProjects);
          setShowBulkImport(false);
          setBulkText('');
          setParsedProjects([]);
      }
  };

  const inputClass = "w-full p-2 text-sm bg-white dark:bg-slate-900 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-100 dark:text-white dark:text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
            <div className="flex items-center space-x-4">
                <div className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-xl shadow-lg shrink-0 ${['SOUS_TRAITANT', 'PARTENAIRE'].includes(formData.type || '') ? 'bg-cyan-600 text-white' : 'bg-emerald-600 text-white'}`}>
                    {client.name.charAt(0).toUpperCase()}
                </div>
                <div>
                    {isEditing ? (
                        <div className="space-y-2">
                             <input 
                                type="text" 
                                value={formData.name} 
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white bg-slate-100 dark:bg-slate-800 border-b-2 border-emerald-500 outline-none px-2 w-full"
                            />
                            <select 
                                value={formData.type || 'PARTICULIER'} 
                                onChange={e => setFormData({...formData, type: e.target.value as ClientType})} 
                                className="text-sm p-1 bg-slate-100 dark:bg-slate-800 rounded border border-slate-300 dark:border-slate-600"
                            >
                                <option value="PARTICULIER">Particulier</option>
                                <option value="ENTREPRISE">Entreprise</option>
                                <option value="ARCHITECTE">Architecte</option>
                                <option value="SYNDIC">Syndic</option>
                                <option value="SOUS_TRAITANT">Sous-Traitant</option>
                                <option value="PARTENAIRE">Partenaire</option>
                            </select>
                        </div>
                    ) : (
                        <>
                             <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{client.name}</h2>
                             <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-200 dark:text-white uppercase">
                                {getTypeLabel(formData.type)}
                             </span>
                        </>
                    )}
                </div>
            </div>
            <div className="flex items-center space-x-2">
                {!isEditing ? (
                    <button 
                        onClick={() => setIsEditing(true)}
                        className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-full transition-colors"
                        title="Éditer la fiche"
                    >
                        <Edit size={20} />
                    </button>
                ) : (
                    <button 
                        onClick={handleSave}
                        className="flex items-center px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-sm"
                    >
                        <Save size={16} className="mr-1"/> Enregistrer
                    </button>
                )}
                <button 
                    onClick={onDelete}
                    className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
                    title="Supprimer le client"
                >
                    <Trash2 size={20} />
                </button>
                <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2"></div>
                <button onClick={handleClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <X size={24} className="text-slate-700 dark:text-slate-200 dark:text-white" />
                </button>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 px-6 space-x-6 shrink-0">
            <button 
                onClick={() => setActiveTab('INFO')} 
                className={`py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'INFO' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200'}`}
            >
                Informations & Projets
            </button>
            <button 
                onClick={() => setActiveTab('DOCS')} 
                className={`py-3 text-sm font-bold border-b-2 transition-colors flex items-center ${activeTab === 'DOCS' ? 'border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-transparent text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200'}`}
            >
                Documents & Notes
                <span className="ml-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    {(formData.documents?.length || 0)}
                </span>
            </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900/50 p-6 relative">
            
            {/* BULK IMPORT OVERLAY */}
            {showBulkImport && (
                <div className="absolute inset-0 z-10 bg-white dark:bg-slate-900 p-6 animate-in slide-in-from-bottom-10 overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-lg flex items-center">
                            <FileSpreadsheet size={20} className="mr-2 text-indigo-600"/> Import de Masse (IA)
                        </h3>
                        <button onClick={() => setShowBulkImport(false)} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500"><X/></button>
                    </div>

                    {!parsedProjects.length ? (
                        <>
                            <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white mb-2">Copiez-collez vos lignes Excel/CSV ici. L'IA va structurer les données automatiquement.</p>
                            <textarea 
                                value={bulkText}
                                onChange={e => setBulkText(e.target.value)}
                                className="w-full h-64 p-3 border rounded-xl bg-slate-50 dark:bg-slate-900 font-mono text-xs mb-4"
                                placeholder={`Date Début | Affaire | Client Final | Adresse | Budget | Tel...\n2024-03-01 | CH-99 | Mme Dupont | 12 Rue Paix | 5000 | 06...\n...`}
                            />
                            <button 
                                onClick={analyzeBulkText} 
                                disabled={isAnalyzingBulk || !bulkText}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center disabled:opacity-50"
                            >
                                {isAnalyzingBulk ? <Loader2 className="animate-spin mr-2"/> : <Wand2 className="mr-2"/>}
                                Analyser et Structurer
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="mb-4 overflow-x-auto">
                                <table className="w-full text-xs text-left border-collapse">
                                    <thead className="bg-slate-100 dark:bg-slate-800 uppercase font-bold text-slate-700 dark:text-slate-200 dark:text-white">
                                        <tr>
                                            <th className="p-2 border">Code</th>
                                            <th className="p-2 border">Client Final</th>
                                            <th className="p-2 border">Adresse</th>
                                            <th className="p-2 border">Budget</th>
                                            <th className="p-2 border">Début</th>
                                            <th className="p-2 border">Fin</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedProjects.map((p, idx) => (
                                            <tr key={idx} className="border-b dark:border-slate-800">
                                                <td className="p-2 border dark:border-slate-800 font-mono">{p.businessCode}</td>
                                                <td className="p-2 border dark:border-slate-800 font-bold">{p.endCustomerName}</td>
                                                <td className="p-2 border dark:border-slate-800 truncate max-w-[150px]">{p.siteAddress}</td>
                                                <td className="p-2 border dark:border-slate-800">{p.budget}€</td>
                                                <td className="p-2 border dark:border-slate-800">{p.startDate}</td>
                                                <td className="p-2 border dark:border-slate-800">{p.endDate}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="flex space-x-3">
                                <button onClick={() => setParsedProjects([])} className="flex-1 bg-slate-200 text-slate-700 dark:text-slate-200 py-3 rounded-xl font-bold">Retour / Corriger</button>
                                <button onClick={confirmBulkImport} className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold">
                                    Confirmer l'import ({parsedProjects.length} projets)
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}

            {activeTab === 'INFO' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column: Info */}
                    <div className="space-y-6">
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <User size={18} className="mr-2 text-emerald-500"/> Coordonnées
                            </h3>
                            
                            <div className="space-y-4">
                                <div className="flex items-center text-sm">
                                    <Mail size={16} className="text-slate-700 dark:text-slate-200 dark:text-white mr-3 shrink-0"/>
                                    {isEditing ? (
                                        <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputClass} />
                                    ) : (
                                        <a href={`mailto:${client.email}`} className="text-emerald-600 hover:underline truncate">{client.email || 'Non renseigné'}</a>
                                    )}
                                </div>
                                <div className="flex items-center text-sm">
                                    <Phone size={16} className="text-slate-700 dark:text-slate-200 dark:text-white mr-3 shrink-0"/>
                                    {isEditing ? (
                                        <input type="tel" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className={inputClass} />
                                    ) : (
                                        <a href={`tel:${client.phone}`} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-emerald-600">{client.phone || 'Non renseigné'}</a>
                                    )}
                                </div>
                                <div className="flex items-start text-sm">
                                    <MapPin size={16} className="text-slate-700 dark:text-slate-200 dark:text-white mr-3 mt-0.5 shrink-0"/>
                                    {isEditing ? (
                                        <div className="w-full space-y-2">
                                            <AddressAutocomplete
                                                value={formData.address}
                                                onChange={(val) => setFormData({...formData, address: val})}
                                                onSelect={(result) => setFormData({
                                                    ...formData,
                                                    address: result.street,
                                                    zipCode: result.zipCode,
                                                    city: result.city
                                                })}
                                                className={inputClass}
                                                placeholder="Adresse"
                                            />
                                            <div className="flex space-x-2">
                                                <input type="text" placeholder="CP" value={formData.zipCode} onChange={e => setFormData({...formData, zipCode: e.target.value})} className="w-20 p-2 text-sm border rounded-lg dark:bg-slate-800 dark:text-white dark:text-white" />
                                                <input type="text" placeholder="Ville" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="flex-1 p-2 text-sm border rounded-lg dark:bg-slate-800 dark:text-white dark:text-white" />
                                            </div>
                                        </div>
                                    ) : (
                                        <span className="text-slate-700 dark:text-slate-200 dark:text-white">{client.address}<br/>{client.zipCode} {client.city}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* ACCESS CODES SECTION */}
                        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center mb-4 border-b border-slate-100 dark:border-slate-800 pb-2">
                                <Key size={18} className="mr-2 text-emerald-500"/> Codes & Accès
                            </h3>
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-700 dark:text-slate-200 dark:text-white font-bold uppercase">Digicode</label>
                                        {isEditing ? (
                                            <input type="text" value={formData.accessCodes?.digicode || ''} onChange={(e) => updateAccessCode('digicode', e.target.value)} className={inputClass} placeholder="A1234"/>
                                        ) : (
                                            <p className="text-sm font-mono bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{formData.accessCodes?.digicode || '-'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-700 dark:text-slate-200 dark:text-white font-bold uppercase">Étage</label>
                                        {isEditing ? (
                                            <input type="text" value={formData.accessCodes?.floor || ''} onChange={(e) => updateAccessCode('floor', e.target.value)} className={inputClass} placeholder="3e G"/>
                                        ) : (
                                            <p className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{formData.accessCodes?.floor || '-'}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-slate-700 dark:text-slate-200 dark:text-white font-bold uppercase">Porte</label>
                                        {isEditing ? (
                                            <input type="text" value={formData.accessCodes?.door || ''} onChange={(e) => updateAccessCode('door', e.target.value)} className={inputClass} placeholder="Num/Code"/>
                                        ) : (
                                            <p className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{formData.accessCodes?.door || '-'}</p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-xs text-slate-700 dark:text-slate-200 dark:text-white font-bold uppercase">Interphone</label>
                                        {isEditing ? (
                                            <input type="text" value={formData.accessCodes?.intercom || ''} onChange={(e) => updateAccessCode('intercom', e.target.value)} className={inputClass} placeholder="Nom"/>
                                        ) : (
                                            <p className="text-sm bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{formData.accessCodes?.intercom || '-'}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Projects History */}
                    <div className="lg:col-span-2 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center text-lg">
                                <Clock size={20} className="mr-2 text-emerald-500"/> Historique des Dossiers
                            </h3>
                            <div className="flex space-x-2">
                                {onBulkAdd && (
                                    <button 
                                        onClick={() => setShowBulkImport(true)}
                                        className="flex items-center px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm"
                                        title="Importer une liste Excel/CSV"
                                    >
                                        <FileSpreadsheet size={14} className="mr-1"/> Import Masse
                                    </button>
                                )}
                                {onCreateProject && (
                                    <button 
                                        onClick={() => onCreateProject(client)}
                                        className="flex items-center px-3 py-1.5 bg-slate-800 dark:bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 transition-colors"
                                    >
                                        <Plus size={14} className="mr-1"/> Nouveau Dossier
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        {clientProjects.length === 0 ? (
                            <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-800">
                                <Briefcase size={48} className="mx-auto text-slate-300 mb-4"/>
                                <p className="text-slate-700 dark:text-slate-200 dark:text-white">Aucun dossier associé à ce contact.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {clientProjects.map(project => (
                                    <div 
                                        key={project.id}
                                        onClick={() => { onClose(); onProjectClick(project); }}
                                        className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all cursor-pointer group"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center space-x-2 mb-1">
                                                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white">#{project.businessCode || project.id}</span>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${getStatusColor(project.status)}`}>
                                                        {project.status.replace('_', ' ')}
                                                    </span>
                                                    {project.folderType === 'Sous-traitance' && (
                                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-cyan-100 text-cyan-700">Sous-traitance</span>
                                                    )}
                                                </div>
                                                <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white group-hover:text-emerald-600 transition-colors">{project.title}</h4>
                                                <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white mt-1 line-clamp-1">{project.description}</p>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
                                                    {project.budget ? project.budget.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' }) : '-'}
                                                </div>
                                                <div className="text-xs text-slate-700 dark:text-slate-200 dark:text-white mt-1">
                                                    {new Date(project.createdAt).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'DOCS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in">
                    {/* Notes Section */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center mb-4">
                            <StickyNote size={18} className="mr-2 text-emerald-500"/> Notes Privées
                        </h3>
                        <textarea 
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            onBlur={handleSave}
                            placeholder="Informations importantes sur le client (code porte, préférences, etc.)"
                            className="flex-1 w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg resize-none outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                        <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white mt-2 text-right">Sauvegarde automatique à la sortie du champ.</p>
                    </div>

                    {/* Documents Section */}
                    <div className="space-y-4">
                         <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                                    <FileText size={18} className="mr-2 text-emerald-500"/> Documents Contact
                                </h3>
                                <div className="relative">
                                    <button 
                                        onClick={() => fileInputRef.current?.click()} 
                                        disabled={isUploading}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center disabled:opacity-50"
                                    >
                                        {isUploading ? <Loader2 size={14} className="mr-1 animate-spin"/> : <Upload size={14} className="mr-1"/>}
                                        Ajouter (RIB, Kbis...)
                                    </button>
                                    <input 
                                        ref={fileInputRef} 
                                        type="file" 
                                        onChange={handleFileUpload} 
                                        className="hidden" 
                                    />
                                </div>
                            </div>

                            <div className="space-y-2 max-h-[400px] overflow-y-auto">
                                {(!formData.documents || formData.documents.length === 0) ? (
                                    <div className="text-center py-8 text-slate-700 dark:text-slate-200 dark:text-white bg-slate-50 dark:bg-slate-900 rounded-lg border border-dashed border-slate-200 dark:border-slate-800">
                                        <FileText size={24} className="mx-auto mb-2 opacity-50"/>
                                        <p className="text-xs">Aucun document</p>
                                    </div>
                                ) : (
                                    formData.documents.map((doc, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-emerald-300 transition-colors">
                                            <div className="flex items-center overflow-hidden">
                                                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-200 mr-3 shrink-0">
                                                    <FileText size={16} className="text-emerald-600"/>
                                                </div>
                                                <div className="truncate">
                                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white truncate">{doc.name}</p>
                                                    <p className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white">{new Date(doc.date).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center space-x-2 shrink-0">
                                                <a 
                                                    href={doc.url} 
                                                    target="_blank" 
                                                    rel="noreferrer"
                                                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded"
                                                    title="Ouvrir"
                                                >
                                                    <ExternalLink size={16} />
                                                </a>
                                                <button 
                                                    onClick={() => deleteDocument(doc.id)}
                                                    className="p-1.5 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 hover:bg-red-50 rounded"
                                                    title="Supprimer"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default ClientDetailModal;
