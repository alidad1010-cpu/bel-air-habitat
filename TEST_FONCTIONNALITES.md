# 🧪 Guide de Test des Nouvelles Fonctionnalités

## ✅ Fonctionnalités Visibles IMMÉDIATEMENT (sans action)

Ces fonctionnalités doivent être visibles **dès que vous ouvrez l'application** :

### 1. **Sidebar Organisée** ⭐ IMMÉDIATEMENT VISIBLE
**Où :** À gauche de l'écran

**Vous devriez voir :**
- Des groupes avec labels en gras :
  - **MON TRAVAIL** (Dashboard, Mes Tâches, Agenda)
  - **PROJETS** (Dossiers)
  - **RELATIONS** (Clients, Prospection, Partenaires, Salariés)
  - **FINANCIER** (Dépenses, Administratif)
  - **SYSTÈME** (Paramètres)

**Si vous ne voyez PAS ces groupes :** Il y a un problème de cache ou d'erreur JavaScript.

---

### 2. **Breadcrumbs** ⭐ IMMÉDIATEMENT VISIBLE
**Où :** En haut à gauche du header (juste après le menu mobile)

**Vous devriez voir :**
- Une icône maison (🏠)
- Un fil d'Ariane avec des chevrons (›)
- Le nom de la page actuelle (ex: "Tableau de bord")

**Si vous ne voyez PAS les breadcrumbs :** Il y a un problème.

---

### 3. **Quick Actions (FAB)** ⭐ IMMÉDIATEMENT VISIBLE
**Où :** En bas à droite de l'écran (bouton flottant vert)

**Vous devriez voir :**
- Un bouton rond vert avec un "+" au milieu
- Quand vous cliquez dessus, un menu avec :
  - Nouveau Projet
  - Nouveau Client
  - Nouvelle Dépense
  - Nouvelle Tâche

**Si vous ne voyez PAS le bouton :** Il y a un problème.

---

## 🔍 Fonctionnalités qui Nécessitent une ACTION

### 4. **Recherche Améliorée** ⚠️ NÉCESSITE DE TAPER
**Où :** Barre de recherche en haut à droite

**Pour la voir :**
1. Cliquez dans la barre de recherche
2. Tapez au moins 2 caractères (ex: "test")

**Vous devriez voir :**
- Un panneau avec "X résultats trouvés"
- Des groupes avec icônes :
  - 📋 Dossiers (X)
  - 👥 Clients (X)
  - 👷 Salariés (X)
- Un bouton "X" pour fermer

**Si vous ne voyez RIEN en tapant :** Il y a un problème.

---

### 5. **Dashboard Personnalisable** ⚠️ NÉCESSITE D'ALLER SUR LE DASHBOARD
**Où :** Sur la page Dashboard

**Pour le voir :**
1. Cliquez sur "Tableau de bord" dans la sidebar (ou Dashboard)
2. Regardez en haut à droite

**Vous devriez voir :**
- Un bouton "Personnaliser" à côté des boutons "Tâches", "List", "Map"
- Quand vous cliquez dessus :
  - Mode personnalisation avec poignées de drag & drop
  - Boutons "Visible/Masqué" sur chaque widget

**Si vous ne voyez PAS le bouton "Personnaliser" :** Il y a un problème.

---

### 6. **Graphiques** ⚠️ NÉCESSITE D'ALLER SUR LE DASHBOARD
**Où :** Sur la page Dashboard, section "Analyses & Statistiques"

**Pour les voir :**
1. Allez sur le Dashboard
2. Faites défiler jusqu'à trouver "Analyses & Statistiques"

**Vous devriez voir :**
- Deux graphiques côte à côte :
  - **Graphique de ligne** : "CA Mensuel 2025"
  - **Graphique en camembert** : "Répartition des Projets"

**OU** si pas de données :
- Messages : "Aucune donnée de CA disponible" ou "Aucun projet à afficher"

**Si vous ne voyez RIEN (pas même les messages) :** Il y a un problème.

---

## 🔧 Diagnostic si Rien ne Fonctionne

### **Étape 1 : Vérifier la Console du Navigateur**

1. Ouvrez les DevTools (F12 ou Cmd+Option+I sur Mac)
2. Allez dans l'onglet "Console"
3. Regardez s'il y a des erreurs en rouge

**Erreurs communes :**
- `Cannot find module 'ImprovedSearchResults'` → Problème d'import
- `Cannot find module 'CustomizableDashboard'` → Problème d'import
- `TypeError: ...` → Erreur JavaScript
- `ReferenceError: ...` → Variable non définie

---

### **Étape 2 : Vérifier que les Fichiers sont Chargés**

1. Ouvrez les DevTools (F12)
2. Allez dans l'onglet "Network" (Réseau)
3. Actualisez la page (F5)
4. Cherchez les fichiers JS (filtrez par "JS")

**Vous devriez voir :**
- `index-*.js` (fichier principal)
- `Dashboard-*.js` (Dashboard)
- Statut **200** (succès) pour tous

**Si vous voyez :**
- Statut **404** → Fichier manquant
- Statut **500** → Erreur serveur
- Rouge avec erreur → Problème de chargement

---

### **Étape 3 : Vérifier en Mode Développement Local**

Testez en local pour voir si ça fonctionne :

```bash
npm run dev
```

Puis ouvrez http://localhost:3000

Si ça fonctionne en local mais pas en production, c'est un problème de build/déploiement.

---

## 📋 Checklist de Vérification

Cochez ce que vous voyez :

### Immédiatement visibles (au chargement) :
- [ ] Sidebar organisée avec groupes (MON TRAVAIL, PROJETS, etc.)
- [ ] Breadcrumbs en haut à gauche
- [ ] Bouton Quick Actions (FAB) en bas à droite

### Après actions :
- [ ] Recherche améliorée (en tapant dans la recherche)
- [ ] Bouton "Personnaliser" dans le Dashboard
- [ ] Graphiques dans le Dashboard (ou messages si pas de données)

---

## 🆘 Si Rien ne Fonctionne

**Envoyez-moi :**
1. Une capture d'écran de la Console (F12 > Console)
2. Une capture d'écran de l'onglet Network (F12 > Network)
3. Le navigateur et la version que vous utilisez
4. L'URL exacte où vous testez (dev ou production)

---

**URL de production :** https://bel-air-espace-pro.web.app  
**URL de développement :** http://localhost:3000 (si vous lancez `npm run dev`)
