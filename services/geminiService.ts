import { GoogleGenAI, Type } from '@google/genai';
import { ContactMethod } from '../types';

// Initialize the Gemini AI client safely
// Checks if process is defined to avoid ReferenceError in some browser environments
const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY || '';
};

// Create AI client
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

// --- FALLBACK PARSER (Regex/Heuristic) ---
const parseFallback = (text: string): BulkProjectData[] => {
  const projects: BulkProjectData[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l);

  // Pattern for Code Affaire: P followed by 5-9 digits, flexible spaces
  const codeRegex = /(P\s?\d{5,9})/i;
  // Pattern for Date: DD/MM/YYYY or DD/MM/YY or YYYY-MM-DD (supports dots and spaces) with boundaries
  const dateRegexGlobal =
    /((\b\d{4}[\/\s.-]\d{2}[\/\s.-]\d{2}\b)|(\b\d{2}[\/\s.-]\d{2}[\/\s.-]\d{2,4}\b))/g;
  // Pattern for Phone: 06 12 34 56 78 or similar
  const phoneRegex = /(0[1-9][\s.]?(\d{2}[\s.]?){4})/;
  // Pattern for Budget: digits with comma/dot
  const budgetRegex = /(\d{1,7}[,.]\d{2})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check if line CONTAINS a code
    const codeMatch = line.match(codeRegex);
    if (codeMatch) {
      const rawCode = codeMatch[0];
      const code = rawCode.replace(/\s/g, '').toUpperCase();

      let startDate = '';
      let endDate = '';
      let phone = '';
      let budget = 0;
      let clientName = 'Client Inconnu';
      let siteAddress = '';
      let projectType = 'Chantier';
      let skills: string[] = [];

      // --- STRATEGY A: HORIZONTAL ROW (Excel Copy-Paste) ---
      // If the line is long and contains other indicators, parse the LINE itself.
      const isHorizontal =
        line.length > 30 &&
        (dateRegexGlobal.test(line) || phoneRegex.test(line) || budgetRegex.test(line));

      if (isHorizontal) {
        // 1. Extract Dates from line
        const datesFound = line.match(dateRegexGlobal);
        if (datesFound) {
          if (datesFound.length > 0) startDate = datesFound[0];
          // If 2 dates found, the second is EndDate.
          if (datesFound.length > 1) endDate = datesFound[1];
        }

        // 2. Extract Phone from line
        const phoneMatch = line.match(phoneRegex);
        if (phoneMatch) phone = phoneMatch[0];

        // 3. Extract Budget from line
        // Be careful not to mix with phone numbers. Budget usually has decimal ,00
        // Simple heuristic: look for "300,00" or "3 024,29"
        const budgetMatch = line.match(budgetRegex);
        if (budgetMatch) {
          const val = parseFloat(budgetMatch[0].replace(',', '.'));
          if (!isNaN(val)) budget = val;
        }

        // 4. Smart parsing of the remaining text (Name, Address, Type, Skills)
        let cleanerLine = line
          .replace(rawCode, '')
          .replace(datesFound ? datesFound[0] : '', '') // Remove Start Date
          .replace(datesFound && datesFound.length > 1 ? datesFound[1] : '', '') // Remove End Date
          .replace(phoneMatch ? phoneMatch[0] : '', '')
          .replace(budgetMatch ? budgetMatch[0] : '', '');

        // Split by tabs or multiple spaces
        const parts = cleanerLine
          .split(/(\t|\s{2,})/)
          .map((p) => p.trim())
          .filter((p) => p.length > 1 && !/^\s*$/.test(p));

        // Loop through parts to categorize
        parts.forEach((part) => {
          const lower = part.toLowerCase();

          // FILTER: Ignore useless words requested by user ("Annule et remplace", "Initiale")
          if (lower.includes('annule') || lower.includes('initial') || lower.includes('remplace')) {
            return;
          }

          // Check for Type
          if (/sinistre|renovation/i.test(part)) {
            projectType = part;
            return;
          }

          // Check for Address (Zip Code or Street keyword)
          if (
            /\d{5}/.test(part) ||
            /\b(rue|avenue|bd|boulevard|allée|impasse|place)\b/i.test(part)
          ) {
            siteAddress = part;
            return;
          }

          // Check for Skills (comma separated list or known skills)
          if (part.includes(',') || /\b(peinture|sol|plomberie|elec|menuiserie)\b/i.test(part)) {
            // If it looks like a list or specific skill, treat as skills
            // But be careful not to mistake " Rue de la Paix, Paris" for skills
            if (!/\d{5}/.test(part) && !/\b(rue|avenue)\b/i.test(part)) {
              skills = part.split(',').map((s) => s.trim());
              return;
            }
          }

          // Default: Assume Name if it's the first unknown part or looks like a name
          if (clientName === 'Client Inconnu') {
            clientName = part;
          }
        });
      } else {
        // --- STRATEGY B: VERTICAL BLOCK (Mobile/Email Copy) ---
        // Local regex must match global pattern logic;
        const localDateRegex =
          /((\b\d{4}[\/\s.-]\d{2}[\/\s.-]\d{2}\b)|(\b\d{2}[\/\s.-]\d{2}[\/\s.-]\d{2,4}\b))/;

        // 1. Look for explicit date in surrounding lines (Start Date)
        if (i > 0 && localDateRegex.test(lines[i - 1])) {
          const match = lines[i - 1].match(localDateRegex);
          if (match) startDate = match[0];
        }

        // 2. Client Name is usually the NEXT line
        if (i < lines.length - 1) {
          if (!localDateRegex.test(lines[i + 1]) && !codeRegex.test(lines[i + 1])) {
            clientName = lines[i + 1];
          }
        }

        // 3. Search downwards for Budget, Address, Phone, AND End Date
        for (let j = 1; j <= 12; j++) {
          if (i + j >= lines.length) break;
          const l = lines[i + j];

          // Stop if we hit next project code
          if (codeRegex.test(l)) break;

          // Check for End Date (Second date found in block)
          if (localDateRegex.test(l)) {
            const dMatch = l.match(localDateRegex);
            // If we found a date
            if (dMatch) {
              // Check if it's diff from startDate to be sure it's endDate (or just the second date found)
              // Simple logic: if startDate is empty, it fills startDate?
              // Actually in vertical block strategy, startDate is usually ABOVE the P-Code.
              // So any date BELOW is likely EndDate.
              endDate = dMatch[0];
            }
          }

          // Check for Budget
          if (!budget && /^[\d\s]+,\d{2}$/.test(l)) {
            const clean = parseFloat(l.replace(/\s/g, '').replace(',', '.'));
            if (!isNaN(clean) && clean > 0) budget = clean;
          }

          // Check for Project Type
          if (
            /Sinistre|Renovation|SAV/i.test(l) &&
            !localDateRegex.test(l) &&
            !budgetRegex.test(l)
          ) {
            projectType = l;
          }

          // Check for Address
          if (
            !siteAddress &&
            (/\d{5}/.test(l) || /(RUE|AVENUE|BD|BOULEVARD|ALLÉE|IMPASSE|PLACE)/i.test(l))
          ) {
            siteAddress = l;
          }

          // Check for Phone
          if (!phone && phoneRegex.test(l)) {
            const pMatch = l.match(phoneRegex);
            if (pMatch) phone = pMatch[0];
          }
        }
      }

      // Smart Date Deduction (Backfill if missing)
      if (!startDate && code.length >= 5) {
        const monthStr = code.substring(1, 3);
        const yearStr = code.substring(3, 5);
        if (!isNaN(parseInt(monthStr)) && !isNaN(parseInt(yearStr))) {
          startDate = `01/${monthStr}/20${yearStr}`;
        }
      }

      projects.push({
        businessCode: code,
        endCustomerName: clientName,
        startDate: startDate || new Date().toLocaleDateString('fr-FR'),
        endDate: endDate, // Use the extracted endDate
        budget: budget,
        siteAddress: siteAddress || 'Adresse à vérifier',
        skills: skills,
        phone: phone,
        description: isHorizontal ? 'Importé (Ligne)' : 'Importé (Bloc)',
        projectType: projectType,
        insurance: '',
      });
    }
  }
  return projects;
};

// --- MERGED EXPORT FOR AI + FALLBACK ---
export const parseProjectList = async (rawText: string): Promise<BulkProjectData[]> => {
  let aiProjects: BulkProjectData[] = [];
  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Tu es un expert en saisie de données BTP.
      
      TA TÂCHE :
      Transforme le texte ci-dessous en un tableau JSON d'objets.
      
      LE TEXTE SOURCE :
      Le format peut être :
      1. Tableau Horizontal (copier-coller Excel) : Une ligne = Un chantier.
      2. Blocs Verticaux : Données listées les unes sous les autres.
      
      REPÈRES IMPORTANTS : 
      - "Code Affaire" (Pxxxxxxx).
      
      FORMAT DE SORTIE ATTENDU (JSON BRUT UNIQUEMENT) :
      [
        {
          "businessCode": "P0124xx",
          "endCustomerName": "Nom Client",
          "startDate": "dd/mm/yyyy",
          "endDate": "dd/mm/yyyy",
          "siteAddress": "Adresse...",
          "budget": 1200.50,
          "phone": "06...",
          "projectType": "Sinistre/Renovation",
          "description": "...",
          "skills": ["Peinture", "Sol"]
        }
      ]
      
      RÈGLES IMPÉRATIVES :
      1. Réponds UNIQUEMENT avec le JSON. Pas de texte avant, pas de "Voici le JSON".
      2. Si tu trouves plusieurs projets, mets-les tous dans le tableau (un objet par projet).
      3. Convertis les budgets en nombres (remplace la virgule par un point).
      4. Extrais scrupuleusement les dates de début et de fin si présentes.
      5. IGNORE les termes inutiles comme "Annule et remplace" ou "Initiale" (ne les mets pas dans description ou type).
      6. Si une info manque, mets null ou une chaine vide.
      
      TEXTE INITIAL À TRAITER :
      """
      ${rawText.slice(0, 30000)}
      """`,
    });

    let text = response.text;
    if (text) {
      text = text
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const firstBracket = text.indexOf('[');
      const lastBracket = text.lastIndexOf(']');

      if (firstBracket !== -1 && lastBracket !== -1) {
        const jsonString = text.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(jsonString);
        if (Array.isArray(parsed)) {
          aiProjects = parsed.map((p: any) => ({
            businessCode: p.businessCode || '',
            endCustomerName: p.clientName || p.endCustomerName || 'Client Inconnu',
            siteAddress: p.siteAddress || '',
            description: p.description || '',
            startDate: p.startDate || '',
            endDate: p.endDate || '',
            budget:
              typeof p.budget === 'number'
                ? p.budget
                : parseFloat(
                    (p.budget || '0')
                      .toString()
                      .replace(',', '.')
                      .replace(/[^\d.-]/g, '')
                  ) || 0,
            phone: p.phone || '',
            projectType: p.projectType || '', // Allow empty to let fallback mechanics works if needed (though mapped to Folder Type)
            insurance: p.insurance || '',
            skills: p.skills || [],
          }));
        }
      }
    }
  } catch (error) {
    console.warn('AI Bulk Import failed, switching to fallback:', error);
  }

  // Double Check: Run fallback parser to capture specific strict data
  const fallbackProjects = parseFallback(rawText);

  // If AI failed completely, return fallback
  if (aiProjects.length === 0) {
    console.log('AI returned 0 projects. Using fallback parser.');
    return fallbackProjects;
  }

  // MERGE: Enrich AI results with Fallback precisions (specifically Dates, Type, Address)
  return aiProjects.map((aiProj) => {
    const match = fallbackProjects.find((fp) => fp.businessCode === aiProj.businessCode);

    // Initial merge logic
    let finalProject = match
      ? {
          ...aiProj,
          // Prioritize Regex Type if detected (it catches "Annule", "Initial" etc)
          projectType:
            match.projectType && match.projectType !== 'Chantier'
              ? match.projectType
              : aiProj.projectType || match.projectType,
          // Prioritize Regex Dates if AI is empty or weird
          startDate: aiProj.startDate || match.startDate,
          endDate: aiProj.endDate || match.endDate,
          // Prioritize Regex Budget if AI missed it
          budget: aiProj.budget || match.budget,
          // Prioritize Regex Address if AI missed it
          siteAddress: aiProj.siteAddress || match.siteAddress,
          // Merge skills
          skills: [...new Set([...(aiProj.skills || []), ...(match.skills || [])])],
        }
      : aiProj;

    // --- STRICT CLEANING STEP ---
    const forbiddenTerms = ['annule', 'initial', 'remplace'];

    // Helper to check if string contains forbidden terms (case insensitive)
    const containsForbidden = (str: string) =>
      forbiddenTerms.some((term) => str.toLowerCase().includes(term));
    // Helper to clean a string from forbidden terms
    const cleanString = (str: string) => {
      let result = str;
      forbiddenTerms.forEach((term) => {
        const reg = new RegExp(term, 'gi');
        result = result.replace(reg, '');
      });
      return result.trim();
    };

    // 1. Clean Address specially
    if (finalProject.siteAddress && containsForbidden(finalProject.siteAddress)) {
      // If the address is JUST "Annule et remplace" or close to it, clear it.
      if (finalProject.siteAddress.length < 25 && containsForbidden(finalProject.siteAddress)) {
        finalProject.siteAddress = '';
      } else {
        // Otherwise, just remove the word
        finalProject.siteAddress = cleanString(finalProject.siteAddress);
      }
    }

    // 2. Clean Name
    if (finalProject.endCustomerName && containsForbidden(finalProject.endCustomerName)) {
      finalProject.endCustomerName = cleanString(finalProject.endCustomerName);
    }

    // 3. Clean Description
    if (finalProject.description && containsForbidden(finalProject.description)) {
      finalProject.description = cleanString(finalProject.description);
    }

    return finalProject;
  });
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
    console.log('📸 Scanner: Starting analysis for', file.name, file.type, file.size);
    
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    
    if (!API_KEY) {
      console.error('❌ VITE_GEMINI_API_KEY not configured');
      alert('⚠️ Scanner: API Key non configurée. Vérifiez la configuration.');
      return null;
    }

    console.log('✅ API Key présente:', API_KEY.substring(0, 20) + '...');

    // 1. Pre-process image (HEIC -> JPG, Resize, Compress)
    console.log('🔄 Compression de l\'image...');
    const processedFile = await processImageForAI(file);
    console.log('✅ Image compressée:', processedFile.size, 'bytes');
    
    const base64Data = await fileToBase64(processedFile);
    console.log('✅ Base64 généré:', base64Data.length, 'caractères');

    // 2. Direct REST API call (plus fiable que le SDK)
    console.log('🚀 Appel API Gemini...');
    
    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout: 60s dépassé')), 60000)
    );

    const apiCall = async () => {
      // Utiliser gemini-flash-latest (stable et supporte les images)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`;
      
      const body = {
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: processedFile.type,
                data: base64Data
              }
            },
            {
              text: `Tu es un expert comptable. Analyse ce ticket ou cette facture.

Retourne SEULEMENT un objet JSON avec ces champs (PAS de markdown, PAS d'explication):
{
  "date": "YYYY-MM-DD",
  "merchant": "nom du commerçant",
  "amount": montant_decimal,
  "vat": montant_tva_ou_null,
  "category": "Matériel"
}

Si tu ne trouves pas une donnée, mets une valeur par défaut cohérente.`
            }
          ]
        }]
      };
      
      console.log('📡 Envoi à Gemini 1.5 Flash...');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      console.log('📥 Réponse:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Erreur API:', errorText);
        throw new Error(`API ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const data = await response.json();
      console.log('✅ Réponse complète:', data);
      return data;
    };
    
    const response = await Promise.race([apiCall(), timeoutPromise]) as any;

    // Extract text from REST API response
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('📄 Texte extrait:', text);
    
    if (!text) {
      console.error('❌ Aucun texte dans la réponse:', response);
      alert('⚠️ Scanner: Réponse vide de l\'IA. Essayez avec une image plus claire.');
      return null;
    }

    // Clean Markdown code blocks if present
    const cleanText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    console.log('🧹 Texte nettoyé:', cleanText);

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

    const rawData = JSON.parse(cleanText) as AIResponse;
    console.log('✅ JSON parsé:', rawData);

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

    console.log('🎉 Données finales:', finalData);
    return finalData;
  } catch (error: any) {
    console.error('❌ Scanner Error Details:', {
      message: error.message,
      stack: error.stack,
      file: file.name,
      type: file.type,
      size: file.size
    });
    
    // Message utilisateur clair selon le type d'erreur
    if (error.message?.includes('403')) {
      alert('⚠️ Scanner: API key sans permission. Vérifiez les autorisations.');
    } else if (error.message?.includes('429')) {
      alert('⚠️ Scanner: Trop de requêtes. Attendez 1 minute et réessayez.');
    } else if (error.message?.includes('Timeout')) {
      alert('⚠️ Scanner: Fichier trop volumineux. Essayez une image plus petite (< 5 MB).');
    } else if (error.message?.includes('JSON')) {
      alert('⚠️ Scanner: Erreur de parsing. L\'IA a renvoyé un format inattendu.');
    } else {
      alert(`⚠️ Scanner: ${error.message || 'Erreur inconnue'}. Saisie manuelle disponible.`);
    }
    
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
