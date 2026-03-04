import React, { useState, useMemo, useRef } from 'react';
import { Plus, Upload, X, DollarSign, FileText, Receipt, TrendingUp, TrendingDown, PieChart, Printer, Edit2, Trash2, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { Expense, ExpenseCategory, ExpenseType, Project } from '../types';
import { uploadFileToCloud } from '../services/firebaseService';
import { analyzeExpenseReceipt } from '../services/routellmService';
import ErrorHandler from '../services/errorService';
import { FixedSizeList as List } from 'react-window';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const processImageForAI = async (file: File): Promise<File> => {
  const { processImageForAI: processor } = await import('../utils/imageProcessor');
  return processor(file);
};

interface ExpensesPageProps {
    expenses: Expense[];
    onAddExpense: (expense: Expense) => Promise<void>;
    onUpdateExpense: (expense: Expense) => Promise<void>;
    onDeleteExpense: (id: string) => void;
    projects?: Project[];
}

const ExpensesPage: React.FC<ExpensesPageProps> = ({ expenses, onAddExpense, onUpdateExpense, onDeleteExpense, projects = [] }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isUploading, setIsUploading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Partial<Expense> | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Month Navigation
    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };
    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    // Filter Expenses by Month
    const currentMonthExpenses = useMemo(() => {
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
        });
    }, [expenses, currentDate]);

    const prevMonthExpenses = useMemo(() => {
        const prevDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
        return expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === prevDate.getMonth() && d.getFullYear() === prevDate.getFullYear();
        });
    }, [expenses, currentDate]);

    // Statistics
    const stats = useMemo(() => {
        const currentTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const prevTotal = prevMonthExpenses.reduce((sum, e) => sum + e.amount, 0);
        const progress = prevTotal === 0 ? 100 : ((currentTotal - prevTotal) / prevTotal) * 100;

        const fixed = currentMonthExpenses.filter(e => e.type === ExpenseType.FIXED).reduce((sum, e) => sum + e.amount, 0);
        const variable = currentMonthExpenses.filter(e => e.type === ExpenseType.VARIABLE).reduce((sum, e) => sum + e.amount, 0);

        return { currentTotal, prevTotal, progress, fixed, variable };
    }, [currentMonthExpenses, prevMonthExpenses]);

    // Handle File Upload & AI Analysis
    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        console.log("🚀 VERSION SCANNER: FIX APPLIQUÉ (v2)");
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        let url = '';
        let processedFile = file;

        try {
            // 1. Compress
            try {
                processedFile = await processImageForAI(file);
            } catch (imageError) {
                // OPTIMIZATION: Use ErrorHandler for consistent error management
                if (import.meta.env.DEV) {
                    console.error("Image processing warning:", imageError);
                }
                ErrorHandler.handle(imageError, 'ExpensesPage - Image Processing');
                // Continue with original file if processing fails
            }

            // 2. Upload to Cloud (Attempt)
            try {
                const safeName = processedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const path = `expenses/general/${Date.now()}_${safeName}`;
                url = await uploadFileToCloud(path, processedFile);
            } catch (uploadError) {
                // OPTIMIZATION: Use ErrorHandler for consistent error management
                if (import.meta.env.DEV) {
                    console.warn("Cloud Upload failed, falling back to local URL", uploadError);
                }
                ErrorHandler.handle(uploadError, 'ExpensesPage - Cloud Upload');
                // Fallback to local URL for preview
                url = URL.createObjectURL(processedFile);
                alert("⚠️ Mode Hors-Ligne : Le justificatif est sauvegardé localement uniquement (Upload Cloud échoué).");
            }

            // 3. Analyze (Try AI, but don't block if it fails)
            let extractedData = null;

            try {
                console.log('🤖 Tentative d\'analyse IA...');
                console.log('📄 File type:', processedFile.type);
                console.log('📄 File name:', processedFile.name);
                console.log('📄 File size:', processedFile.size, 'bytes');

                extractedData = await analyzeExpenseReceipt(processedFile);

                if (extractedData) {
                    console.log('✅ Analyse IA réussie !', extractedData);
                    console.log('📊 Extracted data details:');
                    console.log('  - Date:', extractedData.date);
                    console.log('  - Merchant:', extractedData.merchant);
                    console.log('  - Amount:', extractedData.amount);
                    console.log('  - Category:', extractedData.category);
                    console.log('  - Type:', extractedData.type);
                    console.log('  - VAT:', extractedData.vat);
                    console.log('  - Notes:', extractedData.notes);
                } else {
                    console.log('⚠️ Analyse IA retourné null - Saisie manuelle');
                }
            } catch (aiError) {
                console.error('❌ Scanner IA erreur complète:', aiError);
                console.error('❌ Error stack:', aiError instanceof Error ? aiError.stack : 'No stack');
                // Continue sans bloquer l'utilisateur
            }

            // Ouvrir modal TOUJOURS (avec ou sans données IA)
            const newExpense: Partial<Expense> = {
                date: extractedData?.date || new Date().toISOString().split('T')[0],
                merchant: extractedData?.merchant || '',
                amount: extractedData?.amount || 0,
                category: extractedData?.category ? (extractedData.category as ExpenseCategory) : ExpenseCategory.OTHER,
                type: extractedData?.type || ExpenseType.VARIABLE,
                notes: extractedData?.notes || '',
                currency: extractedData?.currency || 'EUR',
                receiptUrl: url,
                vat: extractedData?.vat || 0
            };

            console.log('📝 Opening modal with expense data:', newExpense);
            setEditingExpense(newExpense);
            setIsModalOpen(true);
        } catch (_error) {
            // OPTIMIZATION: Use ErrorHandler for consistent error management
            ErrorHandler.handleAndShow(_error, 'ExpensesPage - Critical Error');
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('🔵 handleSubmit called');
        console.log('🔵 editingExpense:', editingExpense);

        if (!editingExpense) {
            console.log('❌ No editingExpense - returning early');
            return;
        }

        console.log('💾 Attempting to save expense...');
        console.log('📝 Editing expense data:', editingExpense);
        console.log('📝 Required fields check:');
        console.log('  - date:', editingExpense.date);
        console.log('  - merchant:', editingExpense.merchant);
        console.log('  - amount:', editingExpense.amount);

        if (!editingExpense.date || !editingExpense.merchant || !editingExpense.amount) {
            console.error('❌ Missing required fields!');
            alert('Veuillez remplir tous les champs obligatoires (Date, Marchand, Montant)');
            return;
        }

        const expenseToSave: Expense = {
            id: editingExpense.id || Date.now().toString(),
            createdAt: editingExpense.createdAt || Date.now(),
            updatedAt: Date.now(),
            date: editingExpense.date!,
            merchant: editingExpense.merchant!,
            amount: Number(editingExpense.amount),
            currency: editingExpense.currency || 'EUR',
            category: editingExpense.category || ExpenseCategory.OTHER,
            type: editingExpense.type || ExpenseType.VARIABLE,
            notes: editingExpense.notes,
            receiptUrl: editingExpense.receiptUrl,
            isRecurring: (editingExpense.type || ExpenseType.VARIABLE) === ExpenseType.FIXED ? true : editingExpense.isRecurring,
            recurringSourceId: editingExpense.recurringSourceId
        };

        console.log('💾 Expense to save:', expenseToSave);
        console.log('💾 Is update?', !!editingExpense.id);

        try {
            if (editingExpense.id) {
                console.log('💾 Calling onUpdateExpense...');
                await onUpdateExpense(expenseToSave);
            } else {
                console.log('💾 Calling onAddExpense...');
                await onAddExpense(expenseToSave);
            }
            console.log('✅ Save function called successfully');
            setIsModalOpen(false);
            setEditingExpense(null);
        } catch (error) {
            console.error('❌ Error saving expense:', error);
            alert('Erreur lors de la sauvegarde: ' + (error instanceof Error ? error.message : String(error)));
        }
    };

    const generatePDF = () => {
        const doc = new jsPDF();
        doc.text(`Relevé de Dépenses - ${currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`, 14, 20);

        // Summary
        doc.setFontSize(10);
        doc.text(`Total: ${stats.currentTotal.toFixed(2)} €`, 14, 30);
        doc.text(`Fixe: ${stats.fixed.toFixed(2)} €`, 60, 30);
        doc.text(`Variable: ${stats.variable.toFixed(2)} €`, 110, 30);

        const tableData = currentMonthExpenses.map(e => [
            new Date(e.date).toLocaleDateString('fr-FR'),
            e.merchant,
            e.category,
            e.type,
            `${e.amount.toFixed(2)} €`
        ]);

        autoTable(doc, {
            startY: 40,
            head: [['Date', 'Marchand', 'Catégorie', 'Type', 'Montant']],
            body: tableData,
        });

        doc.save(`depenses_${currentDate.getMonth() + 1}_${currentDate.getFullYear()}.pdf`);
    };

    return (
        <div className="space-y-6 pb-16 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                        Gestion des Dépenses
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Suivez et analysez vos coûts fixes et variables
                    </p>
                </div>
                <div className="flex bg-white dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-soft">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"><TrendingDown className="rotate-90" size={18} /></button>
                    <div className="px-4 py-2 font-semibold text-sm min-w-[140px] text-center capitalize text-slate-900 dark:text-white">
                        {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors text-slate-500"><TrendingUp className="rotate-90" size={18} /></button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Total Mensuel</p>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white mt-1.5">{stats.currentTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</h3>
                        </div>
                        <div className={`p-2.5 rounded-xl ${stats.progress >= 0 ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400' : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'}`}>
                            {stats.progress >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                        </div>
                    </div>
                    <p className={`text-xs font-semibold mt-3 ${stats.progress >= 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {stats.progress > 0 ? '+' : ''}{Math.round(stats.progress)}% par rapport au mois dernier
                    </p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft">
                    <div className="flex justify-between items-start mb-1.5">
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Dépenses Fixes</p>
                        <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/30"><PieChart className="text-blue-600 dark:text-blue-400" size={16} /></div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.fixed.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</h3>
                    <p className="text-slate-400 text-xs mt-1.5">Loyer, Assurances, Abonnements</p>
                </div>

                <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft">
                    <div className="flex justify-between items-start mb-1.5">
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">Dépenses Variables</p>
                        <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/30"><Receipt className="text-amber-600 dark:text-amber-400" size={16} /></div>
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.variable.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</h3>
                    <p className="text-slate-400 text-xs mt-1.5">Carburant, Matériel, Resto</p>
                </div>
            </div>

            {/* Main Action Area */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Upload Box */}
                <div className="lg:col-span-1">
                    <div
                        onClick={() => fileInputRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                            e.preventDefault();
                            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
                            }
                        }}
                        className="h-full min-h-[200px] border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-teal-50/50 dark:hover:bg-teal-950/20 hover:border-teal-300 dark:hover:border-teal-700 transition-all group"
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*,application/pdf,.heic"
                            capture="environment"
                            onChange={handleFileUpload}
                        />
                        <div className="w-16 h-16 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-lg mb-4 group-hover:scale-110 transition-transform">
                            {isUploading ? <TrendingUp className="animate-spin text-indigo-500" size={32} /> : <Upload className="text-indigo-500" size={32} />}
                        </div>
                        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Scanner un ticket</h3>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            Prenez une photo ou déposez un fichier.<br />
                            <span className="text-indigo-500 font-bold">Compatible iOS/Android/PC</span>
                        </p>
                    </div>
                </div>

                {/* Expenses List */}
                <div className="lg:col-span-3 space-y-8">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold dark:text-white">Détail du mois</h2>
                        <div className="flex gap-2">
                            <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-lg hover:bg-slate-300 transition-colors text-sm font-bold">
                                <Printer size={16} /> Imprimer
                            </button>
                            <button onClick={() => { setEditingExpense({}); setIsModalOpen(true); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-bold shadow-lg shadow-indigo-500/30">
                                <Plus size={16} /> Ajouter manuellement
                            </button>
                        </div>
                    </div>

                    {/* Variable Expenses Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center">
                            <div className="w-2 h-2 rounded-full bg-amber-500 mr-3"></div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">Dépenses Variables</h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {currentMonthExpenses.filter(e => e.type === ExpenseType.VARIABLE).length === 0 && (
                                <div className="p-8 text-center text-slate-400 italic text-sm">Aucune dépense variable ce mois-ci</div>
                            )}
                            {(() => {
                                const variableExpenses = currentMonthExpenses.filter(e => e.type === ExpenseType.VARIABLE);
                                if (variableExpenses.length > 10) {
                                    return (
                                        <List
                                            height={400}
                                            itemCount={variableExpenses.length}
                                            itemSize={72}
                                            width="100%"
                                        >
                                            {({ index, style }) => (
                                                <div style={style}>
                                                    <ExpenseItem
                                                        key={variableExpenses[index].id}
                                                        expense={variableExpenses[index]}
                                                        onEdit={() => { setEditingExpense(variableExpenses[index]); setIsModalOpen(true); }}
                                                        onDelete={() => onDeleteExpense(variableExpenses[index].id)}
                                                    />
                                                </div>
                                            )}
                                        </List>
                                    );
                                }
                                return variableExpenses.map(expense => (
                                    <ExpenseItem key={expense.id} expense={expense} onEdit={() => { setEditingExpense(expense); setIsModalOpen(true); }} onDelete={() => onDeleteExpense(expense.id)} />
                                ));
                            })()}
                        </div>
                    </div>

                    {/* Fixed Expenses Section */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center">
                            <div className="w-2 h-2 rounded-full bg-sky-500 mr-3"></div>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">Charges Fixes</h3>
                        </div>
                        <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {currentMonthExpenses.filter(e => e.type === ExpenseType.FIXED).length === 0 && (
                                <div className="p-8 text-center text-slate-400 italic text-sm">Aucune charge fixe ce mois-ci</div>
                            )}
                            {(() => {
                                const fixedExpenses = currentMonthExpenses.filter(e => e.type === ExpenseType.FIXED);
                                if (fixedExpenses.length > 10) {
                                    return (
                                        <List
                                            height={400}
                                            itemCount={fixedExpenses.length}
                                            itemSize={72}
                                            width="100%"
                                        >
                                            {({ index, style }) => (
                                                <div style={style}>
                                                    <ExpenseItem
                                                        key={fixedExpenses[index].id}
                                                        expense={fixedExpenses[index]}
                                                        onEdit={() => { setEditingExpense(fixedExpenses[index]); setIsModalOpen(true); }}
                                                        onDelete={() => onDeleteExpense(fixedExpenses[index].id)}
                                                    />
                                                </div>
                                            )}
                                        </List>
                                    );
                                }
                                return fixedExpenses.map(expense => (
                                    <ExpenseItem key={expense.id} expense={expense} onEdit={() => { setEditingExpense(expense); setIsModalOpen(true); }} onDelete={() => onDeleteExpense(expense.id)} />
                                ));
                            })()}
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700 animate-scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                            <h3 className="font-bold text-lg dark:text-white">{editingExpense?.id ? 'Modifier la dépense' : 'Ajouter une dépense'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        value={editingExpense?.date || ''}
                                        onChange={e => setEditingExpense(prev => ({ ...prev, date: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Montant TTC</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={editingExpense?.amount || ''}
                                        onChange={e => setEditingExpense(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Marchand / Bénéficiaire</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Ex: Total Energies, Leroy Merlin..."
                                    value={editingExpense?.merchant || ''}
                                    onChange={e => setEditingExpense(prev => ({ ...prev, merchant: e.target.value }))}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Type</label>
                                    <select
                                        value={editingExpense?.type || ExpenseType.VARIABLE}
                                        onChange={e => setEditingExpense(prev => ({ ...prev, type: e.target.value as ExpenseType }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                                    >
                                        <option value={ExpenseType.VARIABLE}>Variable</option>
                                        <option value={ExpenseType.FIXED}>Fixe (Mensuel)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">Catégorie</label>
                                    <select
                                        value={editingExpense?.category || ExpenseCategory.OTHER}
                                        onChange={e => setEditingExpense(prev => ({ ...prev, category: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl"
                                    >
                                        {Object.values(ExpenseCategory).map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Notes (Optionnel)</label>
                                <textarea
                                    rows={3}
                                    value={editingExpense?.notes || ''}
                                    onChange={e => setEditingExpense(prev => ({ ...prev, notes: e.target.value }))}
                                    className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border-none rounded-xl text-sm"
                                />
                            </div>

                            {editingExpense?.type === ExpenseType.FIXED && (
                                <div className="flex items-center gap-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="isRecurring"
                                        checked={editingExpense?.isRecurring || false}
                                        onChange={e => setEditingExpense(prev => ({ ...prev, isRecurring: e.target.checked }))}
                                        className="w-4 h-4 text-indigo-600 rounded"
                                    />
                                    <label htmlFor="isRecurring" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                        🔄 Dépense récurrente (se répète automatiquement chaque mois)
                                    </label>
                                </div>
                            )}

                            <div className="pt-4 flex justify-end gap-3">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">Annuler</button>
                                <button type="submit" className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-lg shadow-indigo-500/30">
                                    Enregistrer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========== BUDGET PAR CHANTIER SECTION ========== */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 shadow-soft overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white flex items-center text-sm uppercase tracking-wider">
                        <Building2 size={16} className="mr-2 text-teal-500" /> Budget par Chantier
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Dépenses regroupées par projet / chantier</p>
                </div>
                <div className="p-4 space-y-3">
                    {(() => {
                        // Group expenses by projectId
                        const byProject: Record<string, { expenses: Expense[]; total: number; projectName: string }> = {};
                        const unassigned: Expense[] = [];
                        
                        expenses.forEach(exp => {
                            if (exp.projectId) {
                                if (!byProject[exp.projectId]) {
                                    const proj = projects.find(p => p.id === exp.projectId);
                                    byProject[exp.projectId] = {
                                        expenses: [],
                                        total: 0,
                                        projectName: proj?.title || `Chantier ${exp.projectId.slice(0, 8)}`,
                                    };
                                }
                                byProject[exp.projectId].expenses.push(exp);
                                byProject[exp.projectId].total += exp.amount;
                            } else {
                                unassigned.push(exp);
                            }
                        });

                        const sortedProjects = Object.entries(byProject).sort((a, b) => b[1].total - a[1].total);
                        const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

                        if (sortedProjects.length === 0) {
                            return (
                                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                                    <Building2 size={32} className="mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">Aucune dépense n'est liée à un chantier</p>
                                    <p className="text-xs mt-1">Associez les dépenses à des projets pour voir la répartition</p>
                                </div>
                            );
                        }

                        return (
                            <>
                                {sortedProjects.map(([projId, data]) => {
                                    const pct = grandTotal > 0 ? (data.total / grandTotal) * 100 : 0;
                                    return (
                                        <div key={projId} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3 flex-1 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center flex-shrink-0">
                                                        <Building2 size={18} className="text-teal-600 dark:text-teal-400" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="font-bold text-sm text-slate-800 dark:text-white truncate">{data.projectName}</p>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400">{data.expenses.length} dépense{data.expenses.length !== 1 ? 's' : ''}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right flex-shrink-0 ml-4">
                                                    <p className="font-black text-lg text-slate-900 dark:text-white">{data.total.toLocaleString('fr-FR')} €</p>
                                                    <p className="text-xs text-teal-600 dark:text-teal-400 font-semibold">{pct.toFixed(1)}% du total</p>
                                                </div>
                                            </div>
                                            {/* Mini bar */}
                                            <div className="mt-3 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                                                <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                            {/* Category breakdown */}
                                            <div className="mt-2 flex flex-wrap gap-1.5">
                                                {Object.entries(
                                                    data.expenses.reduce((acc, e) => {
                                                        const cat = (e.category as string) || 'Autre';
                                                        acc[cat] = (acc[cat] || 0) + e.amount;
                                                        return acc;
                                                    }, {} as Record<string, number>)
                                                ).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amount]) => (
                                                    <span key={cat} className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 bg-white dark:bg-slate-900 rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300">
                                                        {cat}: {amount.toLocaleString('fr-FR')} €
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                                
                                {/* Unassigned expenses */}
                                {unassigned.length > 0 && (
                                    <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-3">
                                                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                                                    <Receipt size={18} className="text-amber-600 dark:text-amber-400" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-800 dark:text-white">Non assignées</p>
                                                    <p className="text-xs text-amber-600 dark:text-amber-400">{unassigned.length} dépense{unassigned.length !== 1 ? 's' : ''} sans chantier</p>
                                                </div>
                                            </div>
                                            <p className="font-black text-lg text-amber-700 dark:text-amber-400">
                                                {unassigned.reduce((s, e) => s + e.amount, 0).toLocaleString('fr-FR')} €
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Grand Total */}
                                <div className="flex justify-between items-center px-4 py-3 bg-teal-50 dark:bg-teal-900/20 rounded-xl border-2 border-teal-200 dark:border-teal-800">
                                    <span className="font-bold text-sm text-teal-800 dark:text-teal-300 uppercase">Total toutes dépenses</span>
                                    <span className="text-xl font-black text-teal-700 dark:text-teal-400">{grandTotal.toLocaleString('fr-FR')} €</span>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

        </div>
    );
};

const ExpenseItem = React.memo(({ expense, onEdit, onDelete }: { expense: Expense, onEdit: () => void, onDelete: () => void }) => {
    return (
        <div className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
                    {expense.category === ExpenseCategory.FUEL && <div className="text-amber-500">⛽</div>}
                    {expense.category === ExpenseCategory.RESTAURANT && <div className="text-amber-500">🍽️</div>}
                    {expense.category === ExpenseCategory.MATERIAL && <div className="text-indigo-500">🔨</div>}
                    {expense.category === ExpenseCategory.RENT && <div className="text-sky-500">🏠</div>}
                    {!Object.values(ExpenseCategory).includes(expense.category as any) && <FileText size={18} />}
                </div>
                <div>
                    <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {expense.merchant}
                        {expense.isRecurring && (
                            <span className="text-xs px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-full font-medium">
                                🔄 Récurrent
                            </span>
                        )}
                    </div>
                    <div className="text-xs text-slate-500 flex gap-2">
                        <span>{new Date(expense.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{expense.category}</span>
                        {expense.createdBy && (
                            <>
                                <span>•</span>
                                <span title={`Ajouté le ${new Date(expense.createdAt).toLocaleString()}`}>
                                    👤 {expense.createdBy}
                                </span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-6">
                <div className="font-mono font-bold text-slate-900 dark:text-white">
                    {expense.amount.toFixed(2)} €
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {expense.receiptUrl && (
                        <a
                            href={expense.receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 rounded-lg"
                            title="Voir le justificatif"
                        >
                            <FileText size={16} />
                        </a>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg"><Edit2 size={16} /></button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg"><Trash2 size={16} /></button>
                </div>
            </div>
        </div>
    );
});

ExpenseItem.displayName = 'ExpenseItem';

export default ExpensesPage;
