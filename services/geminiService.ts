import { GoogleGenAI, Type } from '@google/genai';
import { ContactMethod } from '../types';

// Initialize the Gemini AI client safely
// Checks if process is defined to avoid ReferenceError in some browser environments
const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '';
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

// Define the model to use
const MODEL_NAME = 'gemini-2.0-flash-exp';

export interface ExtractedProjectData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  clientAddress: string;
  projectTitle: string;
  projectDescription: string;
  contactMethod: ContactMethod;
  estimatedBudget: number;
  priority: 'Haute' | 'Moyenne' | 'Basse';
}

// Interface specific for Bulk Import
export interface BulkProjectData {
  businessCode: string;
  endCustomerName: string; // The specific client for this project
  siteAddress: string;
  description: string; // Includes origin, skills, etc.
  startDate: string;
  endDate: string;
  budget: number;
  phone: string;
  projectType: string;
  insurance?: string;
  skills?: string[];
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      // Remove data:image/png;base64, prefix
      const base64 = (reader.result as string).split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const extractProjectDetails = async (rawText: string): Promise<ExtractedProjectData> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Analyse cette demande brute (provenant d'un email, d'une prise de notes téléphonique ou d'un message) et extrais les informations structurées pour un dossier de chantier. 
      Si une information est manquante, laisse une chaîne vide ou 0 pour les nombres.
      Déduis la méthode de contact (EMAIL ou TELEPHONE) selon le contexte du texte.
      
      Texte brut: "${rawText}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clientName: { type: Type.STRING, description: 'Nom complet du client' },
            clientEmail: { type: Type.STRING, description: 'Email du client' },
            clientPhone: { type: Type.STRING, description: 'Téléphone du client' },
            clientAddress: { type: Type.STRING, description: 'Adresse du chantier' },
            projectTitle: {
              type: Type.STRING,
              description: 'Titre court du projet (ex: Peinture Salon)',
            },
            projectDescription: {
              type: Type.STRING,
              description: 'Résumé professionnel de la demande',
            },
            contactMethod: { type: Type.STRING, enum: ['EMAIL', 'TELEPHONE', 'SITE_WEB'] },
            estimatedBudget: {
              type: Type.NUMBER,
              description: 'Budget estimé si mentionné, sinon 0',
            },
            priority: {
              type: Type.STRING,
              enum: ['Haute', 'Moyenne', 'Basse'],
              description: "Priorité déduite selon l'urgence",
            },
          },
          required: ['clientName', 'projectTitle', 'projectDescription'],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error('No response from AI');

    const data = JSON.parse(text) as ExtractedProjectData;

    // Normalize contact method if AI returns something slightly off, though enum constraint helps
    let method = ContactMethod.PHONE;
    if (data.contactMethod === 'EMAIL') method = ContactMethod.EMAIL;
    if (data.contactMethod === 'SITE_WEB') method = ContactMethod.WEBSITE;

    return {
      ...data,
      contactMethod: method,
    };
  } catch (error: any) {
    console.error('AI Analysis failed:', error);

    // Handle Rate Limiting gracefully
    if (
      error.message?.includes('429') ||
      error.message?.includes('quota') ||
      error.message?.includes('Maximum runs')
    ) {
      alert(
        "⚠️ Le quota d'IA est dépassé pour la minute. Veuillez remplir manuellement ou attendre un instant."
      );
    }

    // Return empty fallback structure so the app doesn't crash
    return {
      clientName: '',
      clientEmail: '',
      clientPhone: '',
      clientAddress: '',
      projectTitle: 'Nouvelle demande',
      projectDescription: rawText, // Keep raw text in description
      contactMethod: ContactMethod.PHONE,
      estimatedBudget: 0,
      priority: 'Moyenne',
    };
  }
};

export const parseProjectList = async (rawText: string): Promise<BulkProjectData[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Tu es un assistant expert en extraction de données BTP.
      
      TA MISSION :
      Analyser cette liste de projets et extraire CHAQUE DOSSIER individuellement sans en inventer ni en dupliquer.
      
      FORMAT D'ENTRÉE :
      Les données sont présentées en bloc vertical de 10 lignes par projet :
      Ligne 1 : Date début
      Ligne 2 : Code affaire
      Ligne 3 : Nom Client
      Ligne 4 : Type dossier
      Ligne 5 : Adresse
      Ligne 6 : Budget
      Ligne 7 : Assurance
      Ligne 8 : Téléphone
      Ligne 9 : Compétences
      Ligne 10 : Date fin

      RÈGLES CRITIQUES :
      1. Ne crée PAS de doublons. Si tu vois 20 blocs dans le texte, renvoie 20 objets JSON différents.
      2. Le "Code affaire" est unique (ex: P0111605). Utilise-le pour ne pas confondre les dossiers.
      3. "Nom Client" est le nom de la personne (ex: DE LOYSEAU), pas "HOMELIFE".
      4. "Adresse" doit être complète.
      5. "Budget" est un nombre (convertis la virgule en point).
      
      Exemple de Sortie Attendue (JSON) :
      [
        { "businessCode": "P0111605", "endCustomerName": "DE LOYSEAU", "budget": 295.43, ... },
        { "businessCode": "P0139664", "endCustomerName": "ANDRINO FERNANDEZ", "budget": 300.00, ... }
      ]

      TEXTE À ANALYSER :
      "${rawText}"`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              businessCode: { type: Type.STRING, description: 'Code affaire' },
              endCustomerName: { type: Type.STRING, description: 'Nom' },
              projectType: { type: Type.STRING, description: 'Type de dossier' },
              siteAddress: { type: Type.STRING, description: 'Adresse Client' },
              budget: { type: Type.NUMBER, description: 'Budget intervenant' },
              phone: { type: Type.STRING, description: 'Téléphone Client' },
              insurance: { type: Type.STRING, description: 'Assurance (Origine)' },
              skills: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Compétences / Corps d'état",
              },
              startDate: { type: Type.STRING, description: 'Date début chantier (YYYY-MM-DD)' },
              endDate: { type: Type.STRING, description: 'Date fin chantier (YYYY-MM-DD)' },
              description: {
                type: Type.STRING,
                description: 'Description générée si besoin',
              },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as BulkProjectData[];
  } catch (error) {
    console.error('AI Bulk Import failed:', error);
    return [];
  }
};

export const extractQuoteAmount = async (file: File): Promise<number | null> => {
  try {
    const base64Data = await fileToBase64(file);

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data,
            },
          },
          {
            text: 'Analyse ce devis ou cette facture. Trouve le montant TOTAL HT (Hors Taxes). Retourne UNIQUEMENT le nombre (ex: 1500.50). Si tu ne trouves pas, retourne 0.',
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amountHT: { type: Type.NUMBER, description: 'Le montant total HT du document' },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    return data.amountHT || null;
  } catch (error) {
    console.error('AI Quote Analysis failed:', error);
    return null;
  }
};

export const generateEmailResponse = async (projectData: ExtractedProjectData): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Rédige un email professionnel de confirmation de réception de demande pour un artisan.
            Le ton doit être courtois, rassurant et professionnel.
            
            Informations du projet:
            Client: ${projectData.clientName}
            Projet: ${projectData.projectTitle}
            Description: ${projectData.projectDescription}
            
            L'email doit remercier le client, confirmer que la demande est bien prise en compte et indiquer qu'un devis ou un appel suivra sous 24h.`,
    });
    return response.text || '';
  } catch (e) {
    console.warn('AI Email Gen failed', e);
    return "Bonjour,\n\nMerci pour votre demande. Nous l'avons bien reçue et revenons vers vous rapidement.\n\nCordialement,\nBel Air Habitat";
  }
};

// --- NEW EXPENSE ANALYSIS ---
import { ExpenseCategory, ExpenseType } from '../types';

export interface ExtractedExpenseData {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: ExpenseCategory | string;
  type: ExpenseType;
  notes?: string;
  vat?: number;
}

import { processImageForAI } from '../utils/imageProcessor';

export const analyzeExpenseReceipt = async (file: File): Promise<ExtractedExpenseData | null> => {
  try {
    // 1. Pre-process image (HEIC -> JPG, Resize, Compress)
    const processedFile = await processImageForAI(file);
    const base64Data = await fileToBase64(processedFile);

    // Timeout de 60s pour les gros PDF
    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(
        () =>
          reject(
            new Error('Timeout: Le fichier est trop volumineux pour être traité en moins de 60s.')
          ),
        60000
      )
    );

    const response = (await Promise.race([
      ai.models.generateContent({
        model: MODEL_NAME,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: file.type,
                data: base64Data,
              },
            },
            {
              text: `Agis comme un expert comptable. Analyse ce document (Ticket ou Facture).
              Extrais les données au format JSON uniquement.
              
              Champs requis :
              - docType: "Ticket" ou "Facture"
              - date: Date au format YYYY-MM-DD
              - merchant: Nom du commerçant
              - amount: Montant total TTC (numérique)
              - vat: Montant TVA (numérique, optionnel)
              - category: Catégorie la plus probable (Carburant, Restaurant, Matériel, Loyer, Assurances, Autre)
              
              Réponds UNIQUEMENT avec le JSON valide, sans markdown.`,
            },
          ],
        },
      }),
      timeoutPromise,
    ])) as any;

    let text = response.text;
    if (!text) return null;

    // Clean Markdown code blocks if present
    text = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Define temporary interface for the raw AI response
    interface AIResponse {
      docType?: string;
      date?: string;
      merchant?: string;
      amount?: number;
      vat?: number;
      invoiceNumber?: string;
      category?: string;
      notes?: string;
    }

    const rawData = JSON.parse(text) as AIResponse;

    // Construct final data
    const finalData: ExtractedExpenseData = {
      date: rawData.date || new Date().toISOString().split('T')[0],
      merchant: rawData.merchant || 'Inconnu',
      amount: rawData.amount || 0,
      currency: 'EUR', // Default as not requested in prompt
      category: rawData.category || ExpenseCategory.OTHER,
      type: ExpenseType.VARIABLE, // Default, logic below could refine
      vat: rawData.vat || 0,
      notes: rawData.notes || '',
    };

    // Auto-enrich notes with detected metadata
    const metadata = [];
    if (rawData.docType) metadata.push(`Type: ${rawData.docType}`);
    if (rawData.invoiceNumber) metadata.push(`N°: ${rawData.invoiceNumber}`);

    if (metadata.length > 0) {
      finalData.notes = `${metadata.join(' - ')} \n ${finalData.notes}`.trim();
    }

    // Heuristic for Type (Fixed/Variable)
    const fixedCategories = [
      ExpenseCategory.RENT,
      ExpenseCategory.INSURANCE,
      'Loyer',
      'Assurances',
    ];
    if (fixedCategories.includes(finalData.category as any)) {
      finalData.type = ExpenseType.FIXED;
    }

    return finalData;
  } catch (error) {
    console.error('AI Expense Analysis failed:', error);
    return null; // Let the UI handle manual entry
  }
};

// --- PROSPECTION ANALYSIS ---

export interface ProspectNoteAnalysis {
  nextActionDate?: string; // YYYY-MM-DD
  estimatedAmount?: number;
  summary?: string;
}

export const analyzeProspectNote = async (note: string): Promise<ProspectNoteAnalysis> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Tu es un assistant commercial. Analyse cette note brute prise lors d'un échange avec un prospect.
      
      Ta mission :
      1. Détecter si une date de "Prochaine action" (rappel, rdv) est mentionnée. Si "mardi" est dit, déduis la date du prochain mardi par rapport à aujourd'hui (${new Date().toISOString().split('T')[0]}). Renvoie au format YYYY-MM-DD.
      2. Détecter si un montant estimé (budget, devis) est mentionné. Renvoie le nombre.
      3. Faire un court résumé professionnel de l'échange (1 phrase).

      Note brute : "${note}"
      `,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            nextActionDate: {
              type: Type.STRING,
              description: 'Date de la prochaine action au format YYYY-MM-DD',
            },
            estimatedAmount: { type: Type.NUMBER, description: 'Montant estimé en euros' },
            summary: { type: Type.STRING, description: "Résumé court de l'échange" },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return {};

    return JSON.parse(text) as ProspectNoteAnalysis;
  } catch (error) {
    console.warn('AI Prospect Analysis failed', error);
    return {};
  }
};

export interface BulkProspectData {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  city: string;
  status: string;
  estimatedAmount: number;
  notes: string;
}

export const parseProspectList = async (rawText: string): Promise<BulkProspectData[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Tu es un expert CRM. Analyse cette liste de prospects (issue d'un CSV ou Excel) et extrais les données structurées.
      
      Colonnes usuelles : Nom Entreprise, Nom Contact, Email, Téléphone, Ville, Statut, Montant Potentiel, Notes.
      
      Règles :
      1. Si le statut est flou, mets "NOUVEAU".
      2. Renvoie un tableau JSON strict.
      
      Données à analyser :
      "${rawText.slice(0, 30000)}" 
      `,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              companyName: { type: Type.STRING },
              contactName: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              city: { type: Type.STRING },
              status: { type: Type.STRING },
              estimatedAmount: { type: Type.NUMBER },
              notes: { type: Type.STRING },
            },
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as BulkProspectData[];
  } catch (error) {
    console.error('AI Prospect Import failed:', error);
    return [];
  }
};
