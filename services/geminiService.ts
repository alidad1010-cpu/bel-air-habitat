
import { GoogleGenAI, Type } from "@google/genai";
import { ContactMethod, ProjectStatus, ProjectTask } from "../types";

// Initialize the Gemini AI client safely
// Checks if process is defined to avoid ReferenceError in some browser environments
const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

// Define the model to use
const MODEL_NAME = "gemini-2.5-flash";

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
    reader.onerror = error => reject(error);
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
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            clientName: { type: Type.STRING, description: "Nom complet du client" },
            clientEmail: { type: Type.STRING, description: "Email du client" },
            clientPhone: { type: Type.STRING, description: "Téléphone du client" },
            clientAddress: { type: Type.STRING, description: "Adresse du chantier" },
            projectTitle: { type: Type.STRING, description: "Titre court du projet (ex: Peinture Salon)" },
            projectDescription: { type: Type.STRING, description: "Résumé professionnel de la demande" },
            contactMethod: { type: Type.STRING, enum: ["EMAIL", "TELEPHONE", "SITE_WEB"] },
            estimatedBudget: { type: Type.NUMBER, description: "Budget estimé si mentionné, sinon 0" },
            priority: { type: Type.STRING, enum: ["Haute", "Moyenne", "Basse"], description: "Priorité déduite selon l'urgence" }
          },
          required: ["clientName", "projectTitle", "projectDescription"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");

    const data = JSON.parse(text) as ExtractedProjectData;

    // Normalize contact method if AI returns something slightly off, though enum constraint helps
    let method = ContactMethod.PHONE;
    if (data.contactMethod === 'EMAIL') method = ContactMethod.EMAIL;
    if (data.contactMethod === 'SITE_WEB') method = ContactMethod.WEBSITE;

    return {
      ...data,
      contactMethod: method
    };
  } catch (error: any) {
    console.error("AI Analysis failed:", error);

    // Handle Rate Limiting gracefully
    if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('Maximum runs')) {
      alert("⚠️ Le quota d'IA est dépassé pour la minute. Veuillez remplir manuellement ou attendre un instant.");
    }

    // Return empty fallback structure so the app doesn't crash
    return {
      clientName: "",
      clientEmail: "",
      clientPhone: "",
      clientAddress: "",
      projectTitle: "Nouvelle demande",
      projectDescription: rawText, // Keep raw text in description
      contactMethod: ContactMethod.PHONE,
      estimatedBudget: 0,
      priority: 'Moyenne'
    };
  }
};

export const parseProjectList = async (rawText: string): Promise<BulkProjectData[]> => {
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Tu es un assistant administratif BTP. Analyse cette liste brute de projets (copiée depuis Excel ou un autre logiciel) et extrais les données pour chaque ligne.
            
            Chaque projet contient potentiellement : Date début, Numéro dossier/affaire, Nom client, Type projet, Adresse, Budget, Origine, Téléphone, Compétences/Corps d'état, Date fin.
            
            Renvoie un tableau JSON strict.
            Si une date manque, laisse vide. Si budget manque, met 0.
            
            Texte brut à analyser :
            "${rawText}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              businessCode: { type: Type.STRING, description: "Numéro de dossier ou code affaire" },
              endCustomerName: { type: Type.STRING, description: "Nom du client final ou locataire" },
              projectType: { type: Type.STRING, description: "Type de projet (ex: Sinistre, Rénovation)" },
              siteAddress: { type: Type.STRING, description: "Adresse complète du chantier" },
              budget: { type: Type.NUMBER, description: "Montant du devis ou budget" },
              phone: { type: Type.STRING, description: "Numéro de téléphone du contact" },
              startDate: { type: Type.STRING, description: "Date de début format YYYY-MM-DD" },
              endDate: { type: Type.STRING, description: "Date de fin format YYYY-MM-DD" },
              description: { type: Type.STRING, description: "Description incluant l'origine, les compétences requises et détails" }
            }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as BulkProjectData[];

  } catch (error) {
    console.error("AI Bulk Import failed:", error);
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
              data: base64Data
            }
          },
          {
            text: "Analyse ce devis ou cette facture. Trouve le montant TOTAL HT (Hors Taxes). Retourne UNIQUEMENT le nombre (ex: 1500.50). Si tu ne trouves pas, retourne 0."
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amountHT: { type: Type.NUMBER, description: "Le montant total HT du document" }
          }
        }
      }
    });

    const text = response.text;
    if (!text) return null;

    const data = JSON.parse(text);
    return data.amountHT || null;

  } catch (error) {
    console.error("AI Quote Analysis failed:", error);
    return null;
  }
}

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
            
            L'email doit remercier le client, confirmer que la demande est bien prise en compte et indiquer qu'un devis ou un appel suivra sous 24h.`
    });
    return response.text || "";
  } catch (e) {
    console.warn("AI Email Gen failed", e);
    return "Bonjour,\n\nMerci pour votre demande. Nous l'avons bien reçue et revenons vers vous rapidement.\n\nCordialement,\nBel Air Habitat";
  }
}
