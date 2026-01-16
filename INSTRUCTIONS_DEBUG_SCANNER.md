# 🔍 INSTRUCTIONS DEBUG SCANNER - URGENT

**Date:** 2026-01-16  
**Problème:** Scanner ne fonctionne pas avec votre facture Leroy Merlin  
**Solution:** Logs détaillés ajoutés pour diagnostic

---

## 🎯 ÉTAPES À SUIVRE MAINTENANT

### 1. VIDER LE CACHE (CRITIQUE)
**IMPORTANT:** Sans ceci, vous aurez l'ancienne version !

- **Mac:** `Cmd + Shift + R`
- **Windows:** `Ctrl + Shift + R`

OU Navigation privée :
- `Cmd/Ctrl + Shift + N`

---

### 2. OUVRIR LA CONSOLE DU NAVIGATEUR
**Appuyez sur F12**

Vous verrez les logs détaillés du scanner.

---

### 3. TESTER LE SCANNER

1. **Ouvrir** https://bel-air-espace-pro.web.app
2. **Se connecter**
3. **Aller dans Dépenses**
4. **Garder la console F12 ouverte**
5. **Upload votre facture Leroy Merlin**
6. **Observer les logs** dans la console

---

## 📊 LOGS ATTENDUS

### Si Tout Fonctionne ✅
```
📸 Scanner: Starting analysis for facture.pdf application/pdf 234567
✅ API Key présente: AIzaSyAU2mW4N0fMFiEV...
🔄 Compression de l'image...
✅ Image compressée: 125432 bytes
✅ Base64 généré: 167243 caractères
🚀 Appel API Gemini...
📡 Envoi requête à Gemini...
📥 Réponse reçue: 200 OK
✅ Données reçues: {candidates: [...]}
📄 Texte extrait: {"docType":"Facture","date":"2026-01-13",...}
🧹 Texte nettoyé: {"docType":"Facture",...}
✅ JSON parsé: {docType: "Facture", date: "2026-01-13", ...}
🎉 Données finales: {date: "2026-01-13", merchant: "Leroy Merlin", amount: 308.55, ...}
```

---

### Si Ça Échoue ❌
Notez **EXACTEMENT** où ça s'arrête :

#### Erreur 1: API Key
```
❌ VITE_GEMINI_API_KEY not configured
```
→ **Solution:** Problème de build, les variables ne sont pas injectées

#### Erreur 2: Appel API
```
❌ API Error: 403 Forbidden
```
→ **Solution:** API key sans permission ou invalide

#### Erreur 3: Réponse Vide
```
❌ Aucun texte dans la réponse
```
→ **Solution:** L'IA n'a pas pu analyser (image floue, format incorrect)

#### Erreur 4: Parsing JSON
```
❌ Unexpected token in JSON
```
→ **Solution:** L'IA n'a pas renvoyé du JSON valide

---

## 🚀 APRÈS LE TEST

### Scénario A: Ça Fonctionne ! ✅
**Vous verrez:**
- Modal s'ouvre avec :
  - Date: 2026-01-13 ✅
  - Commerçant: Leroy Merlin ✅
  - Montant: 308.55 € ✅
  - TVA: 51.42 € ✅
  - Catégorie: Matériel ✅

**Action:** Profitez du scanner ! 🎉

---

### Scénario B: Ça Échoue Encore ❌
**Copiez-moi TOUS les logs de la console** (F12)

Exemple de ce que je veux voir :
```
📸 Scanner: Starting analysis for ...
✅ API Key présente: ...
🔄 Compression...
❌ [ICI L'ERREUR EXACTE]
```

Puis je pourrai corriger précisément le problème !

---

## 🔧 DIAGNOSTIC RAPIDE

### Test Alternatif (Page de Test)
Si l'application ne marche pas, testez :
```
https://bel-air-espace-pro.web.app/test-gemini-api.html
```

1. Cliquez "Tester API Gemini"
   - Devrait afficher "OK" ✅
   
2. Upload votre facture et cliquez "Scanner"
   - Devrait extraire les données

Si ça fonctionne ici mais pas dans l'app → problème dans le code de l'app  
Si ça ne fonctionne nulle part → problème d'API key

---

## 📋 CHECKLIST

### Avant le Test
- [ ] Cache navigateur vidé (`Cmd/Ctrl + Shift + R`)
- [ ] Console ouverte (F12)
- [ ] Connexion à l'application OK
- [ ] Page Dépenses affichée

### Pendant le Test
- [ ] Upload facture Leroy Merlin
- [ ] Observer les logs dans la console
- [ ] Noter exactement où ça s'arrête
- [ ] Copier les messages d'erreur

### Après le Test
- [ ] Me donner TOUS les logs de la console
- [ ] Me dire si une alerte s'affiche
- [ ] Me dire quel est le dernier emoji log (📸, ✅, ❌)

---

**TESTEZ MAINTENANT ET ENVOYEZ-MOI LES LOGS DE LA CONSOLE !** 🔍

**Je dois voir les logs pour identifier le problème exact !**
