import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Zap,
  Plus,
  Loader2,
  Printer,
  Trash2,
  ShoppingCart,
  User,
  CopyPlus,
  MapPin,
  FileText,
  Download,
  Send,
  Check,
  Clock,
  FileCheck,
  ExternalLink,
  AlertCircle,
  PhoneCall,
  Save,
  Tag,
  Briefcase,
  Calendar,
  Key,
  Euro,
  ListChecks,
  CheckSquare,
  Eye,
  Image as ImageIcon,
  Upload,
  Hammer,
  AlertTriangle,
  X,
  Copy,
  MessageCircle,
} from 'lucide-react';
import { generatePurchaseOrderPDF } from '../services/pdfService';
import { generateWorkOrderEmailLink } from '../services/emailService';
import {
  Project,
  ProjectStatus,
  ProjectDocument,
  ProjectPhoto,
  Appointment,
  ProjectTask,
  PurchaseOrder,
  Client,
  Expense,
  ExpenseCategory,
  ExpenseType,
} from '../types';
import { uploadFileToCloud } from '../services/firebaseService';
import { extractQuoteAmount, analyzeExpenseReceipt } from '../services/geminiService';
import { processImageForAI } from '../utils/imageProcessor';
import AddressAutocomplete from './AddressAutocomplete';
import {
  subscribeToCollection,
  saveDocument,
  deleteDocument,
  where,
} from '../services/firebaseService';

interface ProjectDetailProps {
  project: Project;
  onBack: () => void;
  onSave: (project: Project) => void;
  onDelete: (id: string) => void;
  onDuplicate?: (project: Project) => void;
  onTriggerAutomation?: (project: Project) => void;
  clients?: Client[]; // Need clients to select partners for BDC
}

// CONSTANTS FOR FILE UPLOAD LIMITS
const MAX_DOC_SIZE_MB = 100; // Increased to 100MB for large blueprints
const WARN_DOC_SIZE_MB = 10; // Soft warn at 10MB
const AI_LIMIT_MB = 20; // Max size for AI Analysis (Base64 conversion crash protection)
const MAX_PHOTO_INPUT_SIZE_MB = 20; // Max input size for photos before compression

const ProjectDetail: React.FC<ProjectDetailProps> = ({
  project,
  onBack,
  onSave,
  onDelete,
  onDuplicate,
  onTriggerAutomation,
  clients = [],
}) => {
  // Defensive check: If project is null/undefined, render error state instead of crashing

  const [formData, setFormData] = useState<Project>(project || ({} as Project));
  const [activeTab, setActiveTab] = useState('Principal');
  const [activePhotoTab, setActivePhotoTab] = useState<
    'AVANT' | 'PENDANT' | 'APRES' | 'COMPARATIF'
  >('AVANT');
  const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'modified' | 'saving'>('saved');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState(''); // New state for granular status
  const [showPrintView, setShowPrintView] = useState(false);

  // Validation Date Modal State
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationDates, setValidationDates] = useState({ start: '', end: '' });

  // New Appointment State
  const [newAppointment, setNewAppointment] = useState<Partial<Appointment>>({
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    title: 'RDV Chantier',
  });
  const [isAddingAppointment, setIsAddingAppointment] = useState(false);

  // New Task State
  const [newTaskLabel, setNewTaskLabel] = useState('');

  // Tag State
  const [tagInput, setTagInput] = useState('');
  const [skillInput, setSkillInput] = useState('');

  // BDC Generation State
  const [newBDC, setNewBDC] = useState<{
    subName: string;
    subId: string;
    amount: string;
    selectedTasks: string[];
    desc: string;
    startDate: string;
    endDate: string;
  }>({
    subName: '',
    subId: '',
    amount: '',
    selectedTasks: [],
    desc: '',
    startDate: project.startDate || '',
    endDate: project.endDate || '',
  });
  const [isCreatingBDC, setIsCreatingBDC] = useState(false);

  // EXPENSES MANAGEMENT STATE
  const [projectExpenses, setProjectExpenses] = useState<Expense[]>([]);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [expenseForm, setExpenseForm] = useState<Partial<Expense>>({
    date: new Date().toISOString().split('T')[0],
    currency: 'EUR',
    type: ExpenseType.VARIABLE,
    category: ExpenseCategory.OTHER,
  });

  // Load Expenses
  useEffect(() => {
    if (!project.id) return;
    const unsubscribe = subscribeToCollection(
      'expenses',
      (data) => {
        setProjectExpenses(data as Expense[]);
      },
      [where('projectId', '==', project.id)]
    );
    return () => unsubscribe();
  }, [project.id]);

  const handleExpenseUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setUploadStatusMsg('Analyse IA et Sauvegarde...');

    try {
      // 1. Process & Compress (Workflow Step 4 - Performance)
      // We use the same utility as the main app
      const processedFile = await processImageForAI(file);

      // 2. Upload to Cloud (Workflow Step 1 - Upload & Stockage)
      // Path: projects/{id}/expenses/{timestamp}_{name}
      const safeName = processedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const path = `projects/${project.id}/expenses/${Date.now()}_${safeName}`;
      const url = await uploadFileToCloud(path, processedFile);

      // 3. AI Analysis (Workflow Step 2 - Analyse IA)
      // We pass the processed file to Gemini to minimize token usage / errors
      const extractedData = await analyzeExpenseReceipt(processedFile);

      // 4. Update Form State
      setExpenseForm((prev) => ({
        ...prev,
        receiptUrl: url, // Link to stored file
        date: extractedData?.date || prev.date,
        amount: extractedData?.amount || prev.amount,
        merchant: extractedData?.merchant || prev.merchant,
        category: extractedData?.category || prev.category,
        type: extractedData?.type || prev.type,
        notes: extractedData?.notes || prev.notes,
        vat: extractedData?.vat || prev.vat,
      }));
    } catch (error) {
      console.error('Expense processing error:', error);
      alert('Erreur lors du traitement. Vous pouvez remplir manuellement.');
    } finally {
      setIsUploading(false);
      setUploadStatusMsg('');
      if (e.target) e.target.value = '';
    }
  };

  const handleSaveExpense = async () => {
    if (!expenseForm.merchant || !expenseForm.amount) {
      alert('Merci de remplir au moins le marchand et le montant.');
      return;
    }

    const newExpense: Expense = {
      id: expenseForm.id || Date.now().toString(),
      projectId: project.id, // Link to Project
      createdAt: expenseForm.createdAt || Date.now(),
      updatedAt: Date.now(),
      date: expenseForm.date!,
      merchant: expenseForm.merchant!,
      amount: Number(expenseForm.amount),
      currency: 'EUR',
      category: expenseForm.category || ExpenseCategory.OTHER,
      type: expenseForm.type || ExpenseType.VARIABLE,
      notes: expenseForm.notes,
      receiptUrl: expenseForm.receiptUrl,
      vat: expenseForm.vat,
    };

    // Save to specific 'expenses' collection but filtered by projectId
    await saveDocument('expenses', newExpense.id, newExpense);

    setIsAddingExpense(false);
    setExpenseForm({
      date: new Date().toISOString().split('T')[0],
      currency: 'EUR',
      type: ExpenseType.VARIABLE,
      category: ExpenseCategory.OTHER,
    });
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (
      window.confirm('Supprimer cette dépense ? Le fichier joint ne sera pas supprimé du serveur.')
    ) {
      await deleteDocument('expenses', expenseId);
    }
  };

  // Filter for Partners/Subcontractors
  const partnersList = useMemo(() => {
    return clients.filter((c) => c.type === 'SOUS_TRAITANT' || c.type === 'PARTENAIRE');
  }, [clients]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync logic when prop changes
  useEffect(() => {
    if (project && project.id !== formData.id) {
      setFormData(project);
      setSaveStatus('saved');
    }
  }, [project?.id]);

  // Auto-update status based on dates (Business Logic)
  useEffect(() => {
    if (!formData.startDate || !formData.endDate) return;

    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    // Only affect active planning statuses
    if (
      [ProjectStatus.NEW, ProjectStatus.VALIDATED, ProjectStatus.IN_PROGRESS].includes(
        formData.status
      )
    ) {
      // Future Project -> VALIDATED (A Venir)
      if (start > now) {
        if (formData.status !== ProjectStatus.VALIDATED) {
          setFormData((prev) => ({ ...prev, status: ProjectStatus.VALIDATED }));
          setSaveStatus('modified');
        }
      }
      // Current Project -> IN_PROGRESS (En Cours)
      else if (start <= now && end >= now) {
        if (formData.status !== ProjectStatus.IN_PROGRESS) {
          setFormData((prev) => ({ ...prev, status: ProjectStatus.IN_PROGRESS }));
          setSaveStatus('modified');
        }
      }
    }
  }, [formData.startDate, formData.endDate]);

  // Defensive check: moved after hooks
  if (!project || !project.id)
    return (
      <div className="p-8 text-center text-red-500">Erreur: Données du projet manquantes.</div>
    );

  // Optimized for Mobile: text-base on mobile avoids zoom, text-sm on desktop
  const inputClass =
    'w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 text-base md:text-sm';
  const labelClass =
    'block text-xs font-semibold text-slate-800 dark:text-slate-200 uppercase mb-1';
  const sectionTitleClass =
    'font-bold text-slate-800 dark:text-slate-100 dark:text-white flex items-center mb-4 text-sm uppercase tracking-wide border-b border-slate-100 dark:border-slate-800 pb-2';

  const updateField = (field: keyof Project, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setSaveStatus('modified');
  };

  const updateAccess = (field: keyof NonNullable<typeof formData.accessInfo>, value: any) => {
    setFormData((prev) => ({
      ...prev,
      accessInfo: { ...prev.accessInfo, [field]: value },
    }));
    setSaveStatus('modified');
  };

  const handleAddAppointment = () => {
    if (!newAppointment.date || !newAppointment.startTime) return;

    const appointment: Appointment = {
      id: Date.now().toString(),
      date: newAppointment.date,
      startTime: newAppointment.startTime,
      endTime: newAppointment.endTime,
      title: newAppointment.title || 'RDV',
      status: 'SCHEDULED',
      note: newAppointment.note,
    };

    const updatedAppointments = [...(formData.appointments || []), appointment];

    // Update local state and save
    const updatedProject = { ...formData, appointments: updatedAppointments };
    setFormData(updatedProject);
    setSaveStatus('saved');
    onSave(updatedProject);

    setIsAddingAppointment(false);
    setNewAppointment({
      date: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      title: 'RDV Chantier',
    });
  };

  const deleteAppointment = (id: string) => {
    if (window.confirm('Supprimer ce rendez-vous ?')) {
      const updatedProject = {
        ...formData,
        appointments: formData.appointments?.filter((a) => a.id !== id),
      };
      setFormData(updatedProject);
      setSaveStatus('saved');
      onSave(updatedProject);
    }
  };

  // Task Logic
  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskLabel.trim()) return;

    const newTask: ProjectTask = {
      id: Date.now().toString(),
      label: newTaskLabel,
      isDone: false,
    };

    const updatedTasks = [...(formData.tasks || []), newTask];
    const updatedProject = { ...formData, tasks: updatedTasks };
    setFormData(updatedProject);
    setSaveStatus('saved');
    onSave(updatedProject);
    setNewTaskLabel('');
  };

  const toggleTask = (taskId: string) => {
    const updatedTasks =
      formData.tasks?.map((t) => (t.id === taskId ? { ...t, isDone: !t.isDone } : t)) || [];
    const updatedProject = { ...formData, tasks: updatedTasks };
    setFormData(updatedProject);
    onSave(updatedProject);
  };

  const deleteTask = (taskId: string) => {
    const updatedTasks = formData.tasks?.filter((t) => t.id !== taskId) || [];
    const updatedProject = { ...formData, tasks: updatedTasks };
    setFormData(updatedProject);
    onSave(updatedProject);
  };

  // Tag Logic
  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagInput.trim()) return;
    const val = tagInput.trim();
    if (!formData.tags?.includes(val)) {
      const updatedTags = [...(formData.tags || []), val];
      updateField('tags', updatedTags);
    }
    setTagInput('');
  };

  const handleRemoveTag = (tag: string) => {
    const updatedTags = formData.tags?.filter((t) => t !== tag) || [];
    updateField('tags', updatedTags);
  };

  // Skill Logic
  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!skillInput.trim()) return;
    const val = skillInput.trim();
    if (!formData.skills?.includes(val)) {
      const updatedSkills = [...(formData.skills || []), val];
      updateField('skills', updatedSkills);
    }
    setSkillInput('');
  };

  const handleRemoveSkill = (skill: string) => {
    const updatedSkills = formData.skills?.filter((s) => s !== skill) || [];
    updateField('skills', updatedSkills);
  };

  const handleSave = () => {
    setSaveStatus('saving');
    onSave(formData);
    setTimeout(() => setSaveStatus('saved'), 500);
  };

  const handleBack = () => {
    if (saveStatus === 'modified') {
      if (
        window.confirm(
          'Vous avez des modifications non enregistrées. Voulez-vous les enregistrer avant de quitter ?'
        )
      ) {
        onSave(formData);
      }
    }
    onBack();
  };

  const handleStatusChange = (newStatus: ProjectStatus) => {
    // Special logic for Validation -> In Progress
    if (newStatus === ProjectStatus.VALIDATED) {
      setShowValidationModal(true);
      return;
    }

    const updatedProject = { ...formData, status: newStatus };
    setFormData(updatedProject);
    setSaveStatus('saved');
    onSave(updatedProject);
  };

  const confirmValidation = () => {
    const updatedProject = {
      ...formData,
      status: ProjectStatus.VALIDATED,
      startDate: validationDates.start || formData.startDate,
      endDate: validationDates.end || formData.endDate,
    };
    setFormData(updatedProject);
    setSaveStatus('saved');
    onSave(updatedProject);
    setShowValidationModal(false);
  };

  const handleDelete = () => {
    // Use window.confirm for safety, then propagate up
    if (
      window.confirm(
        '⚠️ Êtes-vous sûr de vouloir SUPPRIMER DÉFINITIVEMENT ce dossier ?\n\nCette action est irréversible.'
      )
    ) {
      onDelete(formData.id);
    }
  };

  const handleDuplicate = () => {
    if (onDuplicate) {
      if (window.confirm('Voulez-vous créer une copie de ce dossier ?')) {
        onDuplicate(formData);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copié dans le presse-papier !');
  };

  const handlePrint = () => {
    setShowPrintView(true);
    // Give time for the modal to render before printing
    setTimeout(() => window.print(), 500);
  };

  const handlePartnerSelection = (partnerId: string) => {
    const partner = partnersList.find((p) => p.id === partnerId);
    if (partner) {
      setNewBDC({
        ...newBDC,
        subName: partner.name,
        subId: partner.id || '',
      });
    } else {
      setNewBDC({ ...newBDC, subName: '', subId: '' });
    }
  };

  const generateBDC = () => {
    const { subName, amount, selectedTasks, desc, startDate, endDate } = newBDC;
    if (!subName || !amount) return;

    const tasksLabels =
      formData.tasks?.filter((t) => selectedTasks.includes(t.id)).map((t) => t.label) || [];

    const newOrder: PurchaseOrder = {
      id: Date.now().toString(),
      number: `BDC - ${new Date().getFullYear()} -${(formData.purchaseOrders?.length || 0) + 1} `,
      subcontractorId: newBDC.subId || 'EXT',
      subcontractorName: subName,
      amountHT: parseFloat(amount),
      date: new Date().toISOString(),
      startDate: startDate,
      endDate: endDate,
      description: desc || 'Prestations diverses',
      tasks: tasksLabels,
      status: 'DRAFT',
    };

    const updatedProject = {
      ...formData,
      purchaseOrders: [newOrder, ...(formData.purchaseOrders || [])],
    };
    setFormData(updatedProject);
    onSave(updatedProject);
    setIsCreatingBDC(false);
    setNewBDC({
      subName: '',
      subId: '',
      amount: '',
      selectedTasks: [],
      desc: '',
      startDate: '',
      endDate: '',
    });
  };

  // XSS Protection Utility
  const escapeHtml = (unsafe: string) => {
    if (!unsafe) return '';
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const printBDC = (order: PurchaseOrder) => {
    const printContent = `
    < html >
      <head>
          <title>Bon de Commande ${escapeHtml(order.number)}</title>
          <style>
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
              body { font-family: 'Inter', Arial, sans-serif; padding: 40px; color: #1e293b; max-width: 900px; margin: 0 auto; }
              .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 3px solid #0f172a; padding-bottom: 20px; }
              .logo-section img { height: 60px; display: block; margin-bottom: 10px; filter: brightness(0); } /* Black logo */
              .doc-title { font-size: 28px; font-weight: 900; color: #0f172a; text-transform: uppercase; letter-spacing: 1px; }
              
              .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
              .box { padding: 15px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
              .box-title { font-size: 10px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
              .box-content { font-size: 14px; line-height: 1.5; font-weight: 500; }
              
              .info-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 30px; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a; padding: 15px 0; }
              .info-item { text-align: center; }
              .info-label { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; display: block; margin-bottom: 4px; }
              .info-val { font-size: 14px; font-weight: 700; color: #0f172a; }

              table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              th { background: #0f172a; color: white; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: 700; }
              td { border-bottom: 1px solid #e2e8f0; padding: 12px; font-size: 14px; }
              tr:nth-child(even) { background-color: #f8fafc; }
              .col-desc { width: 60%; }
              
              .total-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
              .total-box { width: 300px; }
              .total-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
              .total-row.final { border-bottom: 3px solid #0f172a; font-weight: 900; font-size: 18px; border-top: 2px solid #0f172a; margin-top: 10px; padding-top: 15px; }
              
              .legal-mention { 
                  font-size: 11px; 
                  color: #0f172a; 
                  text-align: center; 
                  padding: 15px; 
                  border: 2px solid #0f172a; 
                  background: #f1f5f9; 
                  font-weight: 700; 
                  margin-bottom: 40px; 
              }
              
              .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 20px; page-break-inside: avoid; }
              .sign-box { border: 1px solid #cbd5e1; height: 120px; padding: 10px; position: relative; }
              .sign-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; }
              
              /* Print Cleanups */
              @media print {
                  body { padding: 0; }
                  .no-print { display: none; }
              }
          </style>
      </head>
      <body>
          <div class="header-row">
              <div class="logo-section">
                  <img src="https://cdn.prod.website-files.com/6279383071a695621116a3bb/66aa3dc06cc8b3e76941f8a3_Final-logo.png" alt="Bel Air Habitat" />
                  <div style="font-size: 12px; font-weight: 600;">BEL AIR HABITAT</div>
                  <div style="font-size: 11px; color: #64748b;">19 B Rue de la Tourelle, 95170 DEUIL-LA-BARRE</div>
                  <div style="font-size: 11px; color: #64748b;">SIREN : 930 674 932</div>
              </div>
              <div style="text-align: right;">
                  <div class="doc-title">Bon de Commande</div>
                  <div style="font-size: 14px; font-weight: 600; color: #64748b;">N° ${escapeHtml(order.number)}</div>
              </div>
          </div>
          
          <div class="grid-2">
              <div class="box">
                  <div class="box-title">Donneur d'Ordre (Facturation)</div>
                  <div class="box-content">
                      BEL AIR HABITAT<br/>
                      Service Achats / Travaux<br/>
                      19 B Rue de la Tourelle<br/>
                      95170 DEUIL-LA-BARRE
                  </div>
              </div>
              <div class="box">
                  <div class="box-title">Destinataire (Sous-Traitant)</div>
                  <div class="box-content">
                      ${escapeHtml(order.subcontractorName)}<br/>
                      <!-- Address would go here if we had it -->
                  </div>
              </div>
          </div>

          <div class="info-bar">
              <div class="info-item">
                  <span class="info-label">Date Commande</span>
                  <span class="info-val">${new Date(order.date).toLocaleDateString()}</span>
              </div>
              <div class="info-item">
                  <span class="info-label">Début Intervention</span>
                  <span class="info-val">${order.startDate ? new Date(order.startDate).toLocaleDateString() : 'À définir'}</span>
              </div>
              <div class="info-item">
                  <span class="info-label">Fin Prévue</span>
                  <span class="info-val">${order.endDate ? new Date(order.endDate).toLocaleDateString() : 'À définir'}</span>
              </div>
              <div class="info-item">
                  <span class="info-label">Référence Chantier</span>
                  <span class="info-val">${escapeHtml(formData.businessCode || formData.id)}</span>
              </div>
          </div>

          <div class="box" style="margin-bottom: 30px;">
              <div class="box-title">Objet de la commande / Description</div>
              <div class="box-content">
                  ${escapeHtml(order.description)}
              </div>
          </div>

          <table>
              <thead>
                  <tr>
                      <th class="col-desc">Désignation des Prestations</th>
                      <th style="text-align: right;">Quantité</th>
                      <th style="text-align: right;">Total HT</th>
                  </tr>
              </thead>
              <tbody>
                  ${order.tasks
                    ?.map(
                      (task) => `
                  <tr>
                      <td>${escapeHtml(task)}</td>
                      <td style="text-align: right;">1.00</td>
                      <td style="text-align: right;">-</td>
                  </tr>
                  `
                    )
                    .join('')}
                  <tr>
                      <td style="font-style: italic; color: #64748b;">Forfait Global Convenu</td>
                      <td style="text-align: right;">1.00</td>
                      <td style="text-align: right;">${order.amountHT.toLocaleString()} €</td>
                  </tr>
              </tbody>
          </table>

          <div class="total-section">
              <div class="total-box">
                  <div class="total-row">
                      <span>Total HT</span>
                      <span>${order.amountHT.toLocaleString()} €</span>
                  </div>
                  <div class="total-row">
                      <span>TVA (Autoliquidation)</span>
                      <span>0.00 €</span>
                  </div>
                  <div class="total-row final">
                      <span>Net à Payer</span>
                      <span>${order.amountHT.toLocaleString()} €</span>
                  </div>
                  <div style="font-size: 10px; color: #64748b; margin-top: 5px; text-align: right;">
                      TVA non applicable, art. 283-2 du CGI (Autoliquidation)
                  </div>
              </div>
          </div>

          <div class="legal-mention">
              CONDITIONS DE RÈGLEMENT : 100% à réception de facture après validation de fin de chantier (PV de réception sans réserves).
              <br/>Le sous-traitant déclare être à jour de ses obligations sociales et fiscales.
          </div>

          <div class="signatures">
              <div class="sign-box">
                  <div class="sign-label">Pour BEL AIR HABITAT</div>
                  <div style="position: absolute; bottom: 10px; left: 10px; font-size: 10px; color: #94a3b8;">(Date et Signature)</div>
              </div>
              <div class="sign-box">
                  <div class="sign-label">Pour LE SOUS-TRAITANT</div>
                  <div style="font-size: 10px; margin-top: 5px;">Lu et approuvé, bon pour accord</div>
                  <div style="position: absolute; bottom: 10px; left: 10px; font-size: 10px; color: #94a3b8;">(Date, Cachet et Signature)</div>
              </div>
          </div>
      </body>
   </html >
    `;

    const win = window.open('', '', 'height=800,width=900');
    win?.document.write(printContent);
    win?.document.close();
    setTimeout(() => win?.print(), 500); // Wait for logo load
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // IMAGE COMPRESSION UTILITY
  const compressImage = (file: File, maxWidth = 1280, quality = 0.6): Promise<File> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                const newFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(newFile);
              } else {
                reject(new Error('Canvas to Blob failed'));
              }
            },
            'image/jpeg',
            quality
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. CHECK FILE SIZE (HARD LIMIT)
    if (file.size > MAX_DOC_SIZE_MB * 1024 * 1024) {
      alert(`Fichier trop volumineux. La limite est de ${MAX_DOC_SIZE_MB} MB.`);
      if (e.target) e.target.value = '';
      return;
    }

    // 2. CHECK FILE SIZE (SOFT WARNING)
    if (file.size > WARN_DOC_SIZE_MB * 1024 * 1024) {
      // For very large files, just warn about time
      const confirmUpload = window.confirm(
        `Ce document fait ${(file.size / 1024 / 1024).toFixed(1)} MB. L'envoi peut être long.\n\nVoulez-vous continuer ?`
      );
      if (!confirmUpload) {
        if (e.target) e.target.value = '';
        return;
      }
    }

    setIsUploading(true);
    setUploadStatusMsg('Envoi en cours...');

    // Feature: AI Extraction for QUOTE
    let budgetUpdate = {};
    if (type === 'QUOTE') {
      // Check if file is too big for AI
      if (file.size > AI_LIMIT_MB * 1024 * 1024) {
        setUploadStatusMsg("Fichier > 20Mo : Stockage sécurisé uniquement (Pas d'analyse IA)...");
        // Prompt manually immediately since AI is skipped
        const amountStr = window.prompt(
          "Fichier lourd: L'IA a été désactivée. Montant TOTAL HT ? (en €)"
        );
        if (amountStr) {
          const amount = parseFloat(amountStr.replace(',', '.').replace(/[^0-9.]/g, ''));
          if (!isNaN(amount) && amount > 0) budgetUpdate = { budget: amount };
        }
      } else {
        setUploadStatusMsg('Analyse IA du devis en cours...');
        try {
          const amount = await extractQuoteAmount(file);
          if (amount && amount > 0) {
            budgetUpdate = { budget: amount };
            setUploadStatusMsg(`Montant HT détecté : ${amount}€`);
          } else {
            throw new Error('No amount found');
          }
        } catch (aiError) {
          console.warn('AI extraction skipped/failed', aiError);
          const amountStr = window.prompt('Montant TOTAL HT ? (en €)');
          if (amountStr) {
            const amount = parseFloat(amountStr.replace(',', '.').replace(/[^0-9.]/g, ''));
            if (!isNaN(amount) && amount > 0) budgetUpdate = { budget: amount };
          }
        }
      }
    }

    try {
      let fileToUpload = file;

      // 0. COMPRESS IMAGES (Client-side optimization)
      if (file.type.startsWith('image/')) {
        try {
          fileToUpload = await processImageForAI(file);
        } catch (cErr) {
          console.warn('Compression failed, using original', cErr);
        }
      }

      let url;

      setUploadStatusMsg('Sauvegarde...');
      try {
        // 1. Try Cloud Storage
        // We use a simplified path to avoid special char issues
        const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_');
        const path = `projects/${formData.id}/documents/${Date.now()}_${safeName}`;
        url = await uploadFileToCloud(path, fileToUpload);
      } catch (cloudError) {
        console.warn('Cloud upload failed or timed out, falling back to base64', cloudError);

        // 2. Fallback to Local Base64
        // Limit increased to 950KB (Firestore doc limit is 1MB, keeping buffer)
        if (fileToUpload.size > 0.95 * 1024 * 1024) {
          throw new Error(
            `Echec de l'envoi Cloud. Le fichier (${(fileToUpload.size / 1024 / 1024).toFixed(2)} Mo) est trop lourd pour la sauvegarde locale.`
          );
        }
        url = await fileToBase64(fileToUpload);
      }

      const newDoc: ProjectDocument = {
        id: Date.now().toString(),
        name: file.name,
        type: type,
        date: new Date().toISOString(),
        url: url,
        original: true,
        signed: type === 'QUOTE',
      };

      const newDocs = [...(formData.documents || []), newDoc];
      let statusUpdate = {};

      // AUTOMATION LOGIC

      // 1. New -> Quote Sent
      if (type === 'QUOTE' && formData.status === ProjectStatus.NEW) {
        statusUpdate = { status: ProjectStatus.QUOTE_SENT };
      }

      // 2. Validation -> Completed (Check for BOTH PV and Invoice)
      if (formData.status === ProjectStatus.WAITING_VALIDATION) {
        const hasPV = newDocs.some((d) => d.type === 'PV');
        const hasInvoice = newDocs.some((d) => d.type === 'INVOICE' || d.type === 'FACTURE');

        if (hasPV && hasInvoice) {
          statusUpdate = { status: ProjectStatus.COMPLETED };
        }
      }

      const updatedProject = {
        ...formData,
        documents: newDocs,
        ...statusUpdate,
        ...budgetUpdate,
      };

      setFormData(updatedProject);
      onSave(updatedProject);
    } catch (error: any) {
      console.error('Error processing file', error);
      alert(`Erreur: ${error.message}`);
    } finally {
      setIsUploading(false);
      setUploadStatusMsg('');
      // Reset input
      if (e.target) e.target.value = '';
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    // Cannot upload in comparative mode
    if (activePhotoTab === 'COMPARATIF') return;

    setIsUploading(true);
    const newPhotos: ProjectPhoto[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const originalFile = files[i];

        // Basic sanity check for massive files before attempting processing
        if (originalFile.size > MAX_PHOTO_INPUT_SIZE_MB * 1024 * 1024) {
          if (
            !window.confirm(
              `La photo "${originalFile.name}" est très lourde (${(originalFile.size / 1024 / 1024).toFixed(1)}MB). Cela risque de bloquer l'application. Continuer ?`
            )
          ) {
            continue;
          }
        }

        // COMPRESSION STEP: Resize to max 1280px width
        let fileToUpload = originalFile;
        if (originalFile.type.startsWith('image/')) {
          try {
            // Moderate compression to ensure it fits in local storage if cloud fails
            fileToUpload = await compressImage(originalFile, 1280, 0.6);
          } catch (compErr) {
            console.warn('Compression failed, using original', compErr);
          }
        }

        let url;
        try {
          const safeName = originalFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const path = `projects/${formData.id}/photos/${Date.now()}_${i}_${safeName}`;
          url = await uploadFileToCloud(path, fileToUpload);
        } catch (cloudError) {
          console.warn('Cloud photo upload failed, fallback to base64');
          // 4.5MB limit for Base64 photos
          if (fileToUpload.size > 4.5 * 1024 * 1024) continue;
          url = await fileToBase64(fileToUpload);
        }

        newPhotos.push({
          id: `${Date.now()}-${i}`,
          room: 'General',
          type: activePhotoTab,
          date: new Date().toISOString(),
          url: url,
        });
      }

      if (newPhotos.length > 0) {
        const updatedProject = { ...formData, photos: [...(formData.photos || []), ...newPhotos] };
        setFormData(updatedProject);
        setSaveStatus('modified');
        onSave(updatedProject);
      }
    } catch (error) {
      console.error('Error uploading photos', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const deletePhoto = (id: string) => {
    if (window.confirm('Supprimer cette photo ?')) {
      const updatedProject = { ...formData, photos: formData.photos?.filter((p) => p.id !== id) };
      setFormData(updatedProject);
      setSaveStatus('modified');
      onSave(updatedProject);
    }
  };

  const hasDocument = (type: string) => {
    return formData.documents?.some((d) => d.type === type || d.type.includes(type));
  };

  const openWhatsApp = () => {
    if (!formData.client?.phone) return;
    const cleanPhone = formData.client.phone.replace(/[^0-9+]/g, '');
    window.open(`https://wa.me/${cleanPhone}`, '_blank');
  };

  const isLate =
    formData.endDate &&
    new Date(formData.endDate) < new Date() &&
    formData.status !== ProjectStatus.COMPLETED &&
    formData.status !== ProjectStatus.REFUSED &&
    formData.status !== ProjectStatus.LOST;

  const tabs = [
    { id: 'Principal', label: 'Principal', icon: FileText },
    { id: 'Sous-traitance', label: 'Sous-traitance / Achats', icon: ShoppingCart },
    { id: 'Contact', label: 'Contact', icon: User },
    { id: 'Document', label: 'Documents', icon: FileText },
    { id: 'Photos', label: 'Photos', icon: ImageIcon },
  ];

  // Visual Lifecycle Steps
  const steps = [
    { status: ProjectStatus.NEW, label: 'Nouveau' },
    { status: ProjectStatus.QUOTE_SENT, label: 'Devis Envoyé' },
    { status: ProjectStatus.VALIDATED, label: 'Validé' },
    { status: ProjectStatus.IN_PROGRESS, label: 'En Cours' },
    { status: ProjectStatus.WAITING_VALIDATION, label: 'Validation' },
    { status: ProjectStatus.COMPLETED, label: 'Terminé' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.status === formData.status);
  const isFailedState =
    formData.status === ProjectStatus.LOST ||
    formData.status === ProjectStatus.REFUSED ||
    formData.status === ProjectStatus.CANCELLED;

  const renderLifecycleActions = () => {
    const s = formData.status;

    if (s === ProjectStatus.NEW) {
      return (
        <div className="flex space-x-2 print:hidden">
          <button
            onClick={() => handleStatusChange(ProjectStatus.QUOTE_SENT)}
            className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center"
          >
            <Upload size={16} className="mr-2" /> Devis Envoyé
          </button>
          <button
            onClick={() => handleStatusChange(ProjectStatus.IN_PROGRESS)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center"
          >
            <Zap size={16} className="mr-2" /> Production Directe
          </button>
        </div>
      );
    }

    if (s === ProjectStatus.QUOTE_SENT) {
      return (
        <div className="flex space-x-2 print:hidden">
          <button
            onClick={() => handleStatusChange(ProjectStatus.LOST)}
            className="bg-rose-100 text-rose-700 hover:bg-rose-200 px-4 py-2 rounded-lg text-sm font-bold"
          >
            Client Refuse
          </button>
          <button
            onClick={() => handleStatusChange(ProjectStatus.VALIDATED)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center"
          >
            <Check size={16} className="mr-2" /> Client Accepte
          </button>
        </div>
      );
    }

    if (s === ProjectStatus.VALIDATED) {
      return (
        <button
          onClick={() => handleStatusChange(ProjectStatus.IN_PROGRESS)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center animate-pulse print:hidden"
        >
          <Clock size={16} className="mr-2" /> Démarrer Chantier
        </button>
      );
    }

    if (s === ProjectStatus.IN_PROGRESS) {
      return (
        <button
          onClick={() => handleStatusChange(ProjectStatus.WAITING_VALIDATION)}
          className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center print:hidden"
        >
          <Check size={16} className="mr-2" /> Travaux Terminés
        </button>
      );
    }

    if (s === ProjectStatus.WAITING_VALIDATION) {
      const hasPV = hasDocument('PV');
      const hasInvoice = hasDocument('INVOICE') || hasDocument('FACTURE');
      const canComplete = hasPV && hasInvoice;

      return (
        <div className="flex items-center space-x-2 print:hidden">
          <button
            onClick={() => handleStatusChange(ProjectStatus.REFUSED)}
            className="bg-red-100 text-red-700 hover:bg-red-200 px-3 py-2 rounded-lg text-xs font-bold"
          >
            Rejeté
          </button>

          {canComplete ? (
            <button
              onClick={() => handleStatusChange(ProjectStatus.COMPLETED)}
              className="bg-slate-800 hover:bg-black text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center"
            >
              <FileCheck size={16} className="mr-2" /> Clôturer Dossier
            </button>
          ) : (
            <div className="flex flex-col items-end">
              <div className="flex items-center text-xs text-orange-600 font-bold bg-orange-50 px-3 py-1.5 rounded-lg border border-orange-200">
                <AlertTriangle size={14} className="mr-1" />
                Manque: {!hasPV && <span className="mx-1 underline">PV</span>}{' '}
                {!hasInvoice && <span className="mx-1 underline">Facture</span>}
              </div>
            </div>
          )}
        </div>
      );
    }

    if (isFailedState) {
      return (
        <span className="px-3 py-1 bg-slate-100 text-slate-700 dark:text-slate-200 dark:text-white rounded text-xs font-bold uppercase print:hidden">
          Dossier Clos ({s})
        </span>
      );
    }

    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 min-h-screen flex flex-col relative duration-300">
      {/* PRINT VIEW OVERLAY */}
      {showPrintView && (
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-slate-900 text-black dark:text-white p-8 overflow-y-auto animate-in fade-in print:relative print:overflow-visible print:bg-white print:text-black print:p-0 print:h-auto print:block print:inset-auto">
          {/* FIXED CLOSE BUTTON FOR MOBILE/DESKTOP */}
          <div className="fixed top-4 right-4 z-[10000] flex gap-2 print:hidden">
            <button
              onClick={() => window.print()}
              className="bg-slate-900 text-white p-3 rounded-full shadow-lg hover:bg-emerald-600 transition-colors"
              title="Lancer l'impression"
            >
              <Printer />
            </button>
            <button
              onClick={() => setShowPrintView(false)}
              className="bg-white dark:bg-slate-900 border-2 border-slate-200 text-slate-700 dark:text-slate-200 dark:text-white p-3 rounded-full shadow-lg hover:text-red-500 transition-colors"
              title="Fermer"
            >
              <X />
            </button>
          </div>

          <div className="max-w-4xl mx-auto border-2 border-slate-900 p-8 min-h-[1000px] relative print:border-0 print:p-0 print:min-h-0 print:w-full print:max-w-none">
            {/* Header */}
            <div className="flex justify-between items-start border-b-4 border-slate-900 pb-4 mb-6">
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tight">Fiche Chantier</h1>
                <p className="text-slate-700 dark:text-slate-200 dark:text-white font-bold mt-1">
                  Dossier: {formData.businessCode}
                </p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold">BEL AIR HABITAT</h2>
                <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white">
                  19 B Rue de la Tourelle, 95170 Deuil-la-Barre
                </p>
                <p className="text-sm font-mono mt-1">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Top Grid */}
            <div className="grid grid-cols-2 gap-6 mb-8">
              <div className="border border-slate-300 p-4 rounded-lg bg-slate-50">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase text-sm mb-3 flex items-center">
                  <User size={16} className="mr-2" /> Client & Contact
                </h3>
                <p className="font-bold text-lg">{formData.client?.name || 'Nom inconnu'}</p>
                <p className="mt-1">{formData.client?.email || 'Email inconnu'}</p>
                <p className="font-mono font-bold mt-1">
                  {formData.client?.phone || 'Tél inconnu'}
                </p>
              </div>
              <div className="border border-slate-300 p-4 rounded-lg bg-slate-50">
                <h3 className="font-bold text-slate-900 dark:text-white uppercase text-sm mb-3 flex items-center">
                  <MapPin size={16} className="mr-2" /> Adresse Chantier
                </h3>
                {/* Use siteAddress if available (construction site), else fall back to client address */}
                <p className="text-lg font-medium">
                  {formData.siteAddress || formData.client?.address || 'Adresse inconnue'}
                </p>
                {/* Only show City/Zip if it's client address fallback, or if we parse it from siteAddress (simple display here) */}
                {!formData.siteAddress && (
                  <p>
                    {formData.client?.zipCode} {formData.client?.city}
                  </p>
                )}
              </div>
            </div>

            {/* Access & Logistics - CRITICAL FOR WORKERS */}
            <div className="mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white uppercase text-sm mb-2 border-b border-slate-200 pb-1">
                Accès & Clés
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="border p-3 rounded bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-white uppercase font-bold block">
                    Digicode
                  </span>
                  <span className="font-mono text-xl font-bold">
                    {formData.accessInfo?.digicode || '---'}
                  </span>
                </div>
                <div className="border p-3 rounded bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-white uppercase font-bold block">
                    Étage / Porte
                  </span>
                  <span className="font-mono text-lg font-bold">
                    {formData.accessInfo?.floor || '---'}
                  </span>
                </div>
                <div className="border p-3 rounded bg-white dark:bg-slate-900">
                  <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-white uppercase font-bold block">
                    Boîte à Clé
                  </span>
                  <span className="font-mono text-lg font-bold">
                    {formData.accessInfo?.keysLocation || '---'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white uppercase text-sm mb-2 border-b border-slate-200 pb-1">
                Description / Cahier des Charges
              </h3>
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{formData.description}</p>
            </div>

            {/* Tasks Checklist */}
            <div className="mb-8">
              <h3 className="font-bold text-slate-900 dark:text-white uppercase text-sm mb-2 border-b border-slate-200 pb-1">
                Détail des Prestations à Réaliser (Sans Prix)
              </h3>
              {!formData.tasks || formData.tasks.length === 0 ? (
                <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white italic">
                  Aucune prestation spécifique listée.
                </p>
              ) : (
                <div className="space-y-2">
                  {formData.tasks.map((t) => (
                    <div key={t.id} className="flex items-center">
                      <div
                        className={`w-5 h-5 border-2 border-slate-400 mr-3 rounded flex items-center justify-center ${t.isDone ? 'bg-slate-200' : 'bg-white dark:bg-slate-900'}`}
                      >
                        {t.isDone && <Check size={14} />}
                      </div>
                      <span
                        className={
                          t.isDone
                            ? 'line-through text-slate-700 dark:text-slate-200 dark:text-white'
                            : 'font-medium'
                        }
                      >
                        {t.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes Area */}
            <div className="border-2 border-dashed border-slate-300 rounded-lg h-40 p-4 mt-auto">
              <span className="text-slate-700 dark:text-slate-200 dark:text-white font-bold uppercase text-xs">
                Notes Chantier / Croquis
              </span>
            </div>
          </div>
        </div>
      )}

      {/* PDF Viewer */}
      {previewDoc && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-lg w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
            <div className="h-12 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 px-4 shrink-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white text-sm flex items-center truncate">
                <FileText size={16} className="mr-2 text-emerald-600" />
                {previewDoc.name}
              </h3>
              <div className="flex items-center space-x-2">
                <iframe src={previewDoc.url} className="hidden" title="Print Frame" />
                <a
                  href={previewDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-1.5 rounded text-xs font-bold flex items-center transition-colors"
                >
                  <ExternalLink size={14} className="mr-2" />
                  Ouvrir dans Chrome
                </a>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-colors text-slate-700 dark:text-slate-200 dark:text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-100 dark:bg-slate-900 relative">
              <iframe src={previewDoc.url} className="w-full h-full border-0" title="PDF Viewer" />
            </div>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm print:hidden">
        <div className="px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <button
              onClick={handleBack}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
            >
              <X size={20} className="text-slate-700 dark:text-slate-200 dark:text-white" />
            </button>
            <div>
              <h2 className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center text-lg leading-tight">
                {formData.title}
                {saveStatus === 'modified' && (
                  <span
                    className="ml-2 w-2 h-2 rounded-full bg-amber-500 animate-pulse"
                    title="Modifié"
                  ></span>
                )}
                {/* Weather Widget */}
              </h2>
              <div className="flex items-center space-x-2 mt-0.5">
                <span className="text-xs text-slate-700 dark:text-slate-200 dark:text-white font-mono">
                  #{formData.businessCode || formData.id}
                </span>
                {isLate && (
                  <span className="flex items-center text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                    <AlertCircle size={10} className="mr-1" /> En retard
                  </span>
                )}

                {/* Callback Toggle in Header */}
                <button
                  onClick={() => updateField('needsCallback', !formData.needsCallback)}
                  className={`flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors ml-2 ${
                    formData.needsCallback
                      ? 'bg-red-100 text-red-700 border-red-200 animate-pulse'
                      : 'bg-slate-100 text-slate-700 dark:text-slate-200 dark:text-white border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  <PhoneCall size={10} className="mr-1" />
                  {formData.needsCallback ? 'À RELANCER' : 'Suivi Normal'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {renderLifecycleActions()}
            <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-1"></div>

            {/* Print Button */}
            <button
              onClick={handlePrint}
              className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
              title="Imprimer Fiche Chantier"
            >
              <Printer size={18} />
            </button>

            {onDuplicate && (
              <button
                onClick={handleDuplicate}
                className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition-colors"
                title="Dupliquer le dossier"
              >
                <CopyPlus size={18} />
              </button>
            )}

            <button
              onClick={handleSave}
              className={`flex items-center px-4 py-2 rounded-lg font-bold text-sm transition-all ${saveStatus === 'saved' ? 'bg-slate-100 text-slate-700 dark:text-slate-200 dark:bg-slate-800 dark:text-white' : 'bg-emerald-600 text-white shadow-lg shadow-emerald-200'}`}
            >
              {saveStatus === 'saving' ? (
                <Loader2 size={16} className="animate-spin mr-2" />
              ) : (
                <Save size={16} className="mr-2" />
              )}
              {saveStatus === 'saved' ? 'Enregistré' : 'Enregistrer'}
            </button>

            {/* DANGER ZONE: Explicit delete available here too for convenience */}
            <button
              onClick={handleDelete}
              className="p-2 text-slate-700 dark:text-slate-200 dark:text-white hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Progress Bar Timeline */}
        {!isFailedState && (
          <div className="px-4 pb-3 pt-1 overflow-x-auto">
            <div className="flex items-center min-w-max space-x-2">
              {steps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div key={step.status} className="flex items-center">
                    <div
                      className={`flex items-center px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                        isCurrent
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
                          : isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800'
                            : 'bg-slate-50 text-slate-700 dark:text-slate-200 dark:text-white border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                      }`}
                    >
                      {isCompleted && !isCurrent && <Check size={12} className="mr-1" />}
                      {step.label}
                    </div>
                    {idx < steps.length - 1 && (
                      <div
                        className={`h-0.5 w-4 mx-1 ${idx < currentStepIndex ? 'bg-emerald-300' : 'bg-slate-200 dark:bg-slate-800'}`}
                      ></div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 px-4 overflow-x-auto print:hidden">
        <div className="flex space-x-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-bold border-t-2 transition-colors flex items-center ${activeTab === tab.id ? 'bg-white dark:bg-slate-900 border-emerald-500 text-emerald-700 dark:text-emerald-400 border-x border-slate-200 dark:border-slate-800 rounded-t' : 'border-transparent text-slate-700 dark:text-slate-200 dark:text-white hover:text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-t'}`}
            >
              <tab.icon size={16} className="mr-2 opacity-70" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#F3F4F6] dark:bg-slate-900 print:hidden">
        <div className="max-w-6xl mx-auto bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 min-h-[600px] p-6">
          {activeTab === 'Principal' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className={sectionTitleClass}>
                  <FileText size={18} className="mr-2" /> Informations Dossier
                </h3>
                <div>
                  <label className={labelClass}>Titre Projet</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Code Affaire</label>
                    <input
                      type="text"
                      readOnly
                      value={formData.businessCode || ''}
                      className={`${inputClass} bg-slate-100 dark:bg-slate-600 cursor-not-allowed`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Type Dossier</label>
                    <select
                      value={formData.folderType || 'Particulier'}
                      onChange={(e) => updateField('folderType', e.target.value)}
                      className={inputClass}
                    >
                      <option value="Particulier">Particulier</option>
                      <option value="Entreprise">Entreprise</option>
                      <option value="Sous-traitance">Sous-traitance (Autoliquidation)</option>
                      <option value="Partenaire">Partenaire</option>
                      <option value="Sinistre">Sinistre</option>
                      <option value="Copropriété">Copropriété</option>
                      <option value="Bailleur">Bailleur</option>
                      <option value="Architecte">Architecte</option>
                      <option value="SAV">SAV</option>
                    </select>
                  </div>
                </div>

                {/* SKILLS SECTION (Specialité) */}
                <div className="pt-2">
                  <label className={labelClass}>Spécialité / Corps d'état</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.skills?.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs font-bold border border-indigo-200 dark:border-indigo-700"
                      >
                        <Hammer size={10} className="mr-1" /> {skill}
                        <button
                          onClick={() => handleRemoveSkill(skill)}
                          className="ml-2 hover:text-red-500"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddSkill} className="flex">
                    <input
                      type="text"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      className="flex-1 text-xs p-2 border border-slate-200 rounded-l-lg outline-none"
                      placeholder="Ajouter spécialité (ex: Plomberie)..."
                    />
                    <button
                      type="submit"
                      className="bg-slate-100 hover:bg-slate-200 px-3 border border-l-0 border-slate-200 rounded-r-lg text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      <Plus size={14} />
                    </button>
                  </form>
                </div>

                {/* SITE ADDRESS */}
                <div className="pt-2">
                  <label className={labelClass}>Adresse du Chantier (Lieu des Travaux)</label>
                  <AddressAutocomplete
                    value={formData.siteAddress || ''}
                    onChange={(val) => {
                      updateField('siteAddress', val);
                      // Trigger Geocoding
                      if (val && val.length > 5) {
                        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val)}&count=1&language=fr&format=json`;
                        fetch(url)
                          .then((res) => res.json())
                          .then((data) => {
                            if (data.results && data.results.length > 0) {
                              const { latitude, longitude } = data.results[0];
                              // We update directly to state without triggering another re-render cycle issue hopefully
                              setFormData((prev) => ({ ...prev, lat: latitude, lng: longitude }));
                            }
                          })
                          .catch((err) => console.error('Geocoding failed', err));
                      }
                    }}
                    className={`${inputClass} pl-9 font-medium`}
                    placeholder="Adresse d'intervention (Si différente du siège)"
                  />
                  {formData.lat && (
                    <p className="text-[9px] text-slate-700 dark:text-slate-200 dark:text-white mt-1 flex items-center">
                      <MapPin size={9} className="mr-1" /> GPS: {formData.lat}, {formData.lng}
                    </p>
                  )}
                </div>

                {/* TAGS SECTION */}
                <div className="pt-2">
                  <label className={labelClass}>Étiquettes (Tags)</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white text-xs font-bold border border-slate-200 dark:border-slate-600"
                      >
                        <Tag size={10} className="mr-1" /> {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-2 hover:text-red-500"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <form onSubmit={handleAddTag} className="flex">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      className="flex-1 text-xs p-2 border border-slate-200 rounded-l-lg outline-none"
                      placeholder="Ajouter tag (ex: Plomberie, Urgent)..."
                    />
                    <button
                      type="submit"
                      className="bg-slate-100 hover:bg-slate-200 px-3 border border-l-0 border-slate-200 rounded-r-lg text-xs font-bold text-slate-700 dark:text-slate-200"
                    >
                      <Plus size={14} />
                    </button>
                  </form>
                </div>

                {/* Appointments Manager */}
                <div className="pt-2">
                  <div className="flex justify-between items-center mt-4 mb-2">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                      <Briefcase size={16} className="mr-2 text-indigo-500" /> Rendez-vous
                    </h3>
                    <button
                      onClick={() => setIsAddingAppointment(!isAddingAppointment)}
                      className="text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100 px-2 py-1 rounded font-bold border border-indigo-200 flex items-center"
                    >
                      {isAddingAppointment ? (
                        <X size={12} className="mr-1" />
                      ) : (
                        <Plus size={12} className="mr-1" />
                      )}
                      {isAddingAppointment ? 'Fermer' : 'Nouveau RDV'}
                    </button>
                  </div>

                  <div className="bg-indigo-50 dark:bg-indigo-900/20 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 space-y-3">
                    {isAddingAppointment && (
                      <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-indigo-200 dark:border-indigo-700 mb-3 shadow-sm animate-in zoom-in-95">
                        <h4 className="text-xs font-bold text-indigo-700 mb-2 uppercase">
                          Ajouter un RDV
                        </h4>
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={newAppointment.title}
                            onChange={(e) =>
                              setNewAppointment({ ...newAppointment, title: e.target.value })
                            }
                            className={inputClass}
                            placeholder="Titre (ex: Visite Technique)"
                          />
                          <input
                            type="date"
                            value={newAppointment.date}
                            onChange={(e) =>
                              setNewAppointment({ ...newAppointment, date: e.target.value })
                            }
                            className={inputClass}
                          />
                          <div className="flex space-x-2">
                            <input
                              type="time"
                              value={newAppointment.startTime}
                              onChange={(e) =>
                                setNewAppointment({ ...newAppointment, startTime: e.target.value })
                              }
                              className={inputClass}
                            />
                            <input
                              type="time"
                              value={newAppointment.endTime}
                              onChange={(e) =>
                                setNewAppointment({ ...newAppointment, endTime: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                          <textarea
                            value={newAppointment.note}
                            onChange={(e) =>
                              setNewAppointment({ ...newAppointment, note: e.target.value })
                            }
                            className={inputClass}
                            placeholder="Notes..."
                            rows={2}
                          />
                          <button
                            onClick={handleAddAppointment}
                            className="w-full bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700"
                          >
                            Enregistrer le RDV
                          </button>
                        </div>
                      </div>
                    )}

                    {(!formData.appointments || formData.appointments.length === 0) &&
                    !isAddingAppointment ? (
                      <p className="text-xs text-center text-slate-700 dark:text-slate-200 dark:text-white py-2">
                        Aucun rendez-vous programmé.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                        {formData.appointments
                          ?.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((apt) => (
                            <div
                              key={apt.id}
                              className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-indigo-100 dark:border-indigo-900/50 flex justify-between group"
                            >
                              <div>
                                <div className="font-bold text-sm text-slate-800 dark:text-slate-100 dark:text-white dark:text-white flex items-center">
                                  {apt.title}
                                  {new Date(apt.date) < new Date() && (
                                    <span className="ml-2 text-[10px] bg-slate-100 text-slate-700 dark:text-slate-200 dark:text-white px-1 rounded">
                                      Passé
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-700 dark:text-slate-200 dark:text-white flex items-center mt-1">
                                  <Calendar size={12} className="mr-1" />{' '}
                                  {new Date(apt.date).toLocaleDateString()}
                                  <Clock size={12} className="ml-2 mr-1" /> {apt.startTime}
                                </div>
                                {apt.note && (
                                  <div className="text-xs text-slate-700 dark:text-slate-200 dark:text-white mt-1 italic line-clamp-1">
                                    {apt.note}
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={() => deleteAppointment(apt.id)}
                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Access & Logistics Section */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4">
                  <h3 className={sectionTitleClass}>
                    <Key size={18} className="mr-2 text-indigo-500" /> Logistique & Accès
                  </h3>
                  <div className="grid grid-cols-2 gap-4 bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div>
                      <label className={labelClass}>Digicode / Interphone</label>
                      <input
                        type="text"
                        value={formData.accessInfo?.digicode || ''}
                        onChange={(e) => updateAccess('digicode', e.target.value)}
                        className={inputClass}
                        placeholder="Ex: 1234A"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Étage / Porte</label>
                      <input
                        type="text"
                        value={formData.accessInfo?.floor || ''}
                        onChange={(e) => updateAccess('floor', e.target.value)}
                        className={inputClass}
                        placeholder="Ex: 3ème, Porte Droite"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Boîte à Clés</label>
                      <div className="relative">
                        <Key
                          size={14}
                          className="absolute left-3 top-3 text-slate-700 dark:text-slate-200 dark:text-white"
                        />
                        <input
                          type="text"
                          value={formData.accessInfo?.keysLocation || ''}
                          onChange={(e) => updateAccess('keysLocation', e.target.value)}
                          className={`${inputClass} pl-9`}
                          placeholder="Code ou emplacement"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quote Upload Area */}
                {formData.status === ProjectStatus.NEW && (
                  <div className="pt-4 p-4 bg-sky-50 dark:bg-sky-900/10 rounded-xl border border-sky-100 dark:border-sky-800">
                    <label className="flex items-center space-x-2 text-sm font-bold text-sky-900 dark:text-sky-200 mb-2 cursor-pointer">
                      {isUploading ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <Upload size={16} />
                      )}
                      <span>Importer le Devis Signé</span>
                    </label>
                    <input
                      type="file"
                      accept="application/pdf,image/*"
                      onChange={(e) => handleFileUpload(e, 'QUOTE')}
                      disabled={isUploading}
                      className="block w-full text-xs text-slate-700 dark:text-slate-200 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-white dark:bg-slate-900 file:text-sky-700 hover:file:bg-sky-50 cursor-pointer disabled:opacity-50"
                    />
                    {uploadStatusMsg && (
                      <p className="text-xs text-sky-600 font-bold mt-2 animate-pulse">
                        {uploadStatusMsg}
                      </p>
                    )}
                    <p className="text-[10px] text-sky-700/60 mt-1">
                      Le statut passera automatiquement à "Devis Envoyé" et le montant HT sera
                      extrait.
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className={sectionTitleClass}>
                  <Calendar size={18} className="mr-2" /> Planification & Budget
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Date Début</label>
                    <input
                      type="date"
                      value={formData.startDate || ''}
                      onChange={(e) => updateField('startDate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Date Fin (Prévue)</label>
                    <input
                      type="date"
                      value={formData.endDate || ''}
                      onChange={(e) => updateField('endDate', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <label className={labelClass}>Budget HT</label>
                  <div className="relative">
                    <Euro
                      size={16}
                      className="absolute left-3 top-2.5 text-slate-700 dark:text-slate-200 dark:text-white"
                    />
                    <input
                      type="number"
                      value={formData.budget || ''}
                      onChange={(e) => updateField('budget', parseFloat(e.target.value))}
                      className={`${inputClass} pl-10 font-bold text-slate-800 dark:text-slate-100`}
                      placeholder="0.00"
                    />
                  </div>

                  {/* VAT RATE SELECTOR */}
                  <div className="mt-2">
                    <label className={labelClass}>Régime TVA</label>
                    <select
                      value={formData.vatRate !== undefined ? formData.vatRate : 10}
                      onChange={(e) => updateField('vatRate', parseFloat(e.target.value))}
                      className={inputClass}
                    >
                      <option value={20}>TVA 20% (Standard)</option>
                      <option value={10}>TVA 10% (Rénovation)</option>
                      <option value={0}>TVA 0% (Autoliquidation)</option>
                    </select>
                  </div>

                  {formData.folderType === 'Sous-traitance' && formData.vatRate !== 0 && (
                    <p className="text-[10px] text-orange-600 font-bold mt-1 flex items-center">
                      <AlertTriangle size={10} className="mr-1" /> Attention: Un dossier
                      sous-traitance est souvent en autoliquidation (0%).
                    </p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Description / Notes</label>
                  <textarea
                    rows={6}
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                {/* --- TASKS MODULE (NEW) --- */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="font-bold text-slate-700 dark:text-slate-200 dark:text-white text-sm flex items-center mb-3">
                    <ListChecks size={16} className="mr-2" /> Prestations & Tâches (Visible sur
                    Fiche Chantier)
                  </h4>

                  <form onSubmit={handleAddTask} className="flex mb-3">
                    <input
                      type="text"
                      value={newTaskLabel}
                      onChange={(e) => setNewTaskLabel(e.target.value)}
                      className="flex-1 text-sm p-2 border border-slate-200 rounded-l-lg outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="Ajouter une prestation (ex: Pose carrelage)..."
                    />
                    <button
                      type="submit"
                      className="bg-slate-800 text-white px-3 py-2 rounded-r-lg text-sm font-bold hover:bg-emerald-600 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </form>

                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {formData.tasks && formData.tasks.length > 0 ? (
                      formData.tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center group bg-white dark:bg-slate-900 dark:bg-slate-800/50 p-2 rounded border border-transparent hover:border-slate-200 transition-all"
                        >
                          <button
                            onClick={() => toggleTask(task.id)}
                            className={`mr-3 w-5 h-5 rounded border flex items-center justify-center transition-colors ${task.isDone ? 'bg-emerald-500 border-emerald-500 text-slate-900 dark:text-white dark:text-white' : 'border-slate-300 bg-white dark:bg-slate-900 hover:border-emerald-500'}`}
                          >
                            {task.isDone && <Check size={12} />}
                          </button>
                          <span
                            className={`flex-1 text-sm ${task.isDone ? 'text-slate-700 dark:text-slate-200 dark:text-white line-through' : 'text-slate-700 dark:text-slate-200 dark:text-white'}`}
                          >
                            {task.label}
                          </span>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 p-1"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-slate-700 dark:text-slate-200 dark:text-white italic text-center py-2">
                        Aucune prestation listée.
                      </div>
                    )}
                  </div>
                </div>

                {/* Reserves Section Toggle */}
                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-700 dark:text-slate-200 dark:text-white text-sm">
                      Levées de Réserves
                    </h4>
                    <button
                      onClick={() => updateField('hasReserves', !formData.hasReserves)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${formData.hasReserves ? 'bg-orange-500' : 'bg-slate-200 dark:bg-slate-600'}`}
                    >
                      <span
                        className={`${formData.hasReserves ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white dark:bg-slate-900 transition-transform`}
                      />
                    </button>
                  </div>
                  {formData.hasReserves && (
                    <div className="mt-3 bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg border border-orange-100 dark:border-orange-800 space-y-3">
                      <div>
                        <label className={labelClass}>Date Réserves (Émises)</label>
                        <input
                          type="date"
                          value={formData.reservesDate || ''}
                          onChange={(e) => updateField('reservesDate', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Date Réserves Levées (Résolues)</label>
                        <div className="flex space-x-2">
                          <input
                            type="date"
                            value={formData.reservesResolvedDate || ''}
                            onChange={(e) => updateField('reservesResolvedDate', e.target.value)}
                            className={inputClass}
                          />
                          {formData.reservesResolvedDate && (
                            <CheckSquare className="text-emerald-500 mt-2" />
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* DANGER ZONE */}
              <div className="col-span-1 md:col-span-2 mt-8 pt-8 border-t border-slate-200 dark:border-slate-800">
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <h4 className="text-sm font-bold text-red-800 dark:text-red-300">
                      Zone de Danger
                    </h4>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                      La suppression est définitive et irréversible.
                    </p>
                  </div>
                  <button
                    onClick={handleDelete}
                    className="bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:hover:bg-red-900/50 dark:text-red-300 px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center"
                  >
                    <Trash2 size={16} className="mr-2" /> Supprimer le dossier
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Sous-traitance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className={sectionTitleClass}>
                  <ShoppingCart size={18} className="mr-2" /> Bons de Commande & Achats
                </h3>
                <button
                  onClick={() => setIsCreatingBDC(true)}
                  className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm"
                >
                  + Créer un Bon de Commande
                </button>
              </div>

              {isCreatingBDC && (
                <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-xl border border-slate-200 mb-6 animate-in fade-in">
                  <h4 className="font-bold mb-4">Nouveau Bon de Commande (HT - Autoliquidation)</h4>
                  <div className="space-y-4">
                    <div>
                      <label className={labelClass}>Sous-Traitant / Partenaire</label>
                      <select
                        className={inputClass}
                        value={newBDC.subId}
                        onChange={(e) => handlePartnerSelection(e.target.value)}
                      >
                        <option value="">-- Sélectionner un partenaire --</option>
                        {partnersList.map((partner) => (
                          <option key={partner.id} value={partner.id}>
                            {partner.name}
                          </option>
                        ))}
                      </select>
                      {!newBDC.subId && (
                        <p className="text-[10px] text-slate-700 dark:text-slate-200 dark:text-white mt-1">
                          Si le partenaire n'est pas dans la liste, ajoutez-le d'abord dans l'onglet
                          Partenaires.
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelClass}>Date Début Intervention</label>
                        <input
                          type="date"
                          className={inputClass}
                          value={newBDC.startDate}
                          onChange={(e) => setNewBDC({ ...newBDC, startDate: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Date Fin Intervention</label>
                        <input
                          type="date"
                          className={inputClass}
                          value={newBDC.endDate}
                          onChange={(e) => setNewBDC({ ...newBDC, endDate: e.target.value })}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Montant Total HT (€)</label>
                      <input
                        type="number"
                        className={inputClass}
                        value={newBDC.amount}
                        onChange={(e) => setNewBDC({ ...newBDC, amount: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Description / Lot</label>
                      <input
                        type="text"
                        className={inputClass}
                        value={newBDC.desc}
                        onChange={(e) => setNewBDC({ ...newBDC, desc: e.target.value })}
                        placeholder="Ex: Lot Peinture RDC"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Tâches du projet à inclure</label>
                      <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 p-2 rounded bg-white dark:bg-slate-900 dark:bg-slate-800">
                        {formData.tasks?.map((task) => (
                          <label key={task.id} className="flex items-center space-x-2 text-sm">
                            <input
                              type="checkbox"
                              checked={newBDC.selectedTasks.includes(task.id)}
                              onChange={(e) => {
                                const newSelection = e.target.checked
                                  ? [...newBDC.selectedTasks, task.id]
                                  : newBDC.selectedTasks.filter((id) => id !== task.id);
                                setNewBDC({ ...newBDC, selectedTasks: newSelection });
                              }}
                            />
                            <span>{task.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end space-x-3 pt-2">
                      <button
                        onClick={() => setIsCreatingBDC(false)}
                        className="px-4 py-2 text-slate-700 dark:text-slate-200 text-sm"
                      >
                        Annuler
                      </button>
                      <button
                        onClick={generateBDC}
                        className="bg-slate-900 text-white px-4 py-2 rounded text-sm font-bold"
                      >
                        Générer BDC
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.purchaseOrders?.map((po) => (
                  <div
                    key={po.id}
                    className="border border-slate-200 rounded-lg p-4 bg-white dark:bg-slate-900 dark:bg-slate-800/50"
                  >
                    <div className="flex justify-between mb-2">
                      <span className="font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white">
                        {po.number}
                      </span>
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-700 dark:text-slate-200">
                        {new Date(po.date).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm font-medium">{po.subcontractorName}</p>
                    <p className="text-xs text-slate-700 dark:text-slate-200 dark:text-white mb-2">
                      {po.description}
                    </p>
                    <div className="font-mono font-bold text-lg mb-4">
                      {po.amountHT.toLocaleString()} € HT
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => printBDC(po)}
                        className="flex items-center text-xs bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded font-bold text-slate-700 dark:text-slate-200"
                        title="Imprimer (Simple)"
                      >
                        <Printer size={14} className="mr-1" /> Imprimer
                      </button>
                      <button
                        onClick={() => generatePurchaseOrderPDF(po, formData)}
                        className="flex items-center text-xs bg-emerald-100 hover:bg-emerald-200 px-3 py-2 rounded font-bold text-emerald-700"
                        title="Télécharger PDF Pro"
                      >
                        <Download size={14} className="mr-1" /> PDF
                      </button>
                      <a
                        href={generateWorkOrderEmailLink('email@exemple.com', po, formData)}
                        className="flex items-center text-xs bg-blue-100 hover:bg-blue-200 px-3 py-2 rounded font-bold text-blue-700"
                        title="Envoyer par Email"
                      >
                        <Send size={14} className="mr-1" /> Email
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* --- NOTES DE FRAIS & DEPENSES --- */}
              <div className="pt-8 border-t border-slate-200 dark:border-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <h3 className={sectionTitleClass}>
                    <Euro size={18} className="mr-2" /> Dépenses & Notes de Frais
                  </h3>
                  <button
                    onClick={() => setIsAddingExpense(!isAddingExpense)}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm"
                  >
                    {isAddingExpense ? 'Annuler' : '+ Ajouter une Dépense'}
                  </button>
                </div>

                {isAddingExpense && (
                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-indigo-100 dark:border-indigo-800 shadow-sm animate-in fade-in mb-6">
                    <h4 className="font-bold text-indigo-900 dark:text-indigo-300 mb-4 flex items-center">
                      <Upload size={16} className="mr-2" /> Nouvelle Dépense (Scan IA)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      <div className="col-span-full">
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">
                          1. Justificatif (Ticket/Facture)
                        </label>
                        <div className="border-2 border-dashed border-indigo-200 dark:border-indigo-800 rounded-lg p-4 bg-indigo-50 dark:bg-indigo-900/20 text-center relative group cursor-pointer hover:bg-indigo-100 transition-colors">
                          {isUploading ? (
                            <div className="flex flex-col items-center">
                              <Loader2 size={24} className="animate-spin text-indigo-600 mb-2" />
                              <span className="text-xs font-bold text-indigo-700">
                                {uploadStatusMsg || 'Traitement...'}
                              </span>
                            </div>
                          ) : (
                            <>
                              <Upload size={24} className="mx-auto text-indigo-400 mb-2" />
                              <span className="text-sm font-bold text-indigo-700">
                                Cliquez pour scanner ou déposer un fichier
                              </span>
                              <input
                                type="file"
                                accept="image/*,application/pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleExpenseUpload}
                                disabled={isUploading}
                              />
                              <p className="text-[10px] text-indigo-400 mt-1">
                                Image compressée automatiquement (JPEG 80%) + Stockage Cloud
                              </p>
                            </>
                          )}
                        </div>
                      </div>

                      {expenseForm.receiptUrl && (
                        <>
                          <div>
                            <label className={labelClass}>Date</label>
                            <input
                              type="date"
                              value={expenseForm.date || ''}
                              onChange={(e) =>
                                setExpenseForm({ ...expenseForm, date: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Marchand</label>
                            <input
                              type="text"
                              value={expenseForm.merchant || ''}
                              onChange={(e) =>
                                setExpenseForm({ ...expenseForm, merchant: e.target.value })
                              }
                              className={inputClass}
                              placeholder="Ex: Total Energies"
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Montant TTC</label>
                            <input
                              type="number"
                              step="0.01"
                              value={expenseForm.amount || ''}
                              onChange={(e) =>
                                setExpenseForm({
                                  ...expenseForm,
                                  amount: parseFloat(e.target.value),
                                })
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Catégorie</label>
                            <select
                              value={expenseForm.category || 'Autre'}
                              onChange={(e) =>
                                setExpenseForm({ ...expenseForm, category: e.target.value })
                              }
                              className={inputClass}
                            >
                              {Object.values(ExpenseCategory).map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="col-span-full flex justify-end">
                            <button
                              onClick={handleSaveExpense}
                              disabled={isUploading}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-bold shadow-lg shadow-emerald-200 disabled:opacity-50"
                            >
                              Enregistrer la Dépense
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold uppercase text-xs">
                      <tr>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Marchand</th>
                        <th className="px-4 py-3">Catégorie</th>
                        <th className="px-4 py-3 text-right">Montant</th>
                        <th className="px-4 py-3 text-center">Justificatif</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {projectExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-4 py-8 text-center text-slate-500 italic">
                            Aucune dépense enregistrée pour ce chantier.
                          </td>
                        </tr>
                      ) : (
                        projectExpenses
                          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                          .map((exp) => (
                            <tr
                              key={exp.id}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                            >
                              <td className="px-4 py-3 font-mono text-xs">
                                {new Date(exp.date).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                                {exp.merchant}
                              </td>
                              <td className="px-4 py-3 text-xs">
                                <span className="bg-slate-100 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-full">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white">
                                {exp.amount.toFixed(2)} €
                              </td>
                              <td className="px-4 py-3 text-center">
                                {exp.receiptUrl ? (
                                  <a
                                    href={exp.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center p-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-100"
                                    title="Voir le justificatif"
                                  >
                                    <FileText size={16} />
                                  </a>
                                ) : (
                                  <span className="text-slate-300">-</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  onClick={() => handleDeleteExpense(exp.id)}
                                  className="text-slate-400 hover:text-red-500 p-2 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Contact' && (
            <div className="space-y-6">
              <h3 className={sectionTitleClass}>
                <User size={18} className="mr-2" /> Coordonnées Client / Siège
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Nom Complet / Raison Sociale</label>
                    <input
                      type="text"
                      value={formData.client?.name || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          client: { ...prev.client, name: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      value={formData.client?.email || ''}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          client: { ...prev.client, email: e.target.value },
                        }))
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Téléphone</label>
                    <div className="flex space-x-2">
                      <input
                        type="tel"
                        value={formData.client?.phone || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            client: { ...prev.client, phone: e.target.value },
                          }))
                        }
                        className={inputClass}
                      />
                      {formData.client?.phone && (
                        <>
                          <button
                            onClick={() => copyToClipboard(formData.client.phone)}
                            className="bg-slate-100 hover:bg-slate-200 p-2.5 rounded-lg transition-colors flex items-center justify-center text-slate-700 dark:text-slate-200"
                            title="Copier"
                          >
                            <Copy size={16} />
                          </button>
                          <button
                            onClick={openWhatsApp}
                            className="bg-green-500 hover:bg-green-600 text-slate-900 dark:text-white dark:text-white p-2.5 rounded-lg transition-colors flex items-center justify-center"
                            title="Ouvrir WhatsApp"
                          >
                            <MessageCircle size={20} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Adresse Siège / Facturation</label>
                    <div className="flex space-x-2">
                      <div className="relative w-full">
                        <AddressAutocomplete
                          value={formData.client?.address || ''}
                          onChange={(val) =>
                            setFormData((prev) => ({
                              ...prev,
                              client: { ...prev.client, address: val },
                            }))
                          }
                          onSelect={(result) =>
                            setFormData((prev) => ({
                              ...prev,
                              client: {
                                ...prev.client,
                                address: result.street,
                                zipCode: result.zipCode,
                                city: result.city,
                              },
                            }))
                          }
                          className={`${inputClass} pl-10`}
                          placeholder="Siège social"
                        />
                      </div>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            `${formData.client?.address} ${formData.client?.zipCode} ${formData.client?.city}`
                          )
                        }
                        className="bg-slate-100 hover:bg-slate-200 p-2.5 rounded-lg transition-colors flex items-center justify-center text-slate-700 dark:text-slate-200"
                        title="Copier Adresse"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Code Postal</label>
                      <input
                        type="text"
                        value={formData.client?.zipCode || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            client: { ...prev.client, zipCode: e.target.value },
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Ville</label>
                      <input
                        type="text"
                        value={formData.client?.city || ''}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            client: { ...prev.client, city: e.target.value },
                          }))
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* TENANT / LOCATAIRE SECTION */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <h3 className={sectionTitleClass}>
                  <User size={18} className="mr-2" /> Locataire (Optionnel)
                </h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-xl border border-slate-200 dark:border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Nom du Locataire</label>
                        <input
                          type="text"
                          value={formData.tenant?.name || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              tenant: { ...(prev.tenant || {}), name: e.target.value },
                            }))
                          }
                          className={inputClass}
                          placeholder="Nom complet"
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Notes privées</label>
                        <textarea
                          value={formData.tenant?.notes || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              tenant: { ...(prev.tenant || { name: '' }), notes: e.target.value },
                            }))
                          }
                          className={inputClass}
                          placeholder="Disponibilités, instructions..."
                        />
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className={labelClass}>Téléphone</label>
                        <div className="flex space-x-2">
                          <input
                            type="tel"
                            value={formData.tenant?.phone || ''}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                tenant: { ...(prev.tenant || { name: '' }), phone: e.target.value },
                              }))
                            }
                            className={inputClass}
                            placeholder="06..."
                          />
                          {formData.tenant?.phone && (
                            <button
                              onClick={() => {
                                const cleanPhone = formData.tenant?.phone?.replace(/[^0-9+]/g, '');
                                if (cleanPhone)
                                  window.open(`https://wa.me/${cleanPhone}`, '_blank');
                              }}
                              className="bg-green-500 hover:bg-green-600 text-white p-2.5 rounded-lg transition-colors flex items-center justify-center"
                              title="WhatsApp"
                            >
                              <MessageCircle size={20} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>Email</label>
                        <input
                          type="email"
                          value={formData.tenant?.email || ''}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              tenant: { ...(prev.tenant || { name: '' }), email: e.target.value },
                            }))
                          }
                          className={inputClass}
                          placeholder="email@exemple.com"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'Document' && (
            <div className="space-y-6">
              <h3 className={sectionTitleClass}>
                <FileText size={18} className="mr-2" /> Documents
              </h3>

              {/* Simplified Upload Area */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <div className="p-4 rounded-xl border border-dashed border-sky-300 bg-sky-50 dark:bg-sky-900/10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-sky-100 relative group transition-all">
                  {isUploading ? (
                    <Loader2 className="animate-spin text-sky-500 mb-2" />
                  ) : (
                    <Upload
                      size={24}
                      className="text-sky-500 mb-2 group-hover:scale-110 transition-transform"
                    />
                  )}
                  <span className="text-sm font-bold text-sky-700">Ajouter DEVIS</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={(e) => handleFileUpload(e, 'QUOTE')}
                  />
                </div>
                <div className="p-4 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 dark:bg-emerald-900/10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-emerald-100 relative group transition-all">
                  {isUploading ? (
                    <Loader2 className="animate-spin text-emerald-500 mb-2" />
                  ) : (
                    <Upload
                      size={24}
                      className="text-emerald-500 mb-2 group-hover:scale-110 transition-transform"
                    />
                  )}
                  <span className="text-sm font-bold text-emerald-700">Ajouter PV</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={(e) => handleFileUpload(e, 'PV')}
                  />
                </div>
                <div className="p-4 rounded-xl border border-dashed border-violet-300 bg-violet-50 dark:bg-violet-900/10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-violet-100 relative group transition-all">
                  {isUploading ? (
                    <Loader2 className="animate-spin text-violet-500 mb-2" />
                  ) : (
                    <Upload
                      size={24}
                      className="text-violet-500 mb-2 group-hover:scale-110 transition-transform"
                    />
                  )}
                  <span className="text-sm font-bold text-violet-700">Ajouter FACTURE</span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={(e) => handleFileUpload(e, 'INVOICE')}
                  />
                </div>
                <div className="p-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 dark:bg-slate-900/10 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-slate-100 relative group transition-all">
                  {isUploading ? (
                    <Loader2 className="animate-spin text-slate-700 dark:text-slate-200 dark:text-white mb-2" />
                  ) : (
                    <Upload
                      size={24}
                      className="text-slate-700 dark:text-slate-200 dark:text-white mb-2 group-hover:scale-110 transition-transform"
                    />
                  )}
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 dark:text-white">
                    Ajouter AUTRE
                  </span>
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    onChange={(e) => handleFileUpload(e, 'AUTRE')}
                  />
                </div>
              </div>

              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                  <tr>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Nom</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {!formData.documents || formData.documents.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-slate-700 dark:text-slate-200 dark:text-white"
                      >
                        Aucun document.
                      </td>
                    </tr>
                  ) : (
                    formData.documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                              doc.type === 'QUOTE'
                                ? 'bg-sky-100 text-sky-700'
                                : doc.type === 'INVOICE'
                                  ? 'bg-violet-100 text-violet-700'
                                  : doc.type === 'PV'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-700 dark:text-slate-200'
                            }`}
                          >
                            {doc.type === 'QUOTE'
                              ? 'DEVIS'
                              : doc.type === 'INVOICE'
                                ? 'FACTURE'
                                : doc.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100 dark:text-white">
                          {doc.name}
                        </td>
                        <td className="px-4 py-3 text-slate-700 dark:text-slate-200 dark:text-white">
                          {new Date(doc.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="text-emerald-600 mr-2 hover:bg-emerald-50 p-1.5 rounded transition-colors"
                            title="Voir"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() =>
                              setFormData((prev) => ({
                                ...prev,
                                documents: prev.documents?.filter((d) => d.id !== doc.id),
                              }))
                            }
                            className="text-red-500 hover:bg-red-50 p-1.5 rounded transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'Photos' && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <div className="flex space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  {['AVANT', 'PENDANT', 'APRES'].map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActivePhotoTab(tab as any)}
                      className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activePhotoTab === tab ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-slate-900 dark:text-white dark:text-white dark:text-white' : 'text-slate-700 dark:text-slate-200 dark:text-white'}`}
                    >
                      {tab}
                    </button>
                  ))}
                  <button
                    onClick={() => setActivePhotoTab('COMPARATIF')}
                    className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${activePhotoTab === 'COMPARATIF' ? 'bg-white dark:bg-slate-900 dark:bg-slate-600 shadow text-indigo-600' : 'text-indigo-500'}`}
                  >
                    COMPARATIF
                  </button>
                </div>
                {activePhotoTab !== 'COMPARATIF' && (
                  <div className="relative">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center text-sm font-medium disabled:opacity-50 shadow-sm"
                    >
                      {isUploading ? (
                        <Loader2 size={16} className="mr-2 animate-spin" />
                      ) : (
                        <Upload size={16} className="mr-2" />
                      )}{' '}
                      Ajouter
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>
                )}
              </div>

              {activePhotoTab === 'COMPARATIF' ? (
                <div className="grid grid-cols-2 gap-8 h-[400px]">
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col">
                    <h4 className="font-bold text-center text-slate-700 dark:text-slate-200 dark:text-white mb-2">
                      AVANT
                    </h4>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {formData.photos
                        ?.filter((p) => p.type === 'AVANT')
                        .map((p) => (
                          <img
                            key={p.id}
                            src={p.url}
                            loading="lazy"
                            decoding="async"
                            className="w-full rounded-lg shadow-sm"
                            alt="Avant"
                          />
                        ))}
                      {!formData.photos?.some((p) => p.type === 'AVANT') && (
                        <p className="text-center text-xs text-slate-700 dark:text-slate-200 dark:text-white mt-10">
                          Aucune photo "Avant"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col">
                    <h4 className="font-bold text-center text-slate-700 dark:text-slate-200 dark:text-white mb-2">
                      APRÈS
                    </h4>
                    <div className="flex-1 overflow-y-auto space-y-2">
                      {formData.photos
                        ?.filter((p) => p.type === 'APRES')
                        .map((p) => (
                          <img
                            key={p.id}
                            src={p.url}
                            loading="lazy"
                            decoding="async"
                            className="w-full rounded-lg shadow-sm"
                            alt="Après"
                          />
                        ))}
                      {!formData.photos?.some((p) => p.type === 'APRES') && (
                        <p className="text-center text-xs text-slate-700 dark:text-slate-200 dark:text-white mt-10">
                          Aucune photo "Après"
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {formData.photos
                    ?.filter((p) => p.type === activePhotoTab)
                    .map((photo) => (
                      <div
                        key={photo.id}
                        className="relative aspect-square bg-slate-100 rounded-xl overflow-hidden group shadow-sm"
                      >
                        <img
                          src={photo.url}
                          loading="lazy"
                          decoding="async"
                          alt="Chantier"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => deletePhoto(photo.id)}
                          className="absolute top-2 right-2 p-2 bg-white dark:bg-slate-900/90 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm hover:scale-110"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  {formData.photos?.filter((p) => p.type === activePhotoTab).length === 0 && (
                    <div className="col-span-full py-12 text-center text-slate-700 dark:text-slate-200 dark:text-white border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                      <ImageIcon size={32} className="mx-auto mb-2 opacity-50" />
                      <p>Aucune photo dans cette catégorie</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Validation Date Modal */}
          {showValidationModal && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 print:hidden">
              <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm shadow-2xl p-6">
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 dark:text-white dark:text-white mb-4">
                  Dates des travaux
                </h3>
                <p className="text-sm text-slate-700 dark:text-slate-200 dark:text-white mb-4">
                  Le devis est validé. Veuillez confirmer les dates prévues.
                </p>

                <div className="space-y-4">
                  <div>
                    <label className={labelClass}>Date Début</label>
                    <input
                      type="date"
                      value={validationDates.start}
                      onChange={(e) =>
                        setValidationDates({ ...validationDates, start: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Date Fin</label>
                    <input
                      type="date"
                      value={validationDates.end}
                      onChange={(e) =>
                        setValidationDates({ ...validationDates, end: e.target.value })
                      }
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 mt-6">
                  <button
                    onClick={() => setShowValidationModal(false)}
                    className="px-4 py-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 rounded-lg text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={confirmValidation}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold"
                  >
                    Confirmer
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProjectDetail;
