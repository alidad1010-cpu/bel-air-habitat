# 🔧 DEBUG SCANNER GEMINI - Guide de Diagnostic

**Date:** 2026-01-16  
**Problème:** "L'analyse IA a échoué ou aucune donnée n'a été trouvée"

---

## 🎯 DIAGNOSTIC EN 3 ÉTAPES

### Étape 1: Page de Test
**URL:** https://bel-air-espace-pro.web.app/test-gemini-api.html

Cette page test :
1. ✅ Vérifie que l'API key est chargée
2. ✅ Test simple de l'API Gemini
3. ✅ Test complet du scanner avec votre fichier

**Actions:**
1. Ouvrir https://bel-air-espace-pro.web.app/test-gemini-api.html
2. Cliquer sur "Tester API Gemini" (test simple)
3. Si OK → Sélectionner un fichier et cliquer "Scanner le Fichier"

---

### Étape 2: Console du Navigateur
**Ouvrir F12 → Console**

```javascript
// 1. Vérifier API Key
console.log('Gemini API:', import.meta.env.VITE_GEMINI_API_KEY);
// Devrait afficher : AIzaSyAU2mW...

// 2. Tester manuellement
const testGemini = async () => {
  const API_KEY = 'AIzaSyAU2mW4N0fMFiEVAKxGsteOjXrNjWhk8ng';
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: 'Réponds juste "OK" si tu fonctionnes.' }]
        }]
      })
    }
  );
  const data = await response.json();
  console.log('Réponse Gemini:', data);
};

testGemini();
```

**Résultat attendu:**
```json
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "OK" }]
    }
  }]
}
```

---

### Étape 3: Vérifier les Erreurs Réseau
**F12 → Network → Filtrer par "generativelanguage"**

Lors du scan, vous devriez voir:
```
Request URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=AIza...
Status: 200 OK ✅
```

**Si erreur:**
- `400 Bad Request` → Format de requête incorrect
- `401 Unauthorized` → API key invalide
- `403 Forbidden` → API key sans permissions
- `404 Not Found` → Modèle incorrect
- `429 Too Many Requests` → Quota dépassé
- `500 Server Error` → Erreur Google

---

## 🔍 CAUSES PROBABLES

### Cause 1: Modèle Incorrect
**Problème:** `gemini-2.0-flash` n'existe pas ou n'est pas accessible

**Solution:**
Essayez ces modèles dans l'ordre :
1. `gemini-2.0-flash-exp` ← NOUVEAU (testé)
2. `gemini-1.5-flash`
3. `gemini-1.5-pro`
4. `gemini-pro-vision`

**Comment tester:**
Modifiez `services/geminiService.ts` ligne 13 :
```typescript
const MODEL_NAME = 'gemini-1.5-flash'; // Au lieu de gemini-2.0-flash
```

---

### Cause 2: Format de Requête Incorrect
**Problème:** L'API @google/genai a changé de syntaxe

**Ancienne syntaxe (peut-être cassée):**
```typescript
ai.models.generateContent({
  model: MODEL_NAME,
  contents: { parts: [...] }
})
```

**Nouvelle syntaxe (corrigée):**
```typescript
const model = ai.models.get({ model: MODEL_NAME });
model.generateContent({
  contents: [{
    role: 'user',
    parts: [...]
  }]
})
```

---

### Cause 3: API Key Sans Permissions
**Problème:** La clé API n'a pas accès aux modèles Gemini

**Vérification:**
1. Aller sur https://aistudio.google.com/app/apikey
2. Vérifier que la clé `AIzaSyAU2mW...` :
   - ✅ Est active
   - ✅ A accès à "Generative Language API"
   - ✅ Pas de restriction d'application

**Solution:**
Si la clé est restreinte :
- Créer une nouvelle clé sans restriction
- OU ajouter `bel-air-espace-pro.web.app` aux domaines autorisés

---

### Cause 4: Quota Dépassé
**Problème:** Trop de requêtes déjà envoyées aujourd'hui

**Vérification:**
1. Aller sur https://console.cloud.google.com/apis/dashboard
2. Sélectionner le projet
3. Vérifier les quotas "Generative Language API"

**Free tier:**
- 15 requêtes/minute
- 1500 requêtes/jour
- 1 million tokens/jour

---

## 🛠️ SOLUTIONS

### Solution 1: Utiliser l'API REST Directement
Au lieu de `@google/genai`, utilisons fetch directement :

```typescript
// services/geminiService.ts
export const analyzeExpenseReceipt = async (file: File): Promise<ExtractedExpenseData | null> => {
  try {
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    const MODEL = 'gemini-1.5-flash'; // Modèle stable
    
    // Convert to base64
    const base64 = await fileToBase64(file);
    
    // Direct API call
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                inline_data: {
                  mime_type: file.type,
                  data: base64
                }
              },
              {
                text: `Analyse ce ticket et retourne JSON...`
              }
            ]
          }]
        })
      }
    );
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    // Parse JSON
    const parsed = JSON.parse(text.replace(/```json/g, '').replace(/```/g, ''));
    
    return {
      date: parsed.date || new Date().toISOString().split('T')[0],
      merchant: parsed.merchant || 'Inconnu',
      amount: parsed.amount || 0,
      category: parsed.category || 'Autre',
      ...
    };
  } catch (error) {
    console.error('Scanner error:', error);
    return null;
  }
};
```

---

### Solution 2: Fallback sur Modèle Stable
```typescript
const MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-flash',
  'gemini-1.5-pro',
  'gemini-pro-vision'
];

let lastWorkingModel = null;

export const analyzeExpenseReceipt = async (file: File) => {
  for (const modelName of MODELS) {
    try {
      // Essayer chaque modèle
      const result = await tryModel(modelName, file);
      lastWorkingModel = modelName;
      return result;
    } catch (e) {
      console.warn(`Model ${modelName} failed, trying next...`);
      continue;
    }
  }
  return null; // Tous les modèles ont échoué
};
```

---

### Solution 3: Meilleur Gestion d'Erreurs
```typescript
export const analyzeExpenseReceipt = async (file: File) => {
  try {
    // ... code d'analyse ...
    
  } catch (error) {
    // Log détaillé
    console.error('Scanner Error Details:', {
      message: error.message,
      stack: error.stack,
      file: file.name,
      type: file.type,
      size: file.size
    });
    
    // Message utilisateur clair
    if (error.message.includes('403')) {
      alert('⚠️ API key sans permission. Contactez l\'admin.');
    } else if (error.message.includes('429')) {
      alert('⚠️ Trop de requêtes. Attendez 1 minute.');
    } else if (error.message.includes('Timeout')) {
      alert('⚠️ Fichier trop volumineux. Essayez une image plus petite.');
    } else {
      alert('⚠️ Analyse échouée. Saisie manuelle disponible.');
    }
    
    return null;
  }
};
```

---

## 📋 CHECKLIST DE DIAGNOSTIC

### À Vérifier Maintenant
- [ ] Ouvrir https://bel-air-espace-pro.web.app/test-gemini-api.html
- [ ] Test 1: API Key affichée ?
- [ ] Test 2: "Tester API Gemini" → Réponse "OK" ?
- [ ] Test 3: Scanner avec fichier → Données extraites ?

### Si Test 1 Échoue (API Key)
- [ ] Vérifier `.env` contient VITE_GEMINI_API_KEY
- [ ] Redémarrer serveur : `npm run dev`
- [ ] Rebuild : `npm run build`

### Si Test 2 Échoue (API Simple)
- [ ] Erreur 401/403 → API key invalide/sans permission
- [ ] Erreur 404 → Modèle n'existe pas
- [ ] Erreur 429 → Quota dépassé
- [ ] Générer nouvelle clé sur https://aistudio.google.com

### Si Test 3 Échoue (Scanner)
- [ ] Fichier trop gros ? (< 5 MB recommandé)
- [ ] Format supporté ? (JPG, PNG, PDF)
- [ ] Timeout ? (essayer fichier plus petit)
- [ ] Parse JSON échoue ? (voir logs détaillés)

---

## 🚀 ACTION IMMÉDIATE

**Testez maintenant:**
```
https://bel-air-espace-pro.web.app/test-gemini-api.html
```

Cette page vous dira EXACTEMENT ce qui ne va pas ! 🔍

---

**Après le test, dites-moi les résultats des 3 tests !**
