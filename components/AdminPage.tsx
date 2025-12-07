
import React, { useState, useRef } from 'react';
import { FileText, Building, Truck, Upload, AlertTriangle, CheckCircle, Clock, Trash2, ExternalLink, Plus, Save, X, Loader2 } from 'lucide-react';
import { CompanyAdministrativeData, AdminDocument, AdminDocType, Vehicle } from '../types';
import { uploadFileToCloud } from '../services/firebaseService';

interface AdminPageProps {
    data: CompanyAdministrativeData;
    onUpdate: (data: CompanyAdministrativeData) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ data, onUpdate }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [isAddingVehicle, setIsAddingVehicle] = useState(false);
    const [newVehicle, setNewVehicle] = useState({ name: '', plate: '' });
    const fileInputRef = useRef<HTMLInputElement>(null);
    
    // State to hold temp info for upload (which type, which vehicle)
    const [uploadContext, setUploadContext] = useState<{ type: AdminDocType, vehicleId?: string } | null>(null);

    // Initial Empty State if data is missing
    const safeData = data || { id: 'administrative', documents: [], vehicles: [] };

    // --- HELPER FUNCTIONS ---

    const calculateExpiry = (dateStr: string, type: AdminDocType): string => {
        const date = new Date(dateStr);
        // Kbis = 3 months validity, Others = 6 months
        const monthsToAdd = type === 'KBIS' ? 3 : 6;
        date.setMonth(date.getMonth() + monthsToAdd);
        return date.toISOString().split('T')[0];
    };

    const getStatus = (expiryDate: string) => {
        const now = new Date();
        const expiry = new Date(expiryDate);
        const diffTime = expiry.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return { label: 'EXPIRÉ', color: 'bg-red-100 text-red-600 border-red-200', icon: AlertTriangle };
        if (diffDays < 30) return { label: 'Expire Bientôt', color: 'bg-orange-100 text-orange-600 border-orange-200', icon: Clock };
        return { label: 'Valide', color: 'bg-emerald-100 text-emerald-600 border-emerald-200', icon: CheckCircle };
    };

    // --- ACTIONS ---

    const handleUploadClick = (type: AdminDocType, vehicleId?: string) => {
        setUploadContext({ type, vehicleId });
        if (fileInputRef.current) fileInputRef.current.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !uploadContext) return;

        // ASK FOR DOCUMENT DATE
        const docDateStr = window.prompt("Quelle est la date indiquée sur le document ? (AAAA-MM-JJ)", new Date().toISOString().split('T')[0]);
        if (!docDateStr) return; // User cancelled

        setIsUploading(true);
        try {
            const path = `company/administrative/${Date.now()}_${file.name}`;
            let url;
            try {
                url = await uploadFileToCloud(path, file);
            } catch (err) {
                // Fallback base64
                url = await new Promise<string>(resolve => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
            }

            const newDoc: AdminDocument = {
                id: Date.now().toString(),
                type: uploadContext.type,
                name: file.name,
                url: url,
                uploadDate: new Date().toISOString(),
                documentDate: docDateStr,
                expiryDate: calculateExpiry(docDateStr, uploadContext.type),
                vehicleId: uploadContext.vehicleId
            };

            // Remove old document of same type/vehicle to replace it
            const filteredDocs = safeData.documents.filter(d => {
                if (uploadContext.vehicleId) {
                    return !(d.type === uploadContext.type && d.vehicleId === uploadContext.vehicleId);
                }
                return d.type !== uploadContext.type;
            });

            onUpdate({
                ...safeData,
                documents: [...filteredDocs, newDoc]
            });

        } catch (error) {
            console.error(error);
            alert("Erreur lors de l'envoi.");
        } finally {
            setIsUploading(false);
            setUploadContext(null);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleAddVehicle = () => {
        if (!newVehicle.name) return;
        const vehicle: Vehicle = {
            id: Date.now().toString(),
            name: newVehicle.name,
            licensePlate: newVehicle.plate
        };
        onUpdate({
            ...safeData,
            vehicles: [...safeData.vehicles, vehicle]
        });
        setNewVehicle({ name: '', plate: '' });
        setIsAddingVehicle(false);
    };

    const handleDeleteVehicle = (id: string) => {
        if (window.confirm("Supprimer ce véhicule ?")) {
            onUpdate({
                ...safeData,
                vehicles: safeData.vehicles.filter(v => v.id !== id),
                // Also remove linked docs
                documents: safeData.documents.filter(d => d.vehicleId !== id)
            });
        }
    };

    const handleDeleteDoc = (id: string) => {
        if (window.confirm("Supprimer ce document ?")) {
            onUpdate({
                ...safeData,
                documents: safeData.documents.filter(d => d.id !== id)
            });
        }
    };

    // --- RENDERERS ---

    const renderDocCard = (type: AdminDocType, title: string, vehicleId?: string) => {
        // Find existing doc
        const doc = safeData.documents.find(d => {
            if (vehicleId) return d.type === type && d.vehicleId === vehicleId;
            return d.type === type;
        });

        const status = doc ? getStatus(doc.expiryDate) : null;

        return (
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between group">
                <div className="flex items-center space-x-3 overflow-hidden">
                    <div className={`p-2 rounded-lg shrink-0 ${doc ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white' : 'bg-slate-50 dark:bg-slate-900 text-slate-300 border-2 border-dashed border-slate-200'}`}>
                        <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white text-sm truncate">{title}</p>
                        {doc ? (
                            <div className="flex items-center mt-1 space-x-2">
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex items-center ${status?.color}`}>
                                    {status?.icon && <status.icon size={10} className="mr-1"/>}
                                    {status?.label}
                                </span>
                                <span className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white">Exp: {new Date(doc.expiryDate).toLocaleDateString()}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white italic">Non importé</p>
                        )}
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {doc && (
                        <>
                            <a href={doc.url} target="_blank" rel="noreferrer" className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-emerald-600 bg-slate-50 dark:bg-slate-800 rounded-lg transition-colors">
                                <ExternalLink size={16} />
                            </a>
                            <button onClick={() => handleDeleteDoc(doc.id)} className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 bg-slate-50 dark:bg-slate-800 rounded-lg transition-colors">
                                <Trash2 size={16} />
                            </button>
                        </>
                    )}
                    <button 
                        onClick={() => handleUploadClick(type, vehicleId)}
                        disabled={isUploading}
                        className="p-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm disabled:opacity-50"
                        title="Uploader / Remplacer"
                    >
                        {isUploading ? <Loader2 size={16} className="animate-spin"/> : <Upload size={16} />}
                    </button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 animate-fade-in pb-12 max-w-6xl mx-auto">
            <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="application/pdf,image/*" />

            {/* HEADER */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                    <Building className="mr-3 text-emerald-600"/> 
                    Gestion Administrative
                </h2>
                <p className="text-slate-700 dark:text-slate-200 dark:text-white text-sm">Centralisation des documents officiels, assurances et flotte.</p>
            </div>

            {/* SECTION 1: OFFICIAL DOCUMENTS */}
            <section>
                <h3 className="font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase text-xs mb-4 flex items-center">
                    <FileText size={16} className="mr-2"/> Documents Officiels Entreprise
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {renderDocCard('KBIS', 'Kbis (Validité 3 mois)')}
                    {renderDocCard('DECENNALE', 'Assurance Décennale & Civile')}
                    {renderDocCard('PROBTP', 'Attestation Pro-BTP')}
                    {renderDocCard('CIBTP', 'Attestation CIBTP')}
                    {renderDocCard('URSSAF', 'Attestation URSSAF')}
                    {renderDocCard('FISCAL', 'Attestation Fiscale')}
                </div>
            </section>

            {/* SECTION 2: OFFICES */}
            <section>
                <h3 className="font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase text-xs mb-4 flex items-center border-t border-slate-200 dark:border-slate-800 pt-6">
                    <Building size={16} className="mr-2"/> Bureaux & Locaux
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {renderDocCard('OFFICE_LEASE', 'Bail Commercial / Location')}
                    {renderDocCard('OFFICE_INSURANCE', 'Assurance Bureaux')}
                </div>
            </section>

             {/* SECTION 3: VEHICLES */}
             <section>
                <div className="flex justify-between items-center mb-4 border-t border-slate-200 dark:border-slate-800 pt-6">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase text-xs flex items-center">
                        <Truck size={16} className="mr-2"/> Flotte Véhicules
                    </h3>
                    <button 
                        onClick={() => setIsAddingVehicle(true)}
                        className="text-xs font-bold bg-slate-800 text-white px-3 py-1.5 rounded-lg flex items-center hover:bg-emerald-600 transition-colors"
                    >
                        <Plus size={14} className="mr-1"/> Ajouter un véhicule
                    </button>
                </div>
                
                {isAddingVehicle && (
                    <div className="bg-slate-100 dark:bg-slate-800/50 p-4 rounded-xl mb-4 flex flex-col md:flex-row gap-4 items-end animate-in fade-in">
                        <div className="flex-1 w-full">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase">Modèle / Nom</label>
                            <input type="text" value={newVehicle.name} onChange={e => setNewVehicle({...newVehicle, name: e.target.value})} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="Ex: Renault Master"/>
                        </div>
                        <div className="flex-1 w-full">
                            <label className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase">Immatriculation</label>
                            <input type="text" value={newVehicle.plate} onChange={e => setNewVehicle({...newVehicle, plate: e.target.value})} className="w-full p-2 rounded border border-slate-200 text-sm" placeholder="AA-123-BB"/>
                        </div>
                        <div className="flex space-x-2">
                             <button onClick={handleAddVehicle} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm font-bold">Ajouter</button>
                             <button onClick={() => setIsAddingVehicle(false)} className="bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 px-4 py-2 rounded text-sm font-bold">Annuler</button>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {safeData.vehicles.length === 0 ? (
                        <div className="col-span-full text-center py-8 text-slate-700 dark:text-slate-200 dark:text-white italic bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200">
                            Aucun véhicule enregistré.
                        </div>
                    ) : (
                        safeData.vehicles.map(vehicle => (
                            <div key={vehicle.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm relative">
                                <button onClick={() => handleDeleteVehicle(vehicle.id)} className="absolute top-4 right-4 text-slate-300 hover:text-red-500">
                                    <Trash2 size={16}/>
                                </button>
                                
                                <div className="flex items-center mb-4">
                                    <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 rounded-lg mr-3">
                                        <Truck size={24}/>
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">{vehicle.name}</h4>
                                        <p className="text-xs font-mono bg-slate-100 dark:bg-slate-800 px-1.5 rounded inline-block mt-1 text-slate-700 dark:text-slate-200 dark:text-white">
                                            {vehicle.licensePlate || 'Sans plaque'}
                                        </p>
                                    </div>
                                </div>
                                
                                {/* Insurance Doc for this vehicle */}
                                {renderDocCard('VEHICLE_INSURANCE', 'Carte Verte / Assurance', vehicle.id)}
                            </div>
                        ))
                    )}
                </div>
            </section>
        </div>
    );
};

export default AdminPage;
