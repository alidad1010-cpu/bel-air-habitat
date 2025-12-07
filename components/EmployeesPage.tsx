

import React, { useState, useRef } from 'react';
import { Search, Plus, Trash2, Mail, Phone, MapPin, User, FileText, Upload, Printer, Globe, Shield, CreditCard, Save, X, Eye, Loader2, ExternalLink, Briefcase } from 'lucide-react';
import { Employee, EmployeeDocument } from '../types';
import { uploadFileToCloud } from '../services/firebaseService';

interface EmployeesPageProps {
    employees: Employee[];
    onAddEmployee: (emp: Employee) => void;
    onUpdateEmployee: (emp: Employee) => void;
    onDeleteEmployee: (id: string) => void;
}

const EmployeesPage: React.FC<EmployeesPageProps> = ({ employees, onAddEmployee, onUpdateEmployee, onDeleteEmployee }) => {
    const [viewMode, setViewMode] = useState<'LIST' | 'FOREIGNERS'>('LIST');
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

    // Document Upload State
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Default empty employee
    const emptyEmployee: Employee = {
        id: '',
        firstName: '',
        lastName: '',
        position: '',
        startDate: new Date().toISOString().split('T')[0],
        nationality: 'Française',
        isForeigner: false,
        isActive: true,
        email: '',
        phone: '',
        address: '',
        idCardNumber: '',
        ssn: ''
    };

    const [formData, setFormData] = useState<Employee>(emptyEmployee);

    const filteredEmployees = employees.filter(e => {
        const matchesSearch =
            e.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            e.position.toLowerCase().includes(searchQuery.toLowerCase());

        if (viewMode === 'FOREIGNERS') {
            return matchesSearch && e.isForeigner;
        }
        return matchesSearch;
    });

    const handleOpenModal = (emp?: Employee) => {
        if (emp) {
            setSelectedEmployee(emp);
            setFormData(emp);
        } else {
            setSelectedEmployee(null);
            setFormData({ ...emptyEmployee, id: Date.now().toString() });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedEmployee) {
            onUpdateEmployee(formData);
        } else {
            onAddEmployee(formData);
        }
        setIsModalOpen(false);
    };

    // --- DOCUMENT HANDLING ---
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: EmployeeDocument['type']) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const empId = formData.id;
            const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const path = `employees/${empId}/documents/${Date.now()}_${safeName}`;

            let url;
            try {
                url = await uploadFileToCloud(path, file);
            } catch (err) {
                console.warn("Cloud upload failed, fallback to local base64");
                if (file.size > 2 * 1024 * 1024) throw new Error("Fichier trop lourd pour sauvegarde locale (Max 2Mo)");

                // Simple base64 fallback
                const reader = new FileReader();
                url = await new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            }

            const newDoc: EmployeeDocument = {
                id: Date.now().toString(),
                name: file.name,
                type: type,
                date: new Date().toISOString(),
                url: url
            };

            const updatedEmp = {
                ...formData,
                documents: [...(formData.documents || []), newDoc]
            };

            setFormData(updatedEmp);

            // If we are editing an existing employee, auto-save the doc
            if (selectedEmployee) {
                onUpdateEmployee(updatedEmp);
            }

        } catch (error: any) {
            alert(`Erreur upload: ${error.message}`);
        } finally {
            setIsUploading(false);
            if (e.target) e.target.value = '';
        }
    };

    const deleteDocument = (docId: string) => {
        if (confirm("Supprimer ce document ?")) {
            const updatedEmp = {
                ...formData,
                documents: formData.documents?.filter(d => d.id !== docId)
            };
            setFormData(updatedEmp);
            if (selectedEmployee) onUpdateEmployee(updatedEmp);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const inputClass = "w-full p-2.5 bg-white dark:bg-slate-900 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 dark:text-slate-100 dark:text-white dark:text-white placeholder-slate-400 text-sm";
    const labelClass = "block text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white uppercase mb-1";

    return (
        <div className="space-y-6 animate-fade-in relative">

            {/* HEADER & CONTROLS (Hidden in Print) */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                        <User className="mr-3 text-emerald-600" />
                        Gestion des Salariés
                    </h2>
                    <p className="text-slate-700 dark:text-slate-200 dark:text-white text-sm">Ressources Humaines & Administratif</p>
                </div>

                <div className="flex items-center space-x-3 w-full md:w-auto">
                    <button
                        onClick={handlePrint}
                        className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white rounded-lg hover:bg-slate-200 transition-colors"
                        title="Imprimer la liste (PDF)"
                    >
                        <Printer size={20} />
                    </button>

                    <div className="relative flex-1 md:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200 dark:text-white" size={18} />
                        <input
                            type="text"
                            placeholder="Rechercher un salarié..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm dark:text-white dark:text-white"
                        />
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors text-sm whitespace-nowrap"
                    >
                        <Plus size={18} className="mr-2" />
                        Ajouter
                    </button>
                </div>
            </div>

            {/* VIEW SWITCHER (Hidden in Print) */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-fit print:hidden">
                <button
                    onClick={() => setViewMode('LIST')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-emerald-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:text-white dark:text-white'}`}
                >
                    Tous les Salariés
                </button>
                <button
                    onClick={() => setViewMode('FOREIGNERS')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${viewMode === 'FOREIGNERS' ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-emerald-600 dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 dark:text-white dark:text-white'}`}
                >
                    <Globe size={16} className="mr-2" /> Salariés Étrangers (Hors UE)
                </button>
            </div>

            {/* PRINT HEADER (Visible Only in Print) */}
            <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-4">
                <div className="flex justify-between items-center">
                    <div>
                        <img
                            src="https://cdn.prod.website-files.com/6279383071a695621116a3bb/66aa3dc06cc8b3e76941f8a3_Final-logo.png"
                            alt="Bel Air Habitat"
                            className="h-16 w-auto object-contain mb-2 brightness-0"
                        />
                        <p className="text-sm font-bold uppercase">Liste des Salariés {viewMode === 'FOREIGNERS' ? '(Hors UE)' : ''}</p>
                    </div>
                    <div className="text-right text-sm">
                        <p className="font-bold">BEL AIR HABITAT</p>
                        <p>19 B RUE DE LA TOURELLE</p>
                        <p>95170 DEUIL-LA-BARRE</p>
                        <p className="mt-2 text-xs text-slate-700 dark:text-slate-200 dark:text-white">Imprimé le {new Date().toLocaleDateString()}</p>
                    </div>
                </div>
            </div>

            {/* EMPLOYEES TABLE */}
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                    <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-800">
                        <tr>
                            <th className="px-6 py-4">Salarié</th>
                            <th className="px-6 py-4">Poste</th>
                            <th className="px-6 py-4">Début Poste</th>
                            <th className="px-6 py-4">Nationalité</th>
                            <th className="px-6 py-4 hidden md:table-cell">Pièce d'Identité</th>
                            <th className="px-6 py-4 text-right print:hidden">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {filteredEmployees.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="px-6 py-12 text-center text-slate-700 dark:text-slate-200 dark:text-white italic">
                                    Aucun salarié trouvé dans cette catégorie.
                                </td>
                            </tr>
                        ) : (
                            filteredEmployees.map(emp => (
                                <tr key={emp.id} onClick={() => handleOpenModal(emp)} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center">
                                            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mr-3 text-xs">
                                                {emp.firstName.charAt(0)}{emp.lastName.charAt(0)}
                                            </div>
                                            <div>
                                                <div className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase">{emp.lastName} {emp.firstName}</div>
                                                <div className="text-xs text-slate-700 dark:text-slate-200 dark:text-white print:hidden">{emp.email || emp.phone}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-200 dark:text-white">{emp.position}</td>
                                    <td className="px-6 py-4 text-slate-700 dark:text-slate-200 dark:text-white dark:text-white">
                                        {new Date(emp.startDate).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${emp.isForeigner ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 text-slate-700 dark:text-slate-200'}`}>
                                            {emp.isForeigner && <Globe size={10} className="mr-1" />}
                                            {emp.nationality}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 hidden md:table-cell font-mono text-xs">
                                        {emp.idCardNumber || '-'}
                                    </td>
                                    <td className="px-6 py-4 text-right print:hidden">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDeleteEmployee(emp.id); }}
                                            className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* MODAL EDIT / ADD */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
                    <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">

                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                                {selectedEmployee ? 'Fiche Salarié' : 'Nouveau Salarié'}
                            </h3>
                            <div className="flex items-center space-x-2">
                                <button onClick={handleSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center">
                                    <Save size={16} className="mr-2" /> Enregistrer
                                </button>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 p-2">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                                {/* Left Col: Personal Info */}
                                <div className="lg:col-span-2 space-y-6">
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase text-xs mb-4 border-b border-slate-100 pb-2 flex items-center">
                                            <User size={14} className="mr-2" /> Informations Personnelles
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className={labelClass}>Nom</label><input type="text" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} className={inputClass} required /></div>
                                            <div><label className={labelClass}>Prénom</label><input type="text" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} className={inputClass} required /></div>
                                            <div><label className={labelClass}>Email</label><input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={inputClass} /></div>
                                            <div><label className={labelClass}>Téléphone</label><input type="tel" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className={inputClass} /></div>
                                            <div className="col-span-2"><label className={labelClass}>Adresse</label><input type="text" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className={inputClass} /></div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase text-xs mb-4 border-b border-slate-100 pb-2 flex items-center">
                                            <Briefcase size={14} className="mr-2" /> Contrat & Poste
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className={labelClass}>Poste Occupé</label><input type="text" value={formData.position} onChange={e => setFormData({ ...formData, position: e.target.value })} className={inputClass} placeholder="Ex: Peintre, Chef Chantier..." /></div>
                                            <div><label className={labelClass}>Début du Poste</label><input type="date" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className={inputClass} /></div>
                                            <div>
                                                <label className={labelClass}>Nationalité</label>
                                                <input type="text" value={formData.nationality} onChange={e => setFormData({ ...formData, nationality: e.target.value })} className={inputClass} />
                                            </div>
                                            <div className="flex items-center pt-5">
                                                <input
                                                    type="checkbox"
                                                    id="foreignerCheck"
                                                    checked={formData.isForeigner}
                                                    onChange={e => setFormData({ ...formData, isForeigner: e.target.checked })}
                                                    className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                                                />
                                                <label htmlFor="foreignerCheck" className="ml-2 text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-white">Ressortissant Hors UE / Étranger</label>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase text-xs mb-4 border-b border-slate-100 pb-2 flex items-center">
                                            <Shield size={14} className="mr-2" /> Administratif
                                        </h4>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div><label className={labelClass}>N° Pièce d'Identité / Titre Séjour</label><input type="text" value={formData.idCardNumber} onChange={e => setFormData({ ...formData, idCardNumber: e.target.value })} className={inputClass} /></div>
                                            <div><label className={labelClass}>N° Sécu / Carte Vitale</label><input type="text" value={formData.ssn} onChange={e => setFormData({ ...formData, ssn: e.target.value })} className={inputClass} /></div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Col: Documents */}
                                <div className="lg:col-span-1 space-y-6">
                                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm h-full flex flex-col">
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white uppercase text-xs mb-4 border-b border-slate-100 pb-2 flex items-center">
                                            <FileText size={14} className="mr-2" /> Documents
                                        </h4>

                                        {/* Upload Buttons */}
                                        <div className="grid grid-cols-1 gap-2 mb-4">
                                            {[
                                                { label: 'Contrat de Travail', type: 'CONTRACT' },
                                                { label: 'Fiche de Paie', type: 'PAYSLIP' },
                                                { label: 'Pièce Identité', type: 'ID_CARD' },
                                                { label: 'Carte Vitale', type: 'VITALE' },
                                                { label: 'Carte BTP', type: 'BTP_CARD' },
                                                { label: 'CV', type: 'CV' },
                                            ].map((docType) => (
                                                <div key={docType.type} className="relative group">
                                                    <button
                                                        className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-700 transition-colors flex items-center justify-between"
                                                        onClick={() => { }}
                                                    >
                                                        <span>+ {docType.label}</span>
                                                        <Upload size={14} />
                                                    </button>
                                                    <input
                                                        type="file"
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                        onChange={(e) => handleFileUpload(e, docType.type as any)}
                                                        disabled={isUploading}
                                                    />
                                                </div>
                                            ))}
                                        </div>

                                        {isUploading && <div className="text-center py-2"><Loader2 className="animate-spin inline text-emerald-500" /></div>}

                                        {/* Documents List */}
                                        <div className="flex-1 overflow-y-auto space-y-2 mt-2 max-h-60 border-t border-slate-100 pt-2">
                                            {formData.documents?.map(doc => (
                                                <div key={doc.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-900 rounded border border-slate-100 dark:border-slate-800">
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white truncate">{doc.name}</div>
                                                        <div className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white uppercase">{doc.type === 'BTP_CARD' ? 'CARTE BTP' : doc.type}</div>
                                                    </div>
                                                    <div className="flex space-x-1 shrink-0">
                                                        <a href={doc.url} target="_blank" rel="noreferrer" className="p-1 hover:bg-slate-200 rounded text-emerald-600"><ExternalLink size={14} /></a>
                                                        <button onClick={() => deleteDocument(doc.id)} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 size={14} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                            {(!formData.documents || formData.documents.length === 0) && (
                                                <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white text-center italic mt-4">Aucun document joint.</p>
                                            )}
                                        </div>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeesPage;