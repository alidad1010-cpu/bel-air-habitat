import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Trash2,
  User,
  Upload,
  Printer,
  Globe,
  Save,
  X,
  ExternalLink,
  Briefcase,
  DollarSign,
  Camera,
  FileText,
  Download,
  Loader2,
  Clock,
  Calendar,
  CheckSquare,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Ban,
  RotateCw,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  Employee,
  EmployeeDocument,
  Expense,
  ExpenseCategory,
  ExpenseType,
  AttendanceRecord,
  AttendanceStatus,
} from '../types';
import { uploadFileToCloud } from '../services/firebaseService';
import { analyzeExpenseReceipt } from '../services/geminiService';

interface EmployeesPageProps {
  employees: Employee[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployee: (emp: Employee) => void;
  onDeleteEmployee: (id: string) => void;
  expenses: Expense[];
  onAddExpense: (expense: Expense) => void;
  onUpdateExpense: (expense: Expense) => void;
  onDeleteExpense: (id: string) => void;
  attendances: AttendanceRecord[];
  onUpdateAttendance: (record: AttendanceRecord) => void;
  onBulkUpdateAttendance: (records: AttendanceRecord[]) => void;
  onBulkDeleteAttendance: (ids: string[]) => void;
}

const EmployeesPage: React.FC<EmployeesPageProps> = ({
  employees,
  onAddEmployee,
  onUpdateEmployee,
  onDeleteEmployee,
  expenses = [],
  onAddExpense,
  onUpdateExpense,
  onDeleteExpense,
  attendances = [],
  onUpdateAttendance,
  onBulkUpdateAttendance,
  onBulkDeleteAttendance,
}) => {
  // MAIN TABS (REMOVED: EXPENSES at top level)
  const [mainTab, setMainTab] = useState<'EMPLOYEES' | 'TIME'>('EMPLOYEES');

  // --- EMPLOYEES STATE ---
  const [viewMode, setViewMode] = useState<'LIST' | 'FOREIGNERS'>('LIST');
  const [activeTab, setActiveTab] = useState<'DETAILS' | 'DOCS' | 'EXPENSES'>('DETAILS');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // --- EXPENSES STATE (Inside Modal) ---
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false); // Only for "Add New"
  const [expenseMode, setExpenseMode] = useState<'SELECT' | 'FORM'>('SELECT');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- TIME TRACKING STATE ---
  const [currentDate, setCurrentDate] = useState(new Date());

  // Single cell selection (for status)
  const [selectedCell, setSelectedCell] = useState<{ empId: string; date: string } | null>(null);

  // BULK SELECTION STATE
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{ empId: string; date: string } | null>(
    null
  );
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());

  // TIME MODAL STATE
  const [isTimeModalOpen, setIsTimeModalOpen] = useState(false);
  const [timeFormData, setTimeFormData] = useState({ startTime: '09:00', endTime: '17:00' });

  // Default empty employee
  const emptyEmployee: Employee = {
    id: '',
    firstName: '',
    lastName: '',
    position: '',
    startDate: new Date().toISOString().split('T')[0],
    nationality: 'Française',
    isForeigner: false,
    isActive: true,
    email: '',
    phone: '',
    address: '',
    idCardNumber: '',
    ssn: '',
    documents: [],
  };

  const emptyExpense: Expense = {
    id: '',
    date: new Date().toISOString().split('T')[0],
    merchant: '',
    amount: 0,
    vat: 0,
    currency: 'EUR',
    category: ExpenseCategory.OTHER,
    type: ExpenseType.VARIABLE,
    notes: '',
    createdAt: 0,
  };

  const [formData, setFormData] = useState<Employee>(emptyEmployee);
  const [expenseFormData, setExpenseFormData] = useState<Expense>(emptyExpense);

  // --- EMPLOYEES LOGIC ---
  const filteredEmployees = employees.filter((e) => {
    const matchesSearch =
      e.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.position.toLowerCase().includes(searchQuery.toLowerCase());

    if (viewMode === 'FOREIGNERS') {
      return matchesSearch && e.isForeigner;
    }
    return matchesSearch;
  });

  // Filtered Expenses for the Selected Employee
  const employeeExpenses = useMemo(() => {
    if (!selectedEmployee) return [];
    return expenses.filter((e) => e.employeeId === selectedEmployee.id);
  }, [expenses, selectedEmployee]);

  const handleOpenModal = (emp?: Employee) => {
    // Reset tab to DETAILS when opening a new employee
    setActiveTab('DETAILS');

    if (emp) {
      setSelectedEmployee(emp);
      setFormData(emp);
    } else {
      setSelectedEmployee(null);
      setFormData({ ...emptyEmployee, id: Date.now().toString() });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee) {
      onUpdateEmployee(formData);
    } else {
      onAddEmployee(formData);
    }
    setIsModalOpen(false);
  };

  // Helper for image compression
  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1280;
          const MAX_HEIGHT = 1280;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error('Compression failed'));
            },
            'image/jpeg',
            0.7
          );
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  // --- DOCUMENT HANDLING (EMPLOYEES) ---
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: EmployeeDocument['type']
  ) => {
    const originalFile = e.target.files?.[0];
    if (!originalFile) return;

    setIsUploading(true);
    try {
      let fileToUpload: File = originalFile;

      // Compress if image
      if (originalFile.type.startsWith('image/')) {
        try {
          const compressedBlob = await compressImage(originalFile);
          fileToUpload = new File([compressedBlob], originalFile.name, { type: 'image/jpeg' });
        } catch (cErr) {
          console.warn('Image compression failed, using original', cErr);
        }
      }

      const empId = formData.id;
      const safeName = fileToUpload.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const path = `employees/${empId}/documents/${Date.now()}_${safeName}`;

      let url;
      try {
        url = await uploadFileToCloud(path, fileToUpload);
      } catch (err) {
        console.warn('Cloud upload failed, fallback to local base64');
        // 4.5MB limit for Base64
        if (fileToUpload.size > 4.5 * 1024 * 1024)
          throw new Error('Fichier trop lourd pour le mode hors-ligne.');

        const reader = new FileReader();
        url = await new Promise<string>((resolve) => {
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(fileToUpload);
        });
      }

      const newDoc: EmployeeDocument = {
        id: Date.now().toString(),
        name: fileToUpload.name,
        type: type,
        date: new Date().toISOString(),
        url: url,
      };
      const updatedEmp = { ...formData, documents: [...(formData.documents || []), newDoc] };
      setFormData(updatedEmp);
      if (selectedEmployee) onUpdateEmployee(updatedEmp);
    } catch (error: any) {
      alert(`Erreur upload: ${error.message}`);
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const deleteDocument = (docId: string) => {
    if (confirm('Supprimer ce document ?')) {
      const updatedEmp = {
        ...formData,
        documents: formData.documents?.filter((d) => d.id !== docId),
      };
      setFormData(updatedEmp);
      if (selectedEmployee) onUpdateEmployee(updatedEmp);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // --- EXPENSES LOGIC ---
  const handleOpenExpenseModal = () => {
    // Automatically link to selected employee
    setExpenseFormData({
      ...emptyExpense,
      id: Date.now().toString(),
      createdAt: Date.now(),
      employeeId: selectedEmployee?.id,
    });
    setExpenseMode('SELECT');
    setIsExpenseModalOpen(true);
  };

  const handleAnalyzeExpense = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const result = await analyzeExpenseReceipt(file);
      console.log('Analysis Result:', result);
      if (result) {
        setExpenseFormData((prev) => ({
          ...prev,
          date: result.date || prev.date,
          merchant: result.merchant || '',
          amount: result.amount || 0,
          vat: result.vat || 0,
          currency: result.currency || 'EUR',
          category: (result.category as ExpenseCategory) || ExpenseCategory.OTHER,
          type: result.type || ExpenseType.VARIABLE,
          notes: result.notes || '',
        }));
        // Switch to form view to validate
        setExpenseMode('FORM');
      } else {
        alert("L'analyse a échoué. Veuillez saisir manuellement.");
        setExpenseMode('FORM');
      }
    } catch (error) {
      console.error('Analysis Error', error);
      alert("Erreur lors de l'analyse.");
      setExpenseMode('FORM');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileSelectForAnalysis = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        alert('Le fichier est trop lourd. La limite est de 20 Mo.');
        e.target.value = '';
        return;
      }
      handleAnalyzeExpense(file);
    }
  };

  const handleSaveExpense = () => {
    // Validation basic
    if (!expenseFormData.merchant || expenseFormData.amount <= 0) {
      alert('Veuillez remplir au moins le commerçant et un montant valide.');
      return;
    }

    // Ensure employee ID is set
    if (!selectedEmployee) {
      alert('Erreur: Aucun salarié sélectionné.');
      return;
    }

    const finalExpense = { ...expenseFormData, employeeId: selectedEmployee.id };
    onAddExpense(finalExpense);
    setIsExpenseModalOpen(false);
  };

  // Export JUST for this employee
  const handleExportEmployeeExpenses = () => {
    if (!selectedEmployee) return;
    if (employeeExpenses.length === 0) {
      alert('Aucune dépense à exporter pour ce salarié.');
      return;
    }

    // CSV Header
    let csvContent = 'Date;Fournisseur;Montant Total (TTC);TVA;Montant HT;Categorie;Type;Objet\n';

    employeeExpenses.forEach((exp) => {
      const date = new Date(exp.date).toLocaleDateString('fr-FR');
      const total = exp.amount.toFixed(2);
      const vat = (exp.vat || 0).toFixed(2);
      const ht = (exp.amount - (exp.vat || 0)).toFixed(2);
      const notes = (exp.notes || '').replace(/;/g, ','); // Escape semicolons

      csvContent += `${date};${exp.merchant};${total};${vat};${ht};${exp.category};${exp.type};${notes}\n`;
    });

    // Download logic
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = `notes_frais_${selectedEmployee.lastName}_${selectedEmployee.firstName}_${new Date().toISOString().split('T')[0]}.csv`;

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- TIME TRACKING LOGIC ---
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const daysArray = [];
    for (let i = 1; i <= days; i++) {
      daysArray.push(new Date(year, month, i));
    }
    return daysArray;
  };

  const daysOfMonth = useMemo(() => getDaysInMonth(currentDate), [currentDate]);

  const getAttendance = (empId: string, date: string) => {
    return attendances.find((a) => a.employeeId === empId && a.date === date);
  };

  const handleCellClick = (empId: string, dateStr: string) => {
    setSelectedCell({ empId, date: dateStr });
  };

  const updateAttendanceStatus = (status: AttendanceStatus) => {
    if (!selectedCell) return;
    const { empId, date } = selectedCell;

    const existing = getAttendance(empId, date);
    const record: AttendanceRecord = {
      id: existing?.id || `${empId}_${date}`,
      employeeId: empId,
      date: date,
      status: status,
      totalHours: status === AttendanceStatus.PRESENT ? 7 : 0, // Default 7h standard
      overtimeHours: 0,
      startTime: status === AttendanceStatus.PRESENT ? '09:00' : undefined,
      endTime: status === AttendanceStatus.PRESENT ? '17:00' : undefined,
      updatedAt: Date.now(),
    };
    onUpdateAttendance(record);
    setSelectedCell(null);
  };

  const handleBulkStatusUpdate = (status: AttendanceStatus) => {
    if (
      !confirm(
        `Marquer tous les salariés comme "${status}" pour ce mois ? (Attention, cela écrasera les données existantes)`
      )
    )
      return;

    const newRecords: AttendanceRecord[] = [];
    employees.forEach((emp) => {
      daysOfMonth.forEach((day) => {
        const dateStr = day.toISOString().split('T')[0];
        // Skip weekends if standard present
        const isWeekend = day.getDay() === 0 || day.getDay() === 6;
        if (status === AttendanceStatus.PRESENT && isWeekend) return;

        newRecords.push({
          id: `${emp.id}_${dateStr}`,
          employeeId: emp.id,
          date: dateStr,
          status: status,
          totalHours: status === AttendanceStatus.PRESENT ? 7 : 0,
          updatedAt: Date.now(),
        });
      });
    });
    onBulkUpdateAttendance(newRecords);
  };

  // --- BULK SELECTION HANDLERS ---
  const getCellId = (empId: string, date: string) => `${empId}_${date}`;

  const handleMouseDown = (empId: string, date: string) => {
    setIsDragging(true);
    setSelectionStart({ empId, date });
    setSelectedCells(new Set([getCellId(empId, date)]));
    setSelectedCell(null); // Clear single selection
  };

  const handleMouseEnter = (empId: string, date: string) => {
    if (!isDragging || !selectionStart) return;

    // Calculate range
    const startEmpIndex = employees.findIndex((e) => e.id === selectionStart.empId);
    const endEmpIndex = employees.findIndex((e) => e.id === empId);

    // Only allow same-employee selection for now or multi-row? Let's do simple rectangle.
    // Actually, user said "glisser la souris pour sélectionner 5 jours d'affilée ou cocher plusieurs cases"
    // Let's support arbitrary selection rectangle

    const newSelection = new Set<string>();

    // Determine min/max indices
    const minEmpIdx = Math.min(startEmpIndex, endEmpIndex);
    const maxEmpIdx = Math.max(startEmpIndex, endEmpIndex);

    // Date range
    const startDateObj = new Date(selectionStart.date);
    const endDateObj = new Date(date);
    const startTs = startDateObj.getTime();
    const endTs = endDateObj.getTime();
    const minTs = Math.min(startTs, endTs);
    const maxTs = Math.max(startTs, endTs);

    for (let i = minEmpIdx; i <= maxEmpIdx; i++) {
      const emp = employees[i];
      daysOfMonth.forEach((day) => {
        const ts = day.getTime();
        // Naive check: is ts between min and max strings? Careful with time components.
        // We use date strings YYYY-MM-DD
        const dayTs = new Date(day.toISOString().split('T')[0]).getTime();
        if (dayTs >= minTs && dayTs <= maxTs) {
          newSelection.add(getCellId(emp.id, day.toISOString().split('T')[0]));
        }
      });
    }
    setSelectedCells(newSelection);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setSelectionStart(null);
  };

  const handleApplySchedule = () => {
    if (selectedCells.size === 0) return;

    const updates: AttendanceRecord[] = [];
    selectedCells.forEach((cellId) => {
      const [empId, date] = cellId.split('_');
      // Auto skip weekends? User wants to "Apply Schedule", maybe they force it on weekend?
      // Let's assume force application if selected.

      updates.push({
        id: cellId,
        employeeId: empId,
        date: date,
        status: AttendanceStatus.PRESENT,
        startTime: timeFormData.startTime,
        endTime: timeFormData.endTime,
        totalHours: 0, // Should calc, but let's leave 0 or calc simple diff
        overtimeHours: 0,
        updatedAt: Date.now(),
      });
    });

    // Simple calc helper
    updates.forEach((u) => {
      const starth = parseInt(u.startTime?.split(':')[0] || '9');
      const endh = parseInt(u.endTime?.split(':')[0] || '17');
      u.totalHours = Math.max(0, endh - starth - 1); // Remove 1h break roughly?
      // User just asked for "Apply Schedule", strict calc module is later/other
      if (u.totalHours === 0) u.totalHours = 7; // Fallback default
    });

    onBulkUpdateAttendance(updates);
    setIsTimeModalOpen(false);
    setSelectedCells(new Set()); // Clear selection after apply
  };

  const handleBulkClearSelection = () => {
    if (!confirm('Effacer la sélection ?')) return;
    const ids = Array.from(selectedCells).map((cellId) => {
      const [empId, date] = cellId.split('_');
      // Try to find existing record ID if different pattern,
      // but here ID pattern IS empId_date mostly.
      // However, `getAttendance` uses find.
      const existing = getAttendance(empId, date);
      return existing ? existing.id : cellId;
    });
    onBulkDeleteAttendance(ids);
    setSelectedCells(new Set());
  };

  const handleResetMonth = () => {
    if (
      !confirm(
        'Voulez-vous vraiment réinitialiser (effacer) toutes les présences pour ce mois ? Cette action est irréversible.'
      )
    )
      return;
    const idsToDelete: string[] = [];
    employees.forEach((emp) => {
      daysOfMonth.forEach((day) => {
        const dateStr = day.toISOString().split('T')[0];
        const record = getAttendance(emp.id, dateStr);
        if (record) {
          idsToDelete.push(record.id);
        }
      });
    });

    if (idsToDelete.length > 0) {
      onBulkDeleteAttendance(idsToDelete);
    }
  };

  const exportPayroll = () => {
    const doc = new jsPDF();

    // ADD LOGO (Placeholder text or simple graphic since we don't have a file)
    doc.setFillColor(16, 185, 129); // Emerald 500
    doc.rect(0, 0, 210, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('BEL AIR HABITAT', 14, 13);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(12);
    doc.text(
      `Rapport Mensuel de Paie - ${currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      14,
      30
    );

    // PREPARE DATA - AGGREGATION
    const tableData = employees.map((emp) => {
      let totalHours = 0;
      let leaveDays = 0;
      let sickDays = 0;
      let unjustifiedDays = 0;

      daysOfMonth.forEach((day) => {
        const dateStr = day.toISOString().split('T')[0];
        const record = getAttendance(emp.id, dateStr);

        if (record) {
          totalHours += record.totalHours || 0;
          if (record.status === AttendanceStatus.PAID_LEAVE) leaveDays++;
          if (record.status === AttendanceStatus.SICK_LEAVE) sickDays++;
          if (record.status === AttendanceStatus.UNJUSTIFIED) unjustifiedDays++;
        }
      });

      return [
        `${emp.lastName} ${emp.firstName}`,
        totalHours + ' h',
        leaveDays,
        sickDays,
        unjustifiedDays,
      ];
    });

    // GENERATE TABLE
    autoTable(doc, {
      head: [['Salarié', 'Heures Trav.', 'Congés (Jour)', 'Maladie (Jour)', 'Abs. Injustifiées']],
      body: tableData,
      startY: 40,
      theme: 'grid',
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { textColor: 50 },
      alternateRowStyles: { fillColor: [240, 253, 244] },
      margin: { top: 40 },
    });

    doc.save(`rapport_paie_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}.pdf`);
  };

  const inputClass =
    'w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white placeholder-slate-400 text-sm';
  const labelClass = 'block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase mb-1';

  return (
    <div className="space-y-6 animate-fade-in relative">
      {/* HEADER & CONTROLS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
            {mainTab === 'EMPLOYEES' ? <User size={24} /> : <Clock size={24} />}
          </div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
              {mainTab === 'EMPLOYEES' ? 'Gestion des Salariés' : "Relevé d'Heures"}
            </h2>
            <p className="text-slate-700 dark:text-white text-sm">
              Ressources Humaines & Comptabilité
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          {/* APP TAB SWITCHER */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setMainTab('EMPLOYEES')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${mainTab === 'EMPLOYEES' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-white' : 'text-slate-500'}`}
            >
              Salariés
            </button>
            <button
              onClick={() => setMainTab('TIME')}
              className={`px-4 py-2 rounded-md text-sm font-bold transition-all ${mainTab === 'TIME' ? 'bg-white dark:bg-slate-700 shadow text-emerald-600 dark:text-white' : 'text-slate-500'}`}
            >
              Heures
            </button>
          </div>

          {mainTab === 'EMPLOYEES' && (
            <>
              <button
                onClick={handlePrint}
                className="p-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white rounded-lg hover:bg-slate-200 transition-colors"
                title="Imprimer la liste (PDF)"
              >
                <Printer size={20} />
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="flex items-center bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors text-sm whitespace-nowrap"
              >
                <Plus size={18} className="mr-2" /> Ajouter
              </button>
            </>
          )}

          {mainTab === 'TIME' && (
            <button
              onClick={exportPayroll}
              className="flex items-center bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors text-sm whitespace-nowrap"
            >
              <FileSpreadsheet size={18} className="mr-2" /> Export Paie
            </button>
          )}
        </div>
      </div>

      {/* --- EMPLOYEES VIEW --- */}
      {mainTab === 'EMPLOYEES' && (
        <>
          {/* VIEW SWITCHER */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-full md:w-fit print:hidden">
            <button
              onClick={() => setViewMode('LIST')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-white' : 'text-slate-700 dark:text-white hover:text-slate-700 dark:text-white'}`}
            >
              Tous les Salariés
            </button>
            <button
              onClick={() => setViewMode('FOREIGNERS')}
              className={`px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center ${viewMode === 'FOREIGNERS' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-white' : 'text-slate-700 dark:text-white hover:text-slate-700 dark:text-white'}`}
            >
              <Globe size={16} className="mr-2" /> Salariés Étrangers (Hors UE)
            </button>
          </div>

          <div className="relative w-full md:w-96 print:hidden">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700 dark:text-white"
              size={18}
            />
            <input
              type="text"
              placeholder="Rechercher un salarié..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm dark:text-white"
            />
          </div>

          {/* EMPLOYEES TABLE */}
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden overflow-x-auto print:shadow-none print:border-0 print:overflow-visible">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-white font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4">Salarié</th>
                  <th className="px-6 py-4">Poste</th>
                  <th className="px-6 py-4">Début Poste</th>
                  <th className="px-6 py-4">Nationalité</th>
                  <th className="px-6 py-4 hidden md:table-cell">Pièce d'Identité</th>
                  <th className="px-6 py-4 text-right print:hidden">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-700 dark:text-white italic"
                    >
                      Aucun salarié trouvé dans cette catégorie.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr
                      key={emp.id}
                      onClick={() => handleOpenModal(emp)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mr-3 text-xs">
                            {emp.firstName.charAt(0)}
                            {emp.lastName.charAt(0)}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 dark:text-white uppercase">
                              {emp.lastName} {emp.firstName}
                            </div>
                            <div className="text-xs text-slate-700 dark:text-white print:hidden">
                              {emp.email || emp.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700 dark:text-white">
                        {emp.position}
                      </td>
                      <td className="px-6 py-4 text-slate-700 dark:text-white">
                        {new Date(emp.startDate).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold ${emp.isForeigner ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-white'}`}
                        >
                          {emp.isForeigner && <Globe size={10} className="mr-1" />}
                          {emp.nationality}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell font-mono text-xs">
                        {emp.idCardNumber || '-'}
                      </td>
                      <td className="px-6 py-4 text-right print:hidden">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEmployee(emp.id);
                          }}
                          className="p-2 text-slate-700 dark:text-white hover:text-red-500 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
        </>
      )}

      {/* --- TIME TRACKING VIEW --- */}
      {mainTab === 'TIME' && (
        <div className="space-y-4">
          {/* Time Controls */}
          <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800">
            <div className="flex items-center space-x-4">
              <button
                onClick={() =>
                  setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))
                }
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <ChevronLeft size={20} className="text-slate-800 dark:text-white" />
              </button>
              <span className="text-lg font-bold capitalize text-slate-800 dark:text-white">
                {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
              </span>
              <button
                onClick={() =>
                  setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))
                }
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <ChevronRight size={20} className="text-slate-800 dark:text-white" />
              </button>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleResetMonth}
                className="text-xs font-bold bg-slate-100 text-slate-700 px-3 py-2 rounded-lg hover:bg-slate-200 border border-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-white flex items-center"
              >
                <RotateCw size={14} className="mr-1" /> Réinitialiser
              </button>
              <button
                onClick={() => handleBulkStatusUpdate(AttendanceStatus.PRESENT)}
                className="text-xs font-bold bg-emerald-100 text-emerald-700 px-3 py-2 rounded-lg hover:bg-emerald-200 flex items-center"
              >
                <CheckSquare size={14} className="mr-1" /> Tout Présent
              </button>
            </div>
          </div>

          {/* BULK ACTIONS BAR (When Selection Active) */}
          {selectedCells.size > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-6 z-50 animate-in slide-in-from-bottom-4">
              <span className="font-bold text-sm">{selectedCells.size} cellule(s)</span>
              <div className="h-4 w-px bg-slate-700"></div>
              <button
                onClick={() => setIsTimeModalOpen(true)}
                className="flex items-center hover:text-emerald-400 font-bold text-sm"
              >
                <Clock size={16} className="mr-2" /> Appliquer Horaire
              </button>
              <button
                onClick={handleBulkClearSelection}
                className="flex items-center hover:text-red-400 font-bold text-sm"
              >
                <Trash2 size={16} className="mr-2" /> Effacer
              </button>
              <button
                onClick={() => setSelectedCells(new Set())}
                className="ml-4 p-1 hover:bg-slate-800 rounded-full"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* TIME EDIT MODAL */}
          {isTimeModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4 animate-in zoom-in-95">
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">
                  Définir l'Horaire
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Début</label>
                    <input
                      type="time"
                      value={timeFormData.startTime}
                      onChange={(e) =>
                        setTimeFormData({ ...timeFormData, startTime: e.target.value })
                      }
                      className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1">Fin</label>
                    <input
                      type="time"
                      value={timeFormData.endTime}
                      onChange={(e) =>
                        setTimeFormData({ ...timeFormData, endTime: e.target.value })
                      }
                      className="w-full p-2 bg-slate-100 dark:bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    onClick={() => setIsTimeModalOpen(false)}
                    className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg font-bold text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleApplySchedule}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700"
                  >
                    Appliquer
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Time Grid */}
          <div
            className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto select-none"
            onMouseLeave={handleMouseUp}
          >
            <table className="w-full text-xs text-center border-collapse">
              <thead>
                <tr>
                  <th className="p-4 text-left min-w-[150px] sticky left-0 bg-white dark:bg-slate-900 text-slate-800 dark:text-white z-10 border-b border-slate-200 dark:border-slate-800">
                    Salarié
                  </th>
                  {daysOfMonth.map((day) => (
                    <th
                      key={day.toISOString()}
                      className={`p-2 min-w-[40px] border-l border-slate-100 dark:border-slate-800 ${day.getDay() === 0 || day.getDay() === 6 ? 'bg-slate-50 dark:bg-slate-800/50 text-slate-400' : 'text-slate-800 dark:text-white'}`}
                    >
                      <div className="font-bold">{day.getDate()}</div>
                      <div className="text-[10px] uppercase">
                        {day.toLocaleDateString('fr-FR', { weekday: 'short' })}
                      </div>
                    </th>
                  ))}
                  <th className="p-4 min-w-[80px] font-bold text-slate-800 dark:text-white border-l border-b border-slate-200 dark:border-slate-800">
                    Total H
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  let totalHours = 0;
                  return (
                    <tr
                      key={emp.id}
                      className="border-t border-slate-100 dark:border-slate-800 group hover:bg-slate-50 dark:hover:bg-slate-800/30"
                    >
                      <td className="p-3 text-left font-bold sticky left-0 bg-white dark:bg-slate-900 group-hover:bg-slate-50 dark:group-hover:bg-slate-800/30 z-10 border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">
                        {emp.firstName} {emp.lastName.charAt(0)}.
                      </td>
                      {daysOfMonth.map((day) => {
                        const dateStr = day.toISOString().split('T')[0];
                        const record = getAttendance(emp.id, dateStr);
                        const status = record?.status;
                        totalHours += record?.totalHours || 0;

                        let bgClass = 'transparent';
                        let content = '-';

                        if (status === AttendanceStatus.PRESENT) {
                          bgClass = 'bg-emerald-100 text-emerald-700';
                          content = 'P';
                        } else if (status === AttendanceStatus.PAID_LEAVE) {
                          bgClass = 'bg-blue-100 text-blue-700';
                          content = 'CP';
                        } else if (status === AttendanceStatus.SICK_LEAVE) {
                          bgClass = 'bg-red-100 text-red-700';
                          content = 'MAL';
                        } else if (status === AttendanceStatus.UNJUSTIFIED) {
                          bgClass = 'bg-orange-100 text-orange-700';
                          content = '?';
                        }

                        // Weekend formatting
                        if (day.getDay() === 0 || day.getDay() === 6) {
                          if (!status) bgClass = 'bg-slate-50 dark:bg-slate-800/50';
                        }

                        // Is selected?
                        const isSelected = selectedCells.has(`${emp.id}_${dateStr}`);

                        return (
                          <td
                            key={dateStr}
                            onMouseDown={() => handleMouseDown(emp.id, dateStr)}
                            onMouseEnter={() => handleMouseEnter(emp.id, dateStr)}
                            onMouseUp={handleMouseUp}
                            onClick={() => {
                              // If not dragging, treat as normal click (edit status)
                              if (!isDragging && selectedCells.size <= 1)
                                handleCellClick(emp.id, dateStr);
                            }}
                            className={`border-l border-slate-100 dark:border-slate-800 cursor-pointer transition-all ${bgClass} ${isSelected ? 'ring-2 ring-inset ring-blue-500 z-10' : 'hover:opacity-80'}`}
                          >
                            <div className="h-12 flex flex-col items-center justify-center font-bold text-slate-800 dark:text-white p-1">
                              <span>{content}</span>
                              {status === AttendanceStatus.PRESENT && record?.startTime && (
                                <span className="text-[9px] text-slate-500 font-mono leading-tight">
                                  {record.startTime}-{record.endTime}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="p-3 font-bold text-center border-l border-slate-200 dark:border-slate-800 text-slate-800 dark:text-white">
                        {totalHours}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Quick Legend */}
          <div className="flex gap-4 text-xs text-slate-500 justify-center">
            <div className="flex items-center">
              <span className="w-3 h-3 bg-emerald-100 mr-1 rounded"></span> Présent
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-blue-100 mr-1 rounded"></span> Congé Payé
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-red-100 mr-1 rounded"></span> Maladie
            </div>
            <div className="flex items-center">
              <span className="w-3 h-3 bg-orange-100 mr-1 rounded"></span> Injustifié
            </div>
          </div>
        </div>
      )}

      {/* --- EMPLOYEE MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                {selectedEmployee
                  ? `Fiche Salarié: ${selectedEmployee.firstName} ${selectedEmployee.lastName}`
                  : 'Nouveau Salarié'}
              </h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={handleSubmit}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-sm shadow-sm flex items-center"
                >
                  <Save size={16} className="mr-2" /> Enregistrer TOUT
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-700 dark:text-white hover:text-slate-700 dark:text-white p-2"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Modal Tabs */}
            {selectedEmployee && (
              <div className="px-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 flex space-x-4">
                <button
                  onClick={() => setActiveTab('DETAILS')}
                  className={`py-3 text-sm font-bold border-b-2 ${activeTab === 'DETAILS' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500'}`}
                >
                  Détails
                </button>
                <button
                  onClick={() => setActiveTab('DOCS')}
                  className={`py-3 text-sm font-bold border-b-2 ${activeTab === 'DOCS' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500'}`}
                >
                  Documents
                </button>
                <button
                  onClick={() => setActiveTab('EXPENSES')}
                  className={`py-3 text-sm font-bold border-b-2 ${activeTab === 'EXPENSES' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500'}`}
                >
                  Ses Notes de Frais
                </button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-900/50">
              {/* DETAILS TAB */}
              {(activeTab === 'DETAILS' || !selectedEmployee) && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2 md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h4 className="font-bold text-slate-800 dark:text-white flex items-center mb-4">
                        <User size={16} className="mr-2" /> Infos Personnelles
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className={labelClass}>Nom</label>
                          <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Prénom</label>
                          <input
                            type="text"
                            value={formData.firstName}
                            onChange={(e) =>
                              setFormData({ ...formData, firstName: e.target.value })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Email</label>
                          <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Téléphone</label>
                          <input
                            type="tel"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="col-span-2 md:col-span-1 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                      <h4 className="font-bold text-slate-800 dark:text-white flex items-center mb-4">
                        <Briefcase size={16} className="mr-2" /> Poste & Admin
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <label className={labelClass}>Poste</label>
                          <input
                            type="text"
                            value={formData.position}
                            onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Début</label>
                          <input
                            type="date"
                            value={formData.startDate}
                            onChange={(e) =>
                              setFormData({ ...formData, startDate: e.target.value })
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Nationalité</label>
                          <input
                            type="text"
                            value={formData.nationality}
                            onChange={(e) =>
                              setFormData({ ...formData, nationality: e.target.value })
                            }
                            className={inputClass}
                            placeholder="Ex: Française"
                          />
                        </div>
                        <div className="flex items-center pt-2">
                          <input
                            type="checkbox"
                            checked={formData.isForeigner}
                            onChange={(e) =>
                              setFormData({ ...formData, isForeigner: e.target.checked })
                            }
                            className="mr-2"
                          />
                          <span className="text-sm font-bold">Ressortissant Hors UE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* DOCS TAB */}
              {activeTab === 'DOCS' && (
                <div className="space-y-6">
                  <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <h4 className="font-bold text-slate-800 dark:text-white mb-4">
                      Documents Administratifs
                    </h4>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                      {[
                        { label: 'Contrat', type: 'CONTRACT' },
                        { label: 'Fiche de Paie', type: 'PAYSLIP' },
                        { label: 'Pièce Identité', type: 'ID_CARD' },
                      ].map((d) => (
                        <div key={d.type} className="relative group">
                          <button className="w-full text-left px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded font-bold text-xs flex justify-between items-center hover:bg-emerald-50">
                            + {d.label} <Upload size={14} />
                          </button>
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={(e) => handleFileUpload(e, d.type as any)}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2">
                      {formData.documents?.map((doc) => (
                        <div
                          key={doc.id}
                          className="flex justify-between items-center p-2 border rounded bg-slate-50"
                        >
                          <span className="text-sm font-bold">{doc.name}</span>
                          <div className="flex space-x-2">
                            <a href={doc.url} target="_blank" className="text-emerald-600">
                              <ExternalLink size={16} />
                            </a>
                            <button onClick={() => deleteDocument(doc.id)} className="text-red-500">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* EXPENSES TAB (INSIDE MODAL) */}
              {activeTab === 'EXPENSES' && (
                <div className="space-y-6">
                  {/* Action Bar */}
                  <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div>
                      <h4 className="font-bold text-slate-800 dark:text-white">
                        Historique des Frais
                      </h4>
                      <p className="text-xs text-slate-500">
                        Pour {selectedEmployee?.firstName} {selectedEmployee?.lastName}
                      </p>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleExportEmployeeExpenses}
                        className="p-2 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-white rounded-lg hover:bg-slate-100 flex items-center text-xs font-bold"
                      >
                        <Download size={14} className="mr-2" /> Exporter
                      </button>
                      <button
                        onClick={handleOpenExpenseModal}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg font-bold text-xs shadow-sm flex items-center"
                      >
                        <Plus size={14} className="mr-2" /> Ajouter une note
                      </button>
                    </div>
                  </div>

                  {/* Expense List */}
                  <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <table className="w-full text-sm text-left border-collapse">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-white font-bold uppercase text-xs border-b border-slate-200 dark:border-slate-800">
                        <tr>
                          <th className="px-6 py-4">Date</th>
                          <th className="px-6 py-4">Fournisseur</th>
                          <th className="px-6 py-4">Catégorie</th>
                          <th className="px-6 py-4 text-right">Montant</th>
                          <th className="px-6 py-4 text-right">TVA</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {employeeExpenses.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="px-6 py-12 text-center text-slate-700 dark:text-white italic"
                            >
                              Aucune note de frais pour ce salarié.
                            </td>
                          </tr>
                        ) : (
                          employeeExpenses.map((exp) => (
                            <tr
                              key={exp.id}
                              className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                            >
                              <td className="px-6 py-4 text-slate-700 dark:text-white">
                                {new Date(exp.date).toLocaleDateString('fr-FR')}
                              </td>
                              <td className="px-6 py-4 font-bold text-slate-800 dark:text-white">
                                {exp.merchant}
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-white rounded-md text-xs font-bold">
                                  {exp.category}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-right font-bold text-emerald-600">
                                {exp.amount.toFixed(2)} €
                              </td>
                              <td className="px-6 py-4 text-right text-slate-500 dark:text-slate-400">
                                {(exp.vat || 0).toFixed(2)} €
                              </td>
                              <td className="px-6 py-4 text-right">
                                <button
                                  onClick={() => onDeleteExpense(exp.id)}
                                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- EXPENSE MODAL (NEW RECORD) --- */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 print:hidden">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-white dark:bg-slate-900 shrink-0">
              <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
                Nouvelle Note de Frais
              </h3>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="text-slate-700 dark:text-white p-2"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-900/50">
              {/* MODE SELECTION */}
              {expenseMode === 'SELECT' && (
                <div className="space-y-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">
                    Comment souhaitez-vous saisir cette dépense ?
                  </p>

                  <button
                    onClick={() => setExpenseMode('FORM')}
                    className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all group"
                  >
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-full mr-4 group-hover:scale-110 transition-transform">
                      <FileText size={24} />
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-slate-800 dark:text-white">
                        Saisie Manuelle
                      </div>
                      <div className="text-xs text-slate-500">Remplir le formulaire standard</div>
                    </div>
                  </button>

                  <div className="relative w-full">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={handleFileSelectForAnalysis}
                    />
                    <div className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all pointer-events-none group">
                      <div className="p-3 bg-blue-100 text-blue-600 rounded-full mr-4 group-hover:scale-110 transition-transform">
                        <Camera size={24} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-slate-800 dark:text-white">
                          Scan Photo (IA)
                        </div>
                        <div className="text-xs text-slate-500">Prendre en photo le ticket</div>
                      </div>
                    </div>
                  </div>

                  <div className="relative w-full">
                    <input
                      type="file"
                      accept=".pdf"
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      onChange={handleFileSelectForAnalysis}
                    />
                    <div className="w-full p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all pointer-events-none group">
                      <div className="p-3 bg-purple-100 text-purple-600 rounded-full mr-4 group-hover:scale-110 transition-transform">
                        <Upload size={24} />
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-slate-800 dark:text-white">
                          Import Document (IA)
                        </div>
                        <div className="text-xs text-slate-500">Envoyer un fichier PDF</div>
                      </div>
                    </div>
                  </div>

                  {isAnalyzing && (
                    <div className="text-center py-4 text-emerald-600 animate-pulse flex flex-col items-center">
                      <Loader2 size={32} className="animate-spin mb-2" />
                      Analyse par Gemini en cours...
                    </div>
                  )}
                </div>
              )}

              {/* EXPENSE FORM */}
              {expenseMode === 'FORM' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Date</label>
                      <input
                        type="date"
                        value={expenseFormData.date}
                        onChange={(e) =>
                          setExpenseFormData({ ...expenseFormData, date: e.target.value })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Montant TTC</label>
                      <input
                        type="number"
                        step="0.01"
                        value={expenseFormData.amount}
                        onChange={(e) =>
                          setExpenseFormData({
                            ...expenseFormData,
                            amount: parseFloat(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>TVA (Est.)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={expenseFormData.vat}
                        onChange={(e) =>
                          setExpenseFormData({
                            ...expenseFormData,
                            vat: parseFloat(e.target.value),
                          })
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Fournisseur</label>
                      <input
                        type="text"
                        value={expenseFormData.merchant}
                        onChange={(e) =>
                          setExpenseFormData({ ...expenseFormData, merchant: e.target.value })
                        }
                        className={inputClass}
                        placeholder="Ex: Total Energies"
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Catégorie</label>
                    <select
                      value={expenseFormData.category}
                      onChange={(e) =>
                        setExpenseFormData({
                          ...expenseFormData,
                          category: e.target.value as ExpenseCategory,
                        })
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

                  <div>
                    <label className={labelClass}>Objet / Notes</label>
                    <textarea
                      value={expenseFormData.notes}
                      onChange={(e) =>
                        setExpenseFormData({ ...expenseFormData, notes: e.target.value })
                      }
                      className={`${inputClass} h-20 resize-none`}
                      placeholder="Description de la dépense..."
                    />
                  </div>

                  <button
                    onClick={handleSaveExpense}
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg transition-transform active:scale-95 flex justify-center items-center"
                  >
                    <Save size={18} className="mr-2" /> Valider la Note
                  </button>
                  <button
                    onClick={() => setExpenseMode('SELECT')}
                    className="w-full py-2 text-slate-500 text-sm hover:underline"
                  >
                    Retour
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* CELL EDIT MODAL (TIME/ATTENDANCE) */}
      {selectedCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">
              Saisie du {new Date(selectedCell.date).toLocaleDateString('fr-FR')}
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => updateAttendanceStatus(AttendanceStatus.PRESENT)}
                className="w-full p-3 rounded-lg bg-emerald-100 text-emerald-700 font-bold hover:bg-emerald-200 flex items-center justify-center"
              >
                Présent (Standard 7h)
              </button>
              <button
                onClick={() => updateAttendanceStatus(AttendanceStatus.PAID_LEAVE)}
                className="w-full p-3 rounded-lg bg-blue-100 text-blue-700 font-bold hover:bg-blue-200 flex items-center justify-center"
              >
                Congé Payé
              </button>
              <button
                onClick={() => updateAttendanceStatus(AttendanceStatus.SICK_LEAVE)}
                className="w-full p-3 rounded-lg bg-red-100 text-red-700 font-bold hover:bg-red-200 flex items-center justify-center"
              >
                Maladie
              </button>
              <button
                onClick={() => updateAttendanceStatus(AttendanceStatus.UNJUSTIFIED)}
                className="w-full p-3 rounded-lg bg-orange-100 text-orange-700 font-bold hover:bg-orange-200 flex items-center justify-center"
              >
                Absence Injustifiée
              </button>
              <div className="border-t border-slate-100 my-2"></div>
              <button
                onClick={() => setSelectedCell(null)}
                className="w-full p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeesPage;
