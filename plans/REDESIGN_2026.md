# Bel Air Habitat — Complete App Redesign Plan 2026

## Vision
Transform the current renovation management app into a **modern, AI-powered, 2026-grade SaaS platform** for renovation professionals. Keep all existing Firebase data intact.

## Current State
- React + TypeScript + Vite + Firebase (Firestore, Auth, Hosting)
- 30+ components, ~92K chars App.tsx monolith
- Tailwind CSS with mixed old/new styles
- AI services: Gemini, OpenRouter, RouteLLM already integrated
- Data: projects, clients, employees, expenses, prospects, attendance

---

## Phase 1: Complete Visual Overhaul (Every Page)

### Design System
- **Font**: Inter (already added)
- **Primary**: Teal #0d9488 (renovation/habitat)
- **Accent**: Amber #d97706 (warmth/CTA)
- **Neutral**: Slate scale
- **Radius**: 12-16px (modern rounded)
- **Shadows**: Subtle, layered (no neon glows)
- **Cards**: White bg, thin border, soft shadow — NO heavy gradients

### Pages Redesigned
1. **LoginPage** ✅ Done (previously)
2. **Sidebar** ✅ Done (previously, remove Devis & Factures)
3. **Dashboard** ✅ Done — Complete rewrite with modern stat cards, AI insights widget, pipeline overview, renovation progress cards, financial summary, quick actions bar
4. **ClientsPage** ✅ Done — Modern card grid with avatars, type badges, stats, clean search/filters
5. **EmployeesPage** ✅ Done — Modern header, clean tab switcher, updated form styles
6. **ExpensesPage** ✅ Done — Clean stat cards, modern header, updated upload area
7. **ProspectionPage** ✅ Done — Clean header, pipeline design already good
8. **AgendaPage** ✅ Already clean design
9. **TasksPage** ✅ Done — Modern header, clean tab switcher
10. **PartnersPage** ✅ Done — Modern header, clean search/filters wrapper
11. **SettingsPage** ✅ Already clean (no old patterns)
12. **ProjectDetail** — Phase timeline, material tracker (future enhancement)

---

## Phase 2: AI-Powered Features for Renovation

### AI Assistant (Chat Widget)
- ✅ **Done** — Floating chat bubble on every page (`AIChatWidget.tsx`)
- Uses OpenRouter (GPT-4o-mini) via existing `callRouteLLM`
- Context-aware: knows current page and user name
- Quick action buttons for common queries
- French language, renovation-focused system prompt
- Expandable/collapsible panel with clean design

### Smart Features
1. ✅ **AI Insights Widget** — Dashboard widget auto-generates insights (late projects, callbacks, conversion rate, budget tracking)
2. **AI Project Summary** — Auto-generate project status reports (future)
3. **Smart Expense Categorization** — AI auto-categorizes scanned receipts (existing Gemini integration)
4. **Client Communication Drafts** — AI writes emails/SMS for follow-ups (existing OpenRouter integration)
5. **Renovation Cost Estimator** — AI estimates costs based on room type, surface, work type (future)
6. **Schedule Optimizer** — AI suggests optimal task ordering (future)
7. **Risk Alerts** — AI flags overdue projects, expiring documents, budget overruns (done in dashboard insights)

---

## Phase 3: Modern UX Patterns

### Navigation
- ✅ Collapsible sidebar with smooth animations
- ✅ Breadcrumbs on every page
- ✅ Command palette (Cmd+K) for quick navigation
- ✅ Global search across all entities

### Interactions
- ✅ Skeleton loading states
- ✅ Toast notifications
- ✅ Keyboard shortcuts
- Slide-over panels for quick edits (ProspectionPage has this)
- Drag-and-drop for kanban boards (ProspectionPage has this)

### Data Visualization
- ✅ Recharts with modern styling (DashboardCharts)
- ✅ Progress bars for project completion
- ✅ Pipeline visualization in dashboard

---

## Implementation Status

### Batch 1: High Visual Impact ✅ COMPLETE
- [x] Redesign Dashboard completely (stat cards, layout, AI insights, pipeline, progress)
- [x] Add AI Chat Widget component (floating bubble, context-aware)
- [x] Redesign ClientsPage (card grid, search, type filters)

### Batch 2: Core Pages ✅ COMPLETE
- [x] Redesign EmployeesPage (header, tabs, form styles)
- [x] Redesign ExpensesPage (stat cards, header, upload area)
- [x] Redesign ProspectionPage (header)
- [x] AgendaPage already clean

### Batch 3: Supporting Pages ✅ COMPLETE
- [x] Redesign TasksPage (header, tabs)
- [x] Redesign PartnersPage (header, filters)
- [x] SettingsPage already clean
- [ ] AdminPage (low priority)

### Batch 4: AI Features (Partial)
- [x] AI Chat Widget with OpenRouter
- [x] AI Dashboard Insights (auto-analysis)
- [ ] AI Project Summary generation
- [ ] AI Cost Estimator
- [ ] AI Communication Drafts (existing feature)
- [ ] Smart Alerts Dashboard Widget

---

## Technical Constraints
- Keep Firebase Firestore data structure unchanged
- Keep existing auth system
- Keep existing service layer (firebaseService, aiService, etc.)
- All changes are UI/component level only
- Zero data migration needed

## Build Status
- ✅ 0 TypeScript errors
- ✅ Production build successful
- ✅ All HMR updates confirmed
