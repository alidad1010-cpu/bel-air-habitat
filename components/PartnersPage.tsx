import React, { useState, useRef } from 'react';
import {
  Search,
  Plus,
  Trash2,
  Phone,
  FileText,
  Upload,
  Handshake,
  X,
  ExternalLink,
  Briefcase,
  Sparkles,
  User,
} from 'lucide-react';
import { Client, ClientType, ClientDocument } from '../types';
import { uploadFileToCloud } from '../services/firebaseService';

interface PartnersPageProps {
  clients: Client[];
  onAddClient: (client: Client) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (client: Client) => void;
}

const PartnersPage: React.FC<PartnersPageProps> = ({
  clients,
  onAddClient,
  onUpdateClient,
  onDeleteClient,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<Client | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter only Partners and Subcontractors
  const partners = clients.filter((c) => {
    // Exception: Always show "Coop", "Syndic", or "Cop"
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

    const isPartner = c.type === 'PARTENAIRE' || c.type === 'SOUS_TRAITANT';
    if (!isPartner) return false;

    return (
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.city?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const [newPartner, setNewPartner] = useState<Client>({
    name: '',
    email: '',
    phone: '',
    address: '',
    zipCode: '',
    city: '',
    type: 'SOUS_TRAITANT',
    siret: '',
    vatNumber: '',
  });

  // Calculate Document Status
  const getDocStatus = (docs: ClientDocument[], type: string) => {
    const doc = docs?.find((d) => d.type === type);
    if (!doc)
      return {
        status: 'MISSING',
        label: 'Manquant',
        color: 'text-red-500 bg-red-50 border-red-100',
      };

    if (doc.expiryDate) {
      const expiry = new Date(doc.expiryDate);
      const now = new Date();
      const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays < 0)
        return {
          status: 'EXPIRED',
          label: 'Expiré',
          color:
            'text-slate-900 dark:text-white dark:text-white bg-red-500 font-bold border-red-600',
        };
      if (diffDays < 30)
        return {
          status: 'WARNING',
          label: `Exp.${diffDays} j`,
          color: 'text-orange-700 bg-orange-100 border-orange-200',
        };
    }

    return {
      status: 'OK',
      label: 'Valide',
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAddClient(newPartner);
    setIsModalOpen(false);
    setNewPartner({
      name: '',
      email: '',
      phone: '',
      address: '',
      zipCode: '',
      city: '',
      type: 'SOUS_TRAITANT',
      siret: '',
      vatNumber: '',
    });
  };

  // Helper to determine default validity duration in months
  const getDefaultValidityMonths = (type: string): number => {
    switch (type) {
      case 'KBIS':
        return 3;
      case 'URSSAF':
      case 'CIBTP':
      case 'PROBTP':
      case 'FISCAL':
        return 6;
      case 'DECENNALE':
      case 'CIVILE':
        return 12;
      default:
        return 12;
    }
  };

  // Helper for image compression
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Compression failed'));
            },
            'image/jpeg',
            0.7
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile || !selectedPartner) return;

    const monthsToAdd = getDefaultValidityMonths(type);
    const calculatedDate = new Date();
    calculatedDate.setMonth(calculatedDate.getMonth() + monthsToAdd);

    const expiryDateStr = window.prompt(
      `Date de fin de validité pour ${type} ?(Calculé: +${monthsToAdd} mois)`,
      calculatedDate.toISOString().split('T')[0]
    );

    if (!expiryDateStr) return;

    setIsUploading(true);
    try {
      let fileToUpload: File = originalFile;

      // Compress if image
      if (originalFile.type.startsWith('image/')) {
        try {
          const compressedBlob = await compressImage(originalFile);
          fileToUpload = new File([compressedBlob], originalFile.name, { type: 'image/jpeg' });
        } catch (cErr) {
          console.warn('Image compression failed, using original', cErr);
        }
      }

      const path = `partners/${selectedPartner.id}/documents/${Date.now()}_${fileToUpload.name}`;
      let url;
      try {
        url = await uploadFileToCloud(path, fileToUpload);
      } catch (error) {
        console.warn('Cloud upload failed, fallback to base64');
        // 4.5MB limit for Base64
        if (fileToUpload.size > 4.5 * 1024 * 1024)
          throw new Error('Fichier trop lourd pour le mode hors-ligne.');

        url = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(fileToUpload);
        });
      }

      const newDoc: ClientDocument = {
        id: Date.now().toString(),
        name: fileToUpload.name,
        type: type,
        date: new Date().toISOString(),
        expiryDate: expiryDateStr,
        url: url,
      };

      // Remove old doc of same type
      const updatedDocs = selectedPartner.documents?.filter((d) => d.type !== type) || [];

      const updatedPartner = {
        ...selectedPartner,
        documents: [...updatedDocs, newDoc],
      };

      onUpdateClient(updatedPartner);
      setSelectedPartner(updatedPartner);
    } catch (error) {
      console.error(error);
      alert('Erreur upload: ' + (error as any).message);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const generateContract = () => {
    if (!selectedPartner) return;

    const currentDate = new Date().toLocaleDateString('fr-FR');
    const partnerAddress = `${selectedPartner.address || ''} ${selectedPartner.zipCode || ''} ${selectedPartner.city || ''} `;

    const contractText = `
CONTRAT DE SOUS TRAITANCE - CADRE ANNUEL

ENTRE LES SOUSSIGNÉES:

D'une part,
La société BEL AIR HABITAT
Siège social: 19 B Rue de la Tourelle, 95170 DEUIL - LA - BARRE
SIREN: 930 674 932
Représentée par son gérant.

    Et

D'autre part,
La société ${selectedPartner.name.toUpperCase()}
Siège social: ${partnerAddress}
Ayant le numéro de SIREN: ${selectedPartner.siret || '____________________'}
Représentée par son dirigeant.

    Ci - après dénommée « le prestataire de service »

IL A ÉTÉ CONVENU CE QUI SUIT:

ARTICLE PREMIER — OBJET:
Le contrat est un contrat de prestation de service ayant pour objet la mission définie ci - dessous et en faisant partie intégrante.
Désignation des tâches sur les différents chantiers potentiels:
- Travaux de peinture(Préparation, mise en enduit, peinture de sol, etc.)
    - Travaux de plomberie
        - Travaux d’électricité
            - Travaux de Sol(souples et dures)
                - Tout autre travail du bâtiment selon les ordres de commande spécifiques.

En contrepartie de la réalisation des prestations définies au présent article, le client versera au prestataire une somme forfaitaire correspondant aux accords pris ensemble avant chaque chantier.Ceux - ci seront référencés sur les factures et bons de commande.Un chantier devra être fini avant d’être payé.

Le délai de règlement est de 45 jours maximum qui peuvent être adaptés en fonction des besoins des sous - traitants.

Les factures seront en HORS TAXE(auto liquidation de la TVA en application de l’article 283 - 2 nonies du Code Général des Impôts).Toutes les factures émises devront obligatoirement faire apparaître l’article ci - dessus indiqué.Dans le cas contraire, l’entreprise BEL AIR HABITAT se donne le droit de refuser les factures.

Les sommes prévues ci - dessus seront payées par virement bancaire ou par chèque à réception de la facture validée.

ARTICLE DEUX — DURÉE:
Ce contrat est passé pour une durée de 12 mois.Il prend effet le ${currentDate}.

ARTICLE TROIS — EXÉCUTION DE LA PRESTATION:
Le prestataire s’engage à mener à bien la tâche précisée à l’article premier, conformément aux règles de l’art et de la meilleure manière.

3 - 1 : OBLIGATION DE COLLABORER:
Le client tiendra à la disposition du prestataire toutes les informations pouvant contribuer à la bonne réalisation de l’objet du présent contrat.

ARTICLE QUATRE — CALENDRIER / DÉLAIS :
Les missions données devront être achevées avant la fin du délai imparti pour chaque chantier.

ARTICLE CINQ — NATURE DES OBLIGATIONS:
Pour l’accomplissement des diligences et prestations prévues à l’article premier ci - dessus, le prestataire s’engage à donner ses meilleurs soins, conformément aux règles de l’art.La présente obligation, n’est, de convention expresse, que pure obligation de moyens.

ARTICLE SIX – OBLIGATION DE CONFIDENTIALITÉ:
Le prestataire considérera comme strictement confidentiel, et s’interdit de divulguer, toute information, document, donnée ou concept, dont il pourra avoir connaissance à l’occasion du présent contrat.Pour l’application de la présente clause, le prestataire répond de lui - même et de ses salariés.

ARTICLE SEPT — PÉNALITÉ:
Toute méconnaissance des délais stipulés à l’article cinq ci - dessus engendrera l’obligation pour le prestataire de payer au client la somme de 50 euros par jour de retard(montant révisable selon chantier).

ARTICLE HUIT — RÉSILIATION / SANCTION :
Tout manquement de l’une ou l’autre des parties aux obligations qu’elle a en charge, aux termes des articles ci - dessus, entraînera, si bon semble au créancier de l’obligation inexécutée, la résiliation de plein droit au présent contrat, quinze jours après mise en demeure d’exécuter par lettre recommandée avec accusé de réception demeurée sans effet.

ARTICLE NEUF — DROIT DU TRAVAIL:
Le prestataire s’engage à ne pas avoir recours au travail clandestin.Le travail sera réalisé avec des salariés employés régulièrement au regard des articles L143.3 et L143.5; L620.3 du code du travail, ou règle d’effet équivalent pour les candidats étrangers.Le prestataire doit fournir son attestation de vigilance URSSAF à jour tous les 6 mois.

ARTICLE DIX — CLAUSE DE HARDSHIP:
Les parties reconnaissent que le présent accord ne constitue pas une base équitable et raisonnable de leur coopération si les conditions économiques changent radicalement.Elles s'engagent à renégocier de bonne foi.

ARTICLE ONZE — FORCE MAJEURE:
On entend par force majeure des événements de guerre, grèves générales, épidémies, incendies, inondations.Aucune des deux parties ne sera tenue responsable du retard constaté en raison des évènements de force majeure.

ARTICLE DOUZE — LOI APPLICABLE:
Le contrat est régi par la loi française.

ARTICLE TREIZE – COMPÉTENCE:
Toutes contestations qui découlent du présent contrat ou qui s’y rapportent seront tranchées définitivement par le tribunal de commerce compétent du siège social du client.

Fait à Deuil - la - Barre, le ${currentDate}.
En deux(2) exemplaires originaux.

LE CLIENT(BEL AIR HABITAT)                     LE PRESTATAIRE(${selectedPartner.name.toUpperCase()})
    (Signature et Cachet)(Signature et Cachet)
      `;

    const blob = new Blob([contractText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Contrat_SousTraitance_${selectedPartner.name.replace(/\s/g, '_')}_${new Date().getFullYear()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 animate-fade-in relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
            <Handshake className="mr-3 text-emerald-600" /> Partenaires & Sous-traitants
          </h2>
          <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white">
            Gestion des contrats, assurances et documents administratifs.
          </p>
        </div>

        <div className="flex space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700 dark:text-slate-200 dark:text-white"
              size={18}
            />
            <input
              type="text"
              name="partner-search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm text-slate-900 dark:text-white"
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

      {/* Partners List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {partners.map((partner) => {
          const kbisStatus = getDocStatus(partner.documents || [], 'KBIS');
          const insuranceStatus = getDocStatus(partner.documents || [], 'DECENNALE');
          const urssafStatus = getDocStatus(partner.documents || [], 'URSSAF');

          // Check for any expired doc to highlight the card
          const hasIssues = partner.documents?.some((d) => {
            if (!d.expiryDate) return false;
            return new Date(d.expiryDate) < new Date();
          });

          return (
            <div
              key={partner.id}
              onClick={() => setSelectedPartner(partner)}
              className={`bg-white dark:bg-slate-900 rounded-xl border shadow-sm hover:shadow-md transition-all cursor-pointer group p-5 relative overflow-hidden ${hasIssues ? 'border-red-300 ring-1 ring-red-300' : 'border-slate-200 dark:border-slate-800'} `}
            >
              {hasIssues && (
                <div className="absolute top-0 right-0 bg-red-500 text-slate-900 dark:text-white dark:text-white text-[9px] px-2 py-0.5 font-bold uppercase rounded-bl">
                  Action Requise
                </div>
              )}

              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center font-bold text-lg ${partner.type === 'SOUS_TRAITANT' ? 'bg-cyan-100 text-cyan-700' : 'bg-amber-100 text-amber-700'} `}
                  >
                    {partner.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
                      {partner.name}
                    </h3>
                    <div className="flex space-x-2 mt-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white">
                        {partner.type === 'SOUS_TRAITANT' ? 'SOUS-TRAITANT' : 'PARTENAIRE'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 mb-4 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                <div className="flex justify-between text-xs items-center">
                  <span className="text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                    Kbis (3 mois)
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${kbisStatus.color} `}
                  >
                    {kbisStatus.label}
                  </span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <span className="text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                    Décennale
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${insuranceStatus.color} `}
                  >
                    {insuranceStatus.label}
                  </span>
                </div>
                <div className="flex justify-between text-xs items-center">
                  <span className="text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                    URSSAF (6 mois)
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${urssafStatus.color} `}
                  >
                    {urssafStatus.label}
                  </span>
                </div>
              </div>

              <div className="flex items-center text-sm text-slate-700 dark:text-slate-200 dark:text-white dark:text-white dark:text-white">
                <Phone size={14} className="mr-2" /> {partner.phone || '-'}
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD PARTNER MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
                Nouveau Partenaire
              </h3>
              <button onClick={() => setIsModalOpen(false)}>
                <X className="text-slate-700 dark:text-slate-200 dark:text-white" />
              </button>
            </div>
            <form onSubmit={handleAddSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                  Type
                </label>
                <select
                  value={newPartner.type}
                  onChange={(e) =>
                    setNewPartner({ ...newPartner, type: e.target.value as ClientType })
                  }
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                >
                  <option value="SOUS_TRAITANT">Sous-Traitant</option>
                  <option value="PARTENAIRE">Partenaire / Fournisseur</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                  Raison Sociale
                </label>
                <input
                  required
                  className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                  value={newPartner.name}
                  onChange={(e) => setNewPartner({ ...newPartner, name: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                    SIRET
                  </label>
                  <input
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                    value={newPartner.siret}
                    onChange={(e) => setNewPartner({ ...newPartner, siret: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                    TVA Intra.
                  </label>
                  <input
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                    value={newPartner.vatNumber}
                    onChange={(e) => setNewPartner({ ...newPartner, vatNumber: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                    Email
                  </label>
                  <input
                    type="email"
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                    value={newPartner.email}
                    onChange={(e) => setNewPartner({ ...newPartner, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase text-slate-700 dark:text-slate-200">
                    Téléphone
                  </label>
                  <input
                    className="w-full p-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                    value={newPartner.phone}
                    onChange={(e) => setNewPartner({ ...newPartner, phone: e.target.value })}
                  />
                </div>
              </div>
              <button className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold">
                Enregistrer
              </button>
            </form>
          </div>
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedPartner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900">
              <div className="flex items-center">
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-lg mr-3 ${selectedPartner.type === 'SOUS_TRAITANT' ? 'bg-cyan-600 text-slate-900 dark:text-white' : 'bg-amber-600 text-slate-900 dark:text-white'} `}
                >
                  {selectedPartner.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
                    {selectedPartner.name}
                  </h2>
                  <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white">
                    SIRET: {selectedPartner.siret || 'N/A'} • TVA:{' '}
                    {selectedPartner.vatNumber || 'N/A'}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    if (confirm('Supprimer ?')) {
                      onDeleteClient(selectedPartner);
                      setSelectedPartner(null);
                    }
                  }}
                  className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 p-2"
                >
                  <Trash2 size={20} />
                </button>
                <button
                  onClick={() => setSelectedPartner(null)}
                  className="text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 p-2"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* DOCUMENTS SECTION (2 Cols) */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-4 flex items-center border-b border-slate-100 pb-2">
                    <FileText size={18} className="mr-2 text-emerald-500" /> Documents Légaux &
                    Conformité
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { id: 'KBIS', label: 'Kbis (3 mois)' },
                      { id: 'URSSAF', label: 'Attestation URSSAF (6 mois)' },
                      { id: 'DECENNALE', label: 'Assurance Décennale (1 an)' },
                      { id: 'CIVILE', label: 'Responsabilité Civile (1 an)' },
                      { id: 'PROBTP', label: 'Attestation PRO BTP (6 mois)' },
                      { id: 'CIBTP', label: 'Attestation CIBTP (6 mois)' },
                      { id: 'FISCAL', label: 'Attestation Fiscale (6 mois)' },
                      { id: 'RIB', label: 'RIB Bancaire' },
                    ].map((docType) => {
                      const doc = selectedPartner.documents?.find((d) => d.type === docType.id);
                      const status = getDocStatus(selectedPartner.documents || [], docType.id);

                      return (
                        <div
                          key={docType.id}
                          className="flex flex-col p-3 border rounded-lg bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 relative hover:border-emerald-300 transition-colors"
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div className="font-bold text-sm text-slate-700 dark:text-slate-200 dark:text-white">
                              {docType.label}
                            </div>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase border ${status.color} `}
                            >
                              {status.label}
                            </span>
                          </div>

                          {doc ? (
                            <div className="flex justify-between items-end mt-auto">
                              <span className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white">
                                Exp: {new Date(doc.expiryDate || '').toLocaleDateString()}
                              </span>
                              <a
                                href={doc.url}
                                target="_blank"
                                className="p-1.5 bg-white dark:bg-slate-900 border rounded text-emerald-600 hover:text-emerald-800"
                              >
                                <ExternalLink size={14} />
                              </a>
                            </div>
                          ) : (
                            <div className="mt-auto pt-2">
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-1.5 border border-dashed border-slate-300 rounded text-xs text-slate-700 dark:text-slate-200 dark:text-white hover:bg-white dark:bg-slate-900 hover:text-emerald-600 transition-colors flex justify-center items-center"
                                onMouseEnter={() => {
                                  // Hack to pass the docType to the input change handler via a temporary variable or just set the input context
                                  // Since we use a single input, we'll just use the onClick handler logic
                                }}
                              >
                                <Upload size={12} className="mr-1" /> Ajouter
                              </button>
                              {/* Individual Input for this doc type would be cleaner, but we use a shared logic for now */}
                              <div
                                className="absolute inset-0 z-10 opacity-0 cursor-pointer"
                                onClick={() => {
                                  // Trigger global input but we need to know WHICH type
                                  // We can't pass args to onChange easily with this hidden input pattern
                                  // Better approach: State management
                                }}
                              >
                                {/* Overlay to catch click and set state before opening file dialog? */}
                              </div>
                              {/* Re-implementing specific upload button logic */}
                              <input
                                type="file"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={(e) => handleFileUpload(e, docType.id)}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* CONTRACT & INFO SECTION (1 Col) */}
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-4 flex items-center border-b border-slate-100 pb-2">
                      <Briefcase size={18} className="mr-2 text-indigo-500" /> Contrat Cadre
                    </h3>
                    <div className="space-y-4">
                      <button
                        onClick={generateContract}
                        className="w-full flex items-center justify-center py-3 border-2 border-dashed border-indigo-200 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors font-bold shadow-sm"
                      >
                        <Sparkles size={18} className="mr-2" /> Générer Contrat (IA)
                      </button>
                      <p className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white text-center leading-tight">
                        Génère un contrat PDF basé sur le modèle juridique 2022 (Art. 283-2 CGI
                        Autoliquidation).
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-4 flex items-center border-b border-slate-100 pb-2">
                      <User
                        size={18}
                        className="mr-2 text-slate-700 dark:text-slate-200 dark:text-white"
                      />{' '}
                      Coordonnées
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase">
                          Adresse
                        </label>
                        <p className="font-medium">
                          {selectedPartner.address}
                          <br />
                          {selectedPartner.zipCode} {selectedPartner.city}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase">
                          Email
                        </label>
                        <a
                          href={`mailto:${selectedPartner.email} `}
                          className="block text-emerald-600 truncate"
                        >
                          {selectedPartner.email}
                        </a>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase">
                          Téléphone
                        </label>
                        <a href={`tel:${selectedPartner.phone} `} className="block font-bold">
                          {selectedPartner.phone}
                        </a>
                      </div>
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

export default PartnersPage;
