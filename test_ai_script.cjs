const { GoogleGenAI } = require('@google/genai');

// Mocking the behavior since I can't easily npm install in this environment if it's not already there.
// Actually, the user has node_modules. I'll try to use standard fetch to avoid import issues if the package type is module.

const API_KEY = 'AIzaSyDo854ssatopFwh4Fx6RHw3bXRX6lyh0VE';
const MODEL_NAME = 'gemini-2.0-flash';

const rawText = `
Date début
Code affaire
Nom Client
Type
Adresse
Budget
Assurance
Tel
Compétence
Date fin
21/01/2026
P0126059
MME DUPONT
Initial
12 RUE DE LA PAIX 75001 PARIS
1 500,00
AXA
0600000000
Peinture
25/01/2026
`;

const prompt = `Tu es un expert en saisie de données BTP.

TA TÂCHE :
Transforme le texte ci-dessous en un tableau JSON d'objets.

LE TEXTE SOURCE :
C'est souvent un copier-coller d'Excel qui mélange les en-têtes et les données.
Les données sont souvent groupées par "Code Affaire" (ex: P0123456).
Chaque fois que tu vois un nouveau code Pxxxxxxx, c'est un nouveau chantier.

FORMAT DE SORTIE ATTENDU (JSON BRUT UNIQUEMENT) :
[
  {
    "businessCode": "Pxxxxxxx",
    "clientName": "Nom",
    "siteAddress": "Adresse",
    "budget": 1000.50,
    "phone": "06...",
    "startDate": "YYYY-MM-DD",
    "endDate": "YYYY-MM-DD",
    "description": "...",
    "skills": ["Peinture"]
  }
]

RÈGLES IMPÉRATIVES :
1. Réponds UNIQUEMENT avec le JSON. Pas de texte avant, pas de "Voici le JSON".
2. Si tu trouves plusieurs projets, mets-les tous dans le tableau.
3. Convertis les budgets en nombres (remplace la virgule par un point).
4. Si une info manque, mets null ou une chaine vide.

TEXTE INITIAL À TRAITER :
"""
${rawText}
"""`;

async function runTest() {
  console.log('Testing AI Model:', MODEL_NAME);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (data.error) {
      console.error('API Error:', data.error);
      return;
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('--- Raw AI Response ---');
    console.log(text);
    console.log('-----------------------');

    // Mimic the cleanup logic
    let cleanText = text
      .replace(/```json/g, '')
      .replace(/```/g, '')
      .trim();

    // Mimic parsing
    try {
      const firstBracket = cleanText.indexOf('[');
      const lastBracket = cleanText.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1) {
        const jsonString = cleanText.substring(firstBracket, lastBracket + 1);
        const parsed = JSON.parse(jsonString);
        console.log('SUCCESS! Parsed Projects:', parsed.length);
        console.log(JSON.stringify(parsed, null, 2));
      } else {
        console.log('FAILED to find JSON brackets.');
      }
    } catch (e) {
      console.log('Parsing Failed:', e.message);
    }
  } catch (err) {
    console.error('Network Error:', err);
  }
}

runTest();
