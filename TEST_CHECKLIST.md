# ✅ CHECKLIST DE TEST - Guide Rapide

## 🎯 Tests Immédiats (Sans Connexion)

### 1. Page de Connexion
- [x] ✅ Version affichée : "v1.3.0 (Dark Mode & UX Overhaul)"
- [x] ✅ Pas d'erreur critique dans la console
- [x] ✅ Design glass morphism visible
- [x] ✅ Formulaire de connexion fonctionnel

---

## 🔐 Tests Après Connexion

### 2. Sidebar avec Groupes de Menus
**CRITIQUE** - C'est la modification la plus visible

- [ ] Je vois le label **"MON TRAVAIL"** en haut de la sidebar
- [ ] Je vois le label **"PROJETS"**
- [ ] Je vois le label **"RELATIONS"**
- [ ] Je vois le label **"FINANCIER"**
- [ ] Je vois le label **"SYSTÈME"**

**Comment tester:**
1. Se connecter à l'application
2. Regarder la sidebar à gauche
3. Les labels doivent être en MAJUSCULES, petits, gris clair

---

### 3. Mode Sombre/Clair
- [ ] Dans Paramètres, je vois une icône lune/soleil
- [ ] En cliquant, le thème change (fond sombre ↔ fond clair)
- [ ] Après rafraîchissement (F5), la préférence persiste
- [ ] Le thème est cohérent sur toutes les pages

**Comment tester:**
1. Aller dans Paramètres (en bas de la sidebar)
2. Chercher l'icône de thème
3. Cliquer pour basculer
4. Rafraîchir la page (F5) pour vérifier la persistance

---

### 4. Recherche Déboundée (Performance)
- [ ] Dans Clients : je tape rapidement, la recherche attend 300ms
- [ ] Dans Prospection : même comportement
- [ ] Dans Salariés : même comportement
- [ ] Pas de lag visible lors de la saisie

**Comment tester:**
1. Aller dans Clients ou Prospection
2. Taper très rapidement dans la barre de recherche (ex: "jean")
3. Observer : la liste ne se met à jour qu'après ~300ms de pause
4. Vérifier dans DevTools (F12 > Performance) : moins de calculs

---

### 5. Navigation (Toutes les Pages)
- [ ] Dashboard : charge sans erreur
- [ ] Mes Tâches : charge sans erreur
- [ ] Agenda : charge sans erreur
- [ ] Dossiers (Projets) : charge sans erreur
- [ ] Clients : charge sans erreur
- [ ] Prospection : charge sans erreur
- [ ] Partenaires : charge sans erreur
- [ ] Salariés : charge sans erreur
- [ ] Dépenses : charge sans erreur
- [ ] Administratif : charge sans erreur
- [ ] Paramètres : charge sans erreur

**Comment tester:**
1. Cliquer sur chaque élément de la sidebar
2. Vérifier que la page charge
3. Ouvrir la console (F12) pour vérifier qu'il n'y a pas d'erreur

---

### 6. Validation de Formulaires (Zod)
- [ ] Créer un nouveau projet sans remplir les champs
- [ ] Je vois des messages d'erreur de validation
- [ ] Les messages sont clairs et explicites
- [ ] Après correction, le projet se crée

**Comment tester:**
1. Aller dans Dossiers
2. Cliquer sur "+ Nouveau Dossier"
3. Essayer de sauvegarder sans remplir
4. Vérifier les messages d'erreur

---

### 7. Gestion d'Erreurs
- [ ] Essayer de se connecter avec un mauvais mot de passe
- [ ] Le message d'erreur est clair (pas de code technique)
- [ ] En mode dev, voir les logs détaillés dans la console
- [ ] Les erreurs ne cassent pas l'application

**Comment tester:**
1. Se déconnecter
2. Essayer de se connecter avec un mauvais mot de passe
3. Vérifier que le message est compréhensible
4. Ouvrir la console (F12) pour voir les logs

---

## 🔧 Tests Techniques (Console)

### 8. Console du Navigateur (F12)
- [ ] Aucune erreur rouge dans Console
- [ ] Seulement des warnings mineurs (Firebase, autocomplete)
- [ ] Vite connecté (message [vite] connected)
- [ ] React chargé correctement

**Comment tester:**
1. Appuyer sur F12
2. Aller dans l'onglet Console
3. Vérifier qu'il n'y a pas d'erreurs rouges

---

### 9. Network (Requêtes)
- [ ] Pas de requêtes en échec (erreur 4xx, 5xx)
- [ ] Firebase se connecte correctement
- [ ] Les assets se chargent rapidement

**Comment tester:**
1. F12 > Network
2. Rafraîchir la page (F5)
3. Vérifier qu'il n'y a pas de rouge

---

## 📊 Résumé des Tests

### Tests Automatiques (Code)
- [x] ✅ Build réussi (4.91s)
- [x] ✅ Déploiement Firebase réussi
- [x] ✅ 83 fichiers modifiés
- [x] ✅ Dépendances installées
- [x] ✅ Pas d'erreur de compilation

### Tests Manuels (À Faire)
Total : **0/9** ⏳

**Priorité Haute (Visuellement Important):**
1. ⏳ Sidebar avec groupes de menus
2. ⏳ Mode sombre/clair
3. ⏳ Navigation entre pages

**Priorité Moyenne (Performance):**
4. ⏳ Recherche déboundée
5. ⏳ Validation Zod
6. ⏳ Gestion d'erreurs

**Priorité Basse (Technique):**
7. ⏳ Console propre
8. ⏳ Network sans erreurs
9. ⏳ Performance générale

---

## 🚨 Si Un Test Échoue

### Sidebar pas visible ou sans groupes
1. Vider le cache : `Cmd+Shift+R` (Mac) ou `Ctrl+Shift+R` (Windows)
2. Navigation privée pour tester
3. Vérifier le fichier : `cat components/Sidebar.tsx | grep "MON TRAVAIL"`

### Mode sombre/clair ne fonctionne pas
1. Vérifier que ThemeProvider est chargé : `cat index.tsx | grep ThemeProvider`
2. Ouvrir la console et taper : `localStorage.getItem('theme')`
3. Devrait retourner "light" ou "dark"

### Recherche pas déboundée
1. Vérifier dans le code : `cat components/ClientsPage.tsx | grep useDebounce`
2. Devrait afficher : `const debouncedSearchQuery = useDebounce(searchQuery, 300);`

### Erreurs dans la console
1. Copier l'erreur exacte
2. Vérifier dans `services/errorService.ts`
3. Regarder les logs détaillés

---

## ✅ Une Fois Tous les Tests Passés

**Cochez cette case uniquement si TOUS les tests ci-dessus sont ✅**

- [ ] **TOUS LES TESTS SONT PASSÉS** 🎉

**Actions finales:**
1. Créer un commit récapitulatif des tests
2. Documenter les bugs trouvés (s'il y en a)
3. Planifier les corrections nécessaires

---

**Version:** v1.3.0  
**Date:** 2026-01-16  
**Testeur:** _______________  
**Signature:** _______________
