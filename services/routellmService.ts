/**
 * OpenRouter Service - AI API Integration
 * Alternative to Gemini for AI-powered analysis
 */

import { ContactMethod, ExpenseType } from '../types';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

interface RouteLLMMessageContent {
  type: 'text' | 'image_url';
  text?: string;
  image_url?: {
    url: string;
  };
}

interface RouteLLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | RouteLLMMessageContent[];
}

interface RouteLLMRequest {
  model: string;
  messages: RouteLLMMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
}

interface RouteLLMResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Call OpenRouter API with chat completion
 */
export const callRouteLLM = async (
  messages: RouteLLMMessage[],
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> => {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API Key not configured. Please check your environment variables.');
  }

  const payload: RouteLLMRequest = {
    model: options.model || 'openai/gpt-4o',
    messages,
    stream: false,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bel-air-habitat.web.app',
        'X-Title': 'Bel Air Habitat',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
    }

    const data: RouteLLMResponse = await response.json();

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from OpenRouter');
    }

    return data.choices[0].message.content;
  } catch (error) {
    console.error('❌ OpenRouter Error:', error);
    throw error;
  }
};

/**
 * Call RouteLLM API with streaming support
 */
export const callRouteLLMStream = async (
  messages: RouteLLMMessage[],
  onChunk: (chunk: string) => void,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<void> => {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API Key not configured');
  }

  const payload: RouteLLMRequest = {
    model: options.model || 'openai/gpt-4o',
    messages,
    stream: true,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens,
  };

  try {
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://bel-air-habitat.web.app',
        'X-Title': 'Bel Air Habitat',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API ${response.status}: ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6);
        if (data === '[DONE]') break;

        try {
          const chunk = JSON.parse(data);
          const content = chunk.choices?.[0]?.delta?.content;
          if (content) {
            onChunk(content);
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  } catch (error) {
    console.error('❌ OpenRouter Stream Error:', error);
    throw error;
  }
};

/**
 * Analyze expense receipt using RouteLLM
 */
export const analyzeExpenseWithRouteLLM = async (base64Image: string): Promise<any> => {
  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un expert comptable spécialisé dans l\'analyse de factures et tickets de caisse. Tu dois extraire les informations clés et les retourner au format JSON.',
    },
    {
      role: 'user',
      content: `Analyse cette image de facture/ticket et extrais les informations suivantes au format JSON strict:

{
  "date": "YYYY-MM-DD",
  "merchant": "Nom du commerçant",
  "amount": 0.00,
  "vat": 0.00,
  "category": "Categorie"
}

Catégories possibles: Carburant, Restaurant, Matériel, Loyer, Assurances, Télécoms, Énergie, Autre

Image (base64): ${base64Image.substring(0, 100)}...

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni texte supplémentaire.`,
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 500,
    });

    const cleanResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('❌ RouteLLM Expense Analysis Error:', error);
    throw error;
  }
};

export const analyzeProjectWithRouteLLM = async (text: string): Promise<any> => {
  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un assistant spécialisé dans l\'extraction de données de projets de construction. Tu dois extraire les informations clés et les retourner au format JSON.',
    },
    {
      role: 'user',
      content: `Analyse ce texte et extrais les informations de projet au format JSON:

${text}

Format attendu:
{
  "clientName": "Nom du client",
  "address": "Adresse complète",
  "city": "Ville",
  "postalCode": "Code postal",
  "projectType": "Type de projet",
  "estimatedAmount": 0,
  "description": "Description"
}

Réponds UNIQUEMENT avec le JSON valide.`,
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 1000,
    });

    const cleanResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('❌ RouteLLM Project Analysis Error:', error);
    throw error;
  }
};

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

export interface BulkProjectData {
  businessCode: string;
  endCustomerName: string;
  siteAddress: string;
  description: string;
  startDate: string;
  endDate: string;
  budget: number;
  phone: string;
  projectType: string;
  insurance?: string;
  skills?: string[];
}

export interface ExtractedExpenseData {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: string;
  type: ExpenseType;
  notes?: string;
  vat?: number;
}

export interface ProspectNoteAnalysis {
  nextActionDate?: string;
  estimatedAmount?: number;
  summary?: string;
}

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

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const base64Data = base64.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

const extractTextFromPDF = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const typedArray = new Uint8Array(reader.result as ArrayBuffer);
        const pdfjsLib = (window as any).pdfjsLib;

        if (!pdfjsLib) {
          reject(new Error('PDF.js library not loaded'));
          return;
        }

        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }

        resolve(fullText);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const extractProjectDetails = async (rawText: string): Promise<ExtractedProjectData> => {
  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un assistant spécialisé dans l\'extraction de données de projets de construction. Tu dois extraire les informations clés et les retourner au format JSON.',
    },
    {
      role: 'user',
      content: `Analyse ce texte et extrais les informations de projet au format JSON:

${rawText}

Format attendu:
{
  "clientName": "Nom du client",
  "clientEmail": "email@example.com",
  "clientPhone": "0123456789",
  "clientAddress": "Adresse complète",
  "projectTitle": "Titre du projet",
  "projectDescription": "Description détaillée",
  "contactMethod": "EMAIL ou PHONE ou VISIT",
  "estimatedBudget": 0,
  "priority": "Haute ou Moyenne ou Basse"
}

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni texte supplémentaire.`,
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 1000,
    });

    const cleanResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const data = JSON.parse(cleanResponse);

    return {
      clientName: data.clientName || '',
      clientEmail: data.clientEmail || '',
      clientPhone: data.clientPhone || '',
      clientAddress: data.clientAddress || '',
      projectTitle: data.projectTitle || '',
      projectDescription: data.projectDescription || '',
      contactMethod: data.contactMethod || 'EMAIL',
      estimatedBudget: data.estimatedBudget || 0,
      priority: data.priority || 'Moyenne',
    };
  } catch (error) {
    console.error('❌ RouteLLM Project Extraction Error:', error);
    throw error;
  }
};

export const parseProjectList = async (rawText: string): Promise<BulkProjectData[]> => {
  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un expert en extraction de données de projets de construction à partir de listes ou tableaux. Tu dois retourner un tableau JSON de projets.',
    },
    {
      role: 'user',
      content: `Analyse ce texte contenant une liste de projets et extrais chaque projet au format JSON.

Texte: "${rawText}"

Format JSON attendu (tableau de projets):
[
  {
    "businessCode": "Code affaire",
    "endCustomerName": "Nom du client final",
    "siteAddress": "Adresse du chantier",
    "description": "Description du projet",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "budget": 0,
    "phone": "0123456789",
    "projectType": "Type de projet",
    "insurance": "Assurance si mentionnée",
    "skills": ["Compétence1", "Compétence2"]
  }
]

Réponds UNIQUEMENT avec le tableau JSON valide, sans markdown ni texte supplémentaire.`,
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 4000,
    });

    const cleanResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('❌ RouteLLM Project List Parsing Error:', error);
    throw error;
  }
};

export const extractQuoteAmount = async (file: File): Promise<number | null> => {
  const base64 = await fileToBase64(file);
  const mimeType = file.type || 'image/jpeg';

  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un expert en analyse de devis. Tu dois extraire le montant total du devis et le retourner au format JSON.',
    },
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: `Analyse cette image de devis et extrais le montant total au format JSON:

{
  "amount": 0.00
}

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni texte supplémentaire.`,
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${base64}`,
          },
        },
      ],
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 200,
    });

    const cleanResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    const data = JSON.parse(cleanResponse);
    return data.amount || null;
  } catch (error) {
    console.error('❌ RouteLLM Quote Extraction Error:', error);
    return null;
  }
};

export const generateEmailResponse = async (projectData: any): Promise<string> => {
  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un assistant commercial pour Bel Air Habitat, une entreprise de construction. Tu dois générer des emails professionnels et chaleureux.',
    },
    {
      role: 'user',
      content: `Génère un email de réponse professionnel pour ce projet:

Client: ${projectData.clientName}
Projet: ${projectData.projectTitle}
Description: ${projectData.projectDescription}
Budget estimé: ${projectData.estimatedBudget}€

L'email doit:
- Remercier le client pour sa demande
- Confirmer la réception de sa demande
- Mentionner qu'un expert va le contacter sous 48h
- Proposer un rendez-vous si nécessaire
- Être signé "L'équipe Bel Air Habitat"

Réponds UNIQUEMENT avec le texte de l'email, sans objet ni formatage markdown.`,
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.7,
      maxTokens: 500,
    });

    return response.trim();
  } catch (error) {
    console.error('❌ RouteLLM Email Generation Error:', error);
    throw error;
  }
};

export const analyzeExpenseReceipt = async (file: File): Promise<ExtractedExpenseData | null> => {
  const isPDF = file.type === 'application/pdf';

  console.log(`📄 Analyzing ${isPDF ? 'PDF' : 'image'} receipt:`, file.name, file.type);

  let messages: RouteLLMMessage[];

  if (isPDF) {
    try {
      const pdfText = await extractTextFromPDF(file);
      console.log('📝 Extracted PDF text (first 500 chars):', pdfText.substring(0, 500));
      console.log('📝 Full PDF text length:', pdfText.length, 'characters');

      messages = [
        {
          role: 'system',
          content: 'Tu es un expert comptable français. Tu DOIS extraire les informations d\'une facture et retourner UNIQUEMENT un objet JSON valide, sans aucun texte supplémentaire.',
        },
        {
          role: 'user',
          content: `Analyse ce texte de facture et retourne UNIQUEMENT le JSON suivant (sans markdown, sans \`\`\`, sans texte avant ou après):

{
  "date": "YYYY-MM-DD",
  "merchant": "Nom du commerçant",
  "amount": 0.00,
  "currency": "EUR",
  "category": "Categorie",
  "type": "VARIABLE",
  "vat": 0.00,
  "notes": "Description"
}

RÈGLES STRICTES:
1. "date": Cherche la date (DD/MM/YYYY, DD-MM-YYYY, etc.) et convertis en YYYY-MM-DD
2. "merchant": Nom du magasin/restaurant (souvent en haut)
3. "amount": Montant TOTAL TTC (cherche "TOTAL", "TOTAL TTC", "À PAYER", "NET À PAYER")
4. "currency": Toujours "EUR"
5. "category": Choisis parmi: Carburant, Restaurant, Matériel, Loyer, Assurances, Télécoms, Énergie, Autre
6. "type": "FIXED" pour Loyer/Assurances, "VARIABLE" pour le reste
7. "vat": TVA si indiquée (cherche "TVA", "T.V.A")
8. "notes": Liste des articles principaux

TEXTE:
${pdfText}

RÉPONDS UNIQUEMENT AVEC LE JSON, RIEN D'AUTRE.`,
        },
      ];
    } catch (error) {
      console.error('❌ PDF extraction error:', error);
      return null;
    }
  } else {
    const base64 = await fileToBase64(file);
    const mimeType = file.type || 'image/jpeg';
    console.log('📸 Image base64 length:', base64.length, 'characters');
    console.log('📸 Image MIME type:', mimeType);

    messages = [
      {
        role: 'system',
        content: 'Tu es un expert comptable français. Tu DOIS extraire les informations d\'une facture et retourner UNIQUEMENT un objet JSON valide, sans aucun texte supplémentaire.',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Analyse cette image de facture/ticket et retourne UNIQUEMENT le JSON suivant (sans markdown, sans \`\`\`, sans texte avant ou après):

{
  "date": "YYYY-MM-DD",
  "merchant": "Nom du commerçant",
  "amount": 0.00,
  "currency": "EUR",
  "category": "Categorie",
  "type": "VARIABLE",
  "vat": 0.00,
  "notes": "Description"
}

RÈGLES STRICTES:
1. "date": Cherche la date sur le ticket (DD/MM/YYYY, DD-MM-YYYY, etc.) et convertis en YYYY-MM-DD
2. "merchant": Nom du magasin/restaurant en haut du ticket
3. "amount": Montant TOTAL TTC (cherche "TOTAL", "TOTAL TTC", "À PAYER")
4. "currency": Toujours "EUR"
5. "category": Choisis parmi: Carburant, Restaurant, Matériel, Loyer, Assurances, Télécoms, Énergie, Autre
6. "type": "FIXED" pour Loyer/Assurances, "VARIABLE" pour le reste
7. "vat": TVA si visible
8. "notes": Liste des articles principaux

RÉPONDS UNIQUEMENT AVEC LE JSON, RIEN D'AUTRE.`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${base64}`,
            },
          },
        ],
      },
    ];
  }

  try {
    console.log('📸 Calling RouteLLM API for receipt analysis...');
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.1,
      maxTokens: 1000,
    });

    console.log('📄 Raw API response:', response);
    console.log('📄 Response length:', response.length, 'characters');

    let cleanResponse = response.trim();

    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      console.log('🧹 Removed markdown code blocks');
    }

    if (cleanResponse.startsWith('```')) {
      cleanResponse = cleanResponse.replace(/```/g, '').trim();
      console.log('🧹 Removed generic code blocks');
    }

    const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      cleanResponse = jsonMatch[0];
      console.log('🧹 Extracted JSON from response');
    }

    console.log('🧹 Final cleaned response:', cleanResponse);

    const data = JSON.parse(cleanResponse);
    console.log('✅ Successfully parsed JSON:', data);

    const fixedCategories = ['Loyer', 'Assurances'];
    const expenseType = fixedCategories.includes(data.category) ? ExpenseType.FIXED : ExpenseType.VARIABLE;

    const result = {
      date: data.date || new Date().toISOString().split('T')[0],
      merchant: data.merchant || 'Inconnu',
      amount: parseFloat(data.amount) || 0,
      currency: data.currency || 'EUR',
      category: data.category || 'Autre',
      type: expenseType,
      vat: parseFloat(data.vat) || 0,
      notes: data.notes || data.description || '',
    };

    console.log('✅ Final expense data:', result);
    return result;
  } catch (error) {
    console.error('❌ RouteLLM Expense Analysis Error:', error);
    console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
    return null;
  }
};

export const analyzeProspectNote = async (note: string): Promise<ProspectNoteAnalysis> => {
  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un assistant commercial. Tu dois analyser des notes de prospection et extraire les informations clés.',
    },
    {
      role: 'user',
      content: `Analyse cette note brute prise lors d'un échange avec un prospect.

Ta mission :
1. Détecter si une date de "Prochaine action" (rappel, rdv) est mentionnée. Si "mardi" est dit, déduis la date du prochain mardi par rapport à aujourd'hui (${new Date().toISOString().split('T')[0]}). Renvoie au format YYYY-MM-DD.
2. Détecter si un montant estimé (budget, devis) est mentionné. Renvoie le nombre.
3. Faire un court résumé professionnel de l'échange (1 phrase).

Note brute : "${note}"

Format JSON attendu:
{
  "nextActionDate": "YYYY-MM-DD ou null",
  "estimatedAmount": 0 ou null,
  "summary": "Résumé court"
}

Réponds UNIQUEMENT avec le JSON valide, sans markdown ni texte supplémentaire.`,
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 300,
    });

    const cleanResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('❌ RouteLLM Prospect Note Analysis Error:', error);
    return {};
  }
};

export const parseProspectList = async (rawText: string): Promise<BulkProspectData[]> => {
  const messages: RouteLLMMessage[] = [
    {
      role: 'system',
      content: 'Tu es un expert CRM. Tu dois analyser des listes de prospects et extraire les données structurées.',
    },
    {
      role: 'user',
      content: `Analyse cette liste de prospects (issue d'un CSV ou Excel) et extrais les données structurées.

Colonnes usuelles : Nom Entreprise, Nom Contact, Email, Téléphone, Ville, Statut, Montant Potentiel, Notes.

Règles :
1. Si le statut est flou, mets "NOUVEAU".
2. Renvoie un tableau JSON strict.

Données à analyser :
"${rawText.slice(0, 30000)}"

Format JSON attendu:
[
  {
    "companyName": "Nom entreprise",
    "contactName": "Nom contact",
    "email": "email@example.com",
    "phone": "0123456789",
    "city": "Ville",
    "status": "NOUVEAU",
    "estimatedAmount": 0,
    "notes": "Notes"
  }
]

Réponds UNIQUEMENT avec le tableau JSON valide, sans markdown ni texte supplémentaire.`,
    },
  ];

  try {
    const response = await callRouteLLM(messages, {
      model: 'openai/gpt-4o',
      temperature: 0.3,
      maxTokens: 4000,
    });

    const cleanResponse = response
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    return JSON.parse(cleanResponse);
  } catch (error) {
    console.error('❌ RouteLLM Prospect List Parsing Error:', error);
    return [];
  }
};
