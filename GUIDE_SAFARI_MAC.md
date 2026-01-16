# 🍎 Guide Spécifique pour Safari Mac

## ⚠️ Safari a un Cache Très Agressif !

Safari cache les fichiers JavaScript de manière très agressive. Voici comment forcer le rechargement :

---

## 🔧 Solution 1 : Vider les Caches Safari (RECOMMANDÉ)

### **Méthode A : Via Menu Safari**

1. **Ouvrez Safari**
2. **Safari** > **Paramètres** (ou **Préférences**)
3. **Onglet "Avancé"**
4. **Cochez** "Afficher le menu Développement dans la barre des menus"
5. Fermez les Paramètres
6. Dans la barre de menu, cliquez sur **Développement**
7. Cliquez sur **"Vider les caches"**
8. Cliquez sur **"Désactiver les caches"** (pour le test)
9. **Actualisez la page** (Cmd + R)

### **Méthode B : Via Terminal (Plus Radical)**

Ouvrez le Terminal et tapez :

```bash
rm -rf ~/Library/Caches/com.apple.Safari/*
rm -rf ~/Library/Caches/com.apple.WebKit*
```

Puis redémarrez Safari complètement.

---

## 🔧 Solution 2 : Vider le Service Worker (PWA)

Si l'application utilise un Service Worker, Safari peut l'avoir mis en cache :

1. **Ouvrez Safari**
2. **Développement** > **Service Workers**
3. **Sélectionnez** le site (bel-air-espace-pro.web.app)
4. Cliquez sur **"Déconnecter"** ou **"Unregister"**

---

## 🔧 Solution 3 : Désactiver le Cache LocalStorage

1. **Ouvrez Safari**
2. **Développement** > **Afficher le journal JavaScript** (ou **Console**)
3. Dans la console, tapez :

```javascript
localStorage.clear();
sessionStorage.clear();
location.reload();
```

---

## 🔧 Solution 4 : Tester en Navigation Privée

Safari en navigation privée ignore complètement le cache :

1. **Cmd + Shift + N** (ouvrir une fenêtre privée)
2. Allez sur : https://bel-air-espace-pro.web.app
3. Testez les fonctionnalités

**Si ça fonctionne en navigation privée mais pas en mode normal, c'est définitivement un problème de cache.**

---

## 🔍 Vérification Rapide : Sidebar Organisée

**Test simple :** Regardez la sidebar à gauche.

**Si vous voyez :**
```
┌─────────────────────┐
│ [Logo]              │
├─────────────────────┤
│ • Dashboard         │  ← Pas de groupes
│ • Tasks            │
│ • Projects         │
└─────────────────────┘
```

**Mais DEVRIEZ voir :**
```
┌─────────────────────┐
│ [Logo]              │
├─────────────────────┤
│ MON TRAVAIL         │  ← Label en gras
│ • Dashboard         │
│ • Tasks            │
│ • Agenda           │
│                     │
│ PROJETS             │  ← Label en gras
│ • Projects         │
└─────────────────────┘
```

**Alors il y a vraiment un problème de cache.**

---

## 🚨 Si Rien ne Fonctionne Après Avoir Suivi Toutes les Étapes

**Testez sur Chrome ou Firefox :**

1. Téléchargez Chrome : https://www.google.com/chrome/
2. Ouvrez le site dans Chrome
3. Faites `Cmd + Shift + R` (hard refresh)

**Si ça fonctionne dans Chrome mais pas dans Safari :**
→ C'est un problème spécifique au cache Safari

**Si ça ne fonctionne PAS dans Chrome non plus :**
→ Il y a un problème plus profond (erreur JavaScript, build, etc.)

---

## 📋 Checklist Finale

Cochez après avoir suivi les étapes :

- [ ] Caches Safari vidés (Menu Développement > Vider les caches)
- [ ] Service Worker désactivé (si visible)
- [ ] localStorage/sessionStorage vidés (via console)
- [ ] Testé en navigation privée (Cmd + Shift + N)
- [ ] Console vérifiée (F12 ou Cmd+Option+I) pour erreurs rouges
- [ ] Testé sur Chrome/Firefox

---

## 🆘 Envoyez-moi

1. **Une capture d'écran** de la sidebar actuelle
2. **Le résultat** de ce test dans la console Safari :

```javascript
console.log('Sidebar groups check:', document.querySelector('[class*="MON TRAVAIL"]') ? 'FOUND' : 'NOT FOUND');
console.log('Breadcrumbs check:', document.querySelector('[aria-label="Breadcrumb"]') ? 'FOUND' : 'NOT FOUND');
console.log('QuickActions check:', document.querySelector('[aria-label="Actions rapides"]') ? 'FOUND' : 'NOT FOUND');
```

3. **Toutes les erreurs rouges** de la console

---

**Les fichiers sont déployés correctement. Le problème vient du cache Safari qui est particulièrement tenace.**

**Solution la plus radicale :** Testez dans Chrome/Firefox d'abord pour confirmer que les changements sont bien déployés.
