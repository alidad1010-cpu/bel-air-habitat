import React, { useState, useMemo, useRef } from 'react';
import {
    Receipt, Upload, Plus, DollarSign, TrendingUp, TrendingDown,
    FileText, Trash2, Edit2, X, PieChart, Printer
} from 'lucide-react';
import { Expense, ExpenseCategory, ExpenseType } from '../types';
import { analyzeExpenseReceipt } from '../services/geminiService';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { uploadFileToCloud } from '../services/firebaseService';
import { processImageForAI } from '../utils/imageProcessor';

interface ExpensesPageProps {
    expenses: Expense[];
    onAddExpense: (expense: Expense) => void;
    onUpdateExpense: (expense: Expense) => void;
    onDeleteExpense: (id: string) => void;
}

const ExpensesPage: React.FC<ExpensesPageProps> = ({ expenses, onAddExpense, onUpdateExpense, onDeleteExpense }) => {
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
                console.error("Image processing warning:", imageError);
                // Continue with original file if processing fails
            }

            // 2. Upload to Cloud (Attempt)
            try {
                const safeName = processedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
                const path = `expenses/general/${Date.now()}_${safeName}`;
                url = await uploadFileToCloud(path, processedFile);
            } catch (uploadError) {
                console.warn("Cloud Upload failed, falling back to local URL", uploadError);
                // Fallback to local URL for preview
                url = URL.createObjectURL(processedFile);
                alert("⚠️ Mode Hors-Ligne : Le justificatif est sauvegardé localement uniquement (Upload Cloud échoué).");
            }

            // 3. Analyze
            const extractedData = await analyzeExpenseReceipt(processedFile);

            if (!extractedData) {
                alert("L'analyse IA a échoué ou aucune donnée n'a été trouvée. Veuillez vérifier votre connexion ou remplir manuellement.");
            }

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

            setEditingExpense(newExpense);
            setIsModalOpen(true);
        } catch (error) {
            console.error("Critical error in expense flow", error);
            alert("Une erreur critique est survenue.");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingExpense) return;

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
            receiptUrl: editingExpense.receiptUrl
        };

        if (editingExpense.id) {
            onUpdateExpense(expenseToSave);
        } else {
            onAddExpense(expenseToSave);
        }
        setIsModalOpen(false);
        setEditingExpense(null);
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
        <div className="p-6 md:p-8 space-y-8 pb-24 animate-fade-in-up">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
                        <DollarSign className="text-emerald-500" size={32} />
                        Gestion des Dépenses
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Suivez et analysez vos coûts fixes et variables.
                    </p>
                </div>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button onClick={handlePrevMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><TrendingDown className="rotate-90" size={20} /></button>
                    <div className="px-4 py-2 font-bold min-w-[150px] text-center capitalize">
                        {currentDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                    </div>
                    <button onClick={handleNextMonth} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"><TrendingUp className="rotate-90" size={20} /></button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass-card p-6 rounded-2xl border-l-4 border-indigo-500 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Total Mensuel</p>
                            <h3 className="text-3xl font-black text-slate-900 dark:text-white mt-2">{stats.currentTotal.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</h3>
                        </div>
                        <div className={`p-3 rounded-xl ${stats.progress >= 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                            {stats.progress >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
                        </div>
                    </div>
                    <p className={`text-xs font-bold mt-4 ${stats.progress >= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {stats.progress > 0 ? '+' : ''}{Math.round(stats.progress)}% par rapport au mois dernier
                    </p>
                </div>

                <div className="glass-card p-6 rounded-2xl border-l-4 border-sky-500">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Dépenses Fixes</p>
                        <PieChart className="text-sky-500" size={20} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.fixed.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</h3>
                    <p className="text-slate-400 text-xs mt-2">Loyer, Assurances, Abonnements</p>
                </div>

                <div className="glass-card p-6 rounded-2xl border-l-4 border-amber-500">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-slate-500 dark:text-slate-400 text-sm font-medium uppercase tracking-wider">Dépenses Variables</p>
                        <Receipt className="text-amber-500" size={20} />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white">{stats.variable.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}</h3>
                    <p className="text-slate-400 text-xs mt-2">Carburant, Matériel, Resto</p>
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
                        className="h-full min-h-[200px] border-2 border-dashed border-indigo-300 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl flex flex-col items-center justify-center p-6 text-center cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-all group"
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
                            {currentMonthExpenses.filter(e => e.type === ExpenseType.VARIABLE).map(expense => (
                                <ExpenseItem key={expense.id} expense={expense} onEdit={() => { setEditingExpense(expense); setIsModalOpen(true); }} onDelete={() => onDeleteExpense(expense.id)} />
                            ))}
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
                            {currentMonthExpenses.filter(e => e.type === ExpenseType.FIXED).map(expense => (
                                <ExpenseItem key={expense.id} expense={expense} onEdit={() => { setEditingExpense(expense); setIsModalOpen(true); }} onDelete={() => onDeleteExpense(expense.id)} />
                            ))}
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

        </div>
    );
};

const ExpenseItem = ({ expense, onEdit, onDelete }: { expense: Expense, onEdit: () => void, onDelete: () => void }) => {
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
                    <div className="font-bold text-slate-800 dark:text-white">{expense.merchant}</div>
                    <div className="text-xs text-slate-500 flex gap-2">
                        <span>{new Date(expense.date).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>{expense.category}</span>
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
};

export default ExpensesPage;
