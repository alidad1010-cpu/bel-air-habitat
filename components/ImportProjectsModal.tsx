import React, { useState } from 'react';
import { Upload, X, Sparkles, Check, AlertTriangle } from 'lucide-react';
import { parseProjectList, BulkProjectData } from '../services/geminiService';
import { Project, ProjectStatus, ContactMethod, Client } from '../types';

interface ImportProjectsModalProps {
  onClose: () => void;
  onImport: (projects: Project[]) => void;
  existingClients: Client[];
}

const ImportProjectsModal: React.FC<ImportProjectsModalProps> = ({
  onClose,
  onImport,
  existingClients,
}) => {
  const [text, setText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [analyzedProjects, setAnalyzedProjects] = useState<Project[] | null>(null);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setIsProcessing(true);
    try {
      const result = await parseProjectList(text);

      const projects: Project[] = result.map((raw) => {
        // Try to match existing client
        const matchedClient = existingClients.find(
          (c) =>
            c.name.toLowerCase() === raw.endCustomerName?.toLowerCase() ||
            (raw.phone && c.phone === raw.phone)
        );

        const clientId = matchedClient
          ? matchedClient.id
          : Date.now().toString() + Math.random().toString(36).substr(2, 5);

        // Parse Status based on Dates
        let status = ProjectStatus.VALIDATED; // Default for P-Codes (Signed)
        let start: Date | null = null;
        let end: Date | null = null;

        if (raw.startDate) {
          // Robust Date Parsing (DD/MM/YYYY or YYYY-MM-DD or DD MM YYYY)
          let d, m, y;
          const cleanDate = raw.startDate.trim().replace(/[.\s]/g, '/').replace(/-/g, '/');

          if (cleanDate.includes('/')) {
            const parts = cleanDate.split('/').map(Number);
            if (parts.length === 3) {
              if (parts[0] > 1000) {
                // YYYY-MM-DD
                [y, m, d] = parts;
              } else {
                // DD-MM-YYYY
                [d, m, y] = parts;
              }
            }
          }

          // Handle 2-digit years (e.g. 24 -> 2024)
          if (y && y < 100) y += 2000;

          // Safety check
          if (!d || !m || !y || isNaN(d) || isNaN(m) || isNaN(y)) {
            const now = new Date();
            d = now.getDate();
            m = now.getMonth() + 1;
            y = now.getFullYear();
          }

          start = new Date(y, m - 1, d);
          start.setHours(0, 0, 0, 0);

          end = new Date(start);

          if (raw.endDate) {
            const cleanEnd = raw.endDate.trim().replace(/[.\s]/g, '/').replace(/-/g, '/');
            let ed, em, ey;

            if (cleanEnd.includes('/')) {
              const parts = cleanEnd.split('/').map(Number);
              if (parts.length === 3) {
                if (parts[0] > 1000) {
                  [ey, em, ed] = parts;
                } else {
                  [ed, em, ey] = parts;
                }
              }
            }

            // Handle 2-digit years for End Date (e.g. 25 -> 2025)
            if (ey && ey < 100) ey += 2000;

            if (ed && em && ey && !isNaN(ed) && !isNaN(em) && !isNaN(ey)) {
              end = new Date(ey, em - 1, ed);
              end.setHours(0, 0, 0, 0);
            }
          }

          const now = new Date();
          now.setHours(0, 0, 0, 0);

          if (end && end.getTime() < now.getTime()) {
            status = ProjectStatus.COMPLETED;
          } else if (
            start &&
            end &&
            now.getTime() >= start.getTime() &&
            now.getTime() <= end.getTime()
          ) {
            status = ProjectStatus.IN_PROGRESS;
          } else if (start && start.getTime() > now.getTime()) {
            status = ProjectStatus.VALIDATED;
          }
        }

        const nameUpper = (
          matchedClient ? matchedClient.name : raw.endCustomerName || ''
        ).toUpperCase();
        const isHomelife = nameUpper.includes('HOMELIFE') || nameUpper.includes('HOME LIFE');
        const isJLS = nameUpper.includes('JLS') || nameUpper.includes('ARTISAN'); // Catch JLS ARTISAN

        let clientType: any = 'PARTICULIER';
        let customVat = 20;

        if (isHomelife) {
          clientType = 'ENTREPRISE'; // User considers Homelife a Client
          customVat = 0; // Subcontracting rule
        } else if (isJLS) {
          clientType = 'PARTENAIRE';
        }

        // Helper for Dates
        const toISODate = (d: Date) => {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        return {
          id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
          title: matchedClient ? matchedClient.name : raw.endCustomerName || 'Chantier',
          description: raw.description || `Importé. Assurance/Origine: ${raw.insurance || 'N/A'}`,
          businessCode: raw.businessCode,
          status: status,
          contactMethod: ContactMethod.PHONE,
          priority: 'Moyenne',
          createdAt: Date.now(),
          budget: raw.budget,
          siteAddress: raw.siteAddress,
          vatRate: customVat,
          folderType: matchedClient?.type || clientType,
          origin: raw.insurance,
          skills: raw.skills,
          startDate: start ? toISODate(start) : '',
          endDate: end ? toISODate(end) : '',

          client: matchedClient || {
            id: clientId,
            name: raw.endCustomerName || 'Client Inconnu',
            phone: raw.phone || '',
            email: '',
            address: raw.siteAddress || '',
            city: '',
            type: clientType,
          },
        };
      });

      setAnalyzedProjects(projects);
    } catch (e) {
      console.error(e);
      alert("Erreur lors de l'analyse AI");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmImport = () => {
    if (analyzedProjects) {
      onImport(analyzedProjects);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
          <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Upload size={24} className="text-emerald-500" />
            Import de Chantiers (IA)
          </h3>
          <button onClick={onClose}>
            <X size={24} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950/50">
          {!analyzedProjects ? (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30">
                <p className="text-sm text-blue-700 dark:text-blue-300 leading-relaxed">
                  <strong>Instructions :</strong> Copiez-collez vos lignes Excel ci-dessous. <br />
                  L'IA va détecter automatiquement :{' '}
                  <em>
                    Date début, Code affaire, Nom, Adresse, Budget, Assurance, Téléphone,
                    Compétence, Date fin
                  </em>
                  .
                </p>
              </div>

              <textarea
                className="w-full h-64 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono focus:ring-2 focus:ring-emerald-500 outline-none resize-none shadow-sm"
                placeholder={`Exemple de lignes :
2024-01-15, REF-001, Mme Dupont, Sinistre, 12 Rue de la Paix, 1500€, AXA, 0601020304, Peinture, 2024-01-20
...`}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />

              <div className="flex justify-end pt-2">
                <button
                  onClick={handleAnalyze}
                  disabled={isProcessing || !text.trim()}
                  className="flex items-center px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-xl hover:from-emerald-500 hover:to-teal-500 font-bold shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isProcessing ? (
                    <>
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                      Analyse en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} className="mr-2 text-yellow-300" />
                      Analyser les données
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-700 dark:text-slate-300">
                  {analyzedProjects.length} Chantiers détectés
                </h4>
                <button
                  onClick={() => setAnalyzedProjects(null)}
                  className="text-sm text-slate-500 hover:text-slate-800 underline"
                >
                  Modifier le texte source
                </button>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {analyzedProjects.map((proj, idx) => (
                  <div
                    key={idx}
                    className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-4 items-start"
                  >
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">
                          {proj.businessCode || 'N/A'}
                        </span>
                        <h5 className="font-bold text-slate-800 dark:text-white">
                          {proj.client.name}
                        </h5>
                        {proj.client.id && existingClients.some((c) => c.id === proj.client.id) ? (
                          <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 rounded-full flex items-center">
                            <Check size={10} className="mr-1" /> Client Existant
                          </span>
                        ) : (
                          <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 rounded-full flex items-center">
                            <AlertTriangle size={10} className="mr-1" /> Nouveau Client
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 grid grid-cols-2 md:grid-cols-4 gap-2">
                        <span>📍 {proj.siteAddress || 'Sans adresse'}</span>
                        <span>📞 {proj.client.phone || 'Sans tel'}</span>
                        <span>
                          🗓 {proj.startDate} ➝ {proj.endDate}
                        </span>
                        <span>💰 {proj.budget} €</span>
                      </div>
                      <div className="flex gap-2 mt-1">
                        {proj.origin && (
                          <span className="text-[10px] border border-slate-200 px-1 rounded text-slate-500">
                            Assurance: {proj.origin}
                          </span>
                        )}
                        {proj.skills?.map((s) => (
                          <span
                            key={s}
                            className="text-[10px] bg-slate-100 px-1 rounded text-slate-600"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-800">
                <button
                  onClick={handleConfirmImport}
                  className="flex items-center px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold shadow-lg transition-all"
                >
                  <Check size={18} className="mr-2" />
                  Confirmer l'Importation ({analyzedProjects.length})
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportProjectsModal;
