import {
  Devis,
  DevisStatus,
  DevisSection,
  Facture,
  FactureStatus,
  FactureType,
  FactureSection,
  Reglement,
  AuditLogEntry,
  DocumentCounter,
  CompanyInvoiceSettings,
} from '../types';
import { db } from '../services/firebaseService';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';

// ============================================================================
// DEVIS & FACTURES SERVICE - French E-Invoicing Compliance
// ============================================================================

// Generate unique document numbers
export const generateDevisNumber = async (): Promise<string> => {
  if (!db) throw new Error('Firebase not initialized');

  const year = new Date().getFullYear();
  const counterRef = doc(db, 'counters', 'documents');

  const counterDoc = await getDoc(counterRef);
  let counter = 1;

  if (counterDoc.exists()) {
    const data = counterDoc.data() as DocumentCounter;
    if (data.year === year) {
      counter = data.devisCounter + 1;
    }
  }

  await setDoc(counterRef, {
    year,
    devisCounter: counter,
    lastUpdated: Date.now()
  }, { merge: true });

  return `DEV-${year}-${String(counter).padStart(4, '0')}`;
};

export const generateFactureNumber = async (type: FactureType = FactureType.INVOICE): Promise<string> => {
  if (!db) throw new Error('Firebase not initialized');

  const year = new Date().getFullYear();
  const counterRef = doc(db, 'counters', 'documents');
  
  const counterDoc = await getDoc(counterRef);
  let counter = 1;
  
  if (counterDoc.exists()) {
    const data = counterDoc.data() as DocumentCounter;
    if (data.year === year) {
      counter = data.factureCounter + 1;
    }
  }
  
  const updateData: any = {
    year,
    lastUpdated: Date.now(),
    factureCounter: counter,
  };
  
  await setDoc(counterRef, updateData, { merge: true });
  
  const prefix = type === FactureType.CREDIT_NOTE ? 'AVO' : 'FAC';
  return `${prefix}-${year}-${String(counter).padStart(4, '0')}`;
};

// Calculate totals for devis
export const calculateDevisTotals = (sections: DevisSection[]): {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  detailsTVA: { taux: number; baseHT: number; montantTVA: number }[];
} => {
  let totalHT = 0;
  const tvaMap = new Map<number, number>();
  
  sections.forEach(section => {
    section.items.forEach(item => {
      const itemTotal = item.total;
      totalHT += itemTotal;
      
      const currentTVA = tvaMap.get(item.vatRate) || 0;
      tvaMap.set(item.vatRate, currentTVA + itemTotal);
    });
  });
  
  const detailsTVA = Array.from(tvaMap.entries()).map(([taux, baseHT]) => ({
    taux,
    baseHT,
    montantTVA: baseHT * (taux / 100)
  }));
  
  const totalTVA = detailsTVA.reduce((sum, detail) => sum + detail.montantTVA, 0);
  const totalTTC = totalHT + totalTVA;
  
  return {
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
    detailsTVA
  };
};

// Calculate totals for facture
export const calculateFactureTotals = (sections: FactureSection[]): {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  detailsTVA: { taux: number; baseHT: number; montantTVA: number }[];
} => {
  let totalHT = 0;
  const tvaMap = new Map<number, number>();
  
  sections.forEach(section => {
    section.items.forEach(item => {
      const itemTotal = item.total;
      totalHT += itemTotal;
      
      const currentTVA = tvaMap.get(item.vatRate) || 0;
      tvaMap.set(item.vatRate, currentTVA + itemTotal);
    });
  });
  
  const detailsTVA = Array.from(tvaMap.entries()).map(([taux, baseHT]) => ({
    taux,
    baseHT,
    montantTVA: baseHT * (taux / 100)
  }));
  
  const totalTVA = detailsTVA.reduce((sum, detail) => sum + detail.montantTVA, 0);
  const totalTTC = totalHT + totalTVA;
  
  return {
    totalHT: Math.round(totalHT * 100) / 100,
    totalTVA: Math.round(totalTVA * 100) / 100,
    totalTTC: Math.round(totalTTC * 100) / 100,
    detailsTVA
  };
};

// Create audit log entry
export const createAuditLogEntry = (
  userId: string,
  userName: string,
  action: AuditLogEntry['action'],
  details: string
): AuditLogEntry => {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
    timestamp: Date.now(),
    userId,
    userName,
    action,
    details,
  };
};

// Validate if document can be modified (Loi anti-fraude)
export const canModifyDevis = (devis: Devis): { canModify: boolean; reason?: string } => {
  if (devis.status === DevisStatus.ACCEPTED) {
    return { canModify: false, reason: 'Le devis accepté ne peut plus être modifié. Créez un avenant.' };
  }
  return { canModify: true };
};

export const canModifyFacture = (facture: Facture): { canModify: boolean; reason?: string } => {
  if (facture.sentDate) {
    return { 
      canModify: false, 
      reason: 'La facture envoyée ne peut plus être modifiée (Loi anti-fraude TVA 2018). Créez une facture d\'avoir pour corriger.' 
    };
  }
  if (facture.status === FactureStatus.CANCELLED) {
    return { canModify: false, reason: 'La facture annulée ne peut plus être modifiée.' };
  }
  return { canModify: true };
};

export const canDeleteFacture = (facture: Facture): { canDelete: boolean; reason?: string } => {
  if (facture.sentDate) {
    return { 
      canDelete: false, 
      reason: 'La facture envoyée ne peut pas être supprimée (Loi anti-fraude TVA 2018). Vous devez l\'annuler.' 
    };
  }
  if (facture.status !== FactureStatus.DRAFT) {
    return { canDelete: false, reason: 'Seules les factures en brouillon peuvent être supprimées.' };
  }
  return { canDelete: true };
};

// Convert Devis to Facture
export const convertDevisToFacture = async (
  devis: Devis,
  type: FactureType,
  companySettings: CompanyInvoiceSettings,
  userId: string,
  userName: string
): Promise<Facture> => {
  const number = await generateFactureNumber(type);
  const now = Date.now();
  const dateEmission = new Date().toISOString().split('T')[0];
  const dateEcheance = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  // Convert devis sections to facture sections
  const sections: FactureSection[] = devis.sections.map(section => ({
    id: section.id,
    title: section.title,
    items: section.items.map(item => ({
      id: item.id,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      vatRate: item.vatRate,
      total: item.total,
    }))
  })).filter(section => section.items.length > 0);
  
  const totals = calculateFactureTotals(sections);
  
  const facture: Facture = {
    id: `facture_${now}_${Math.random().toString(36).substring(2, 11)}`,
    number,
    type,
    status: FactureStatus.DRAFT,
    
    devisId: devis.id,
    
    clientId: devis.clientId,
    clientName: devis.clientName,
    clientAddress: devis.clientAddress,
    clientEmail: devis.clientEmail,
    clientPhone: devis.clientPhone,
    
    projectId: devis.projectId,
    
    date: dateEmission,
    dueDate: dateEcheance,
    
    sections,
    
    totalHT: totals.totalHT,
    totalTVA: totals.totalTVA,
    totalTTC: totals.totalTTC,
    
    paidAmount: 0,
    remainingAmount: totals.totalTTC,
    
    reglements: [],
    
    legalMentions: companySettings.legalMentions,
    
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    
    auditLog: [
      createAuditLogEntry(
        userId,
        userName,
        'CREATION',
        `Facture créée à partir du devis ${devis.number}`
      )
    ]
  };
  
  return facture;
};

// Finalize facture (mark as sent)
export const finalizeFacture = async (
  facture: Facture,
  userId: string,
  userName: string
): Promise<Facture> => {
  const validation = canModifyFacture(facture);
  if (!validation.canModify) {
    throw new Error(validation.reason);
  }
  
  const now = Date.now();
  const sentDate = new Date().toISOString().split('T')[0];
  
  const updatedFacture: Facture = {
    ...facture,
    status: FactureStatus.SENT,
    sentDate,
    updatedAt: now,
    auditLog: [
      ...(facture.auditLog || []),
      createAuditLogEntry(
        userId,
        userName,
        'FINALISATION',
        'Facture finalisée et envoyée - Document désormais immuable (Loi anti-fraude TVA 2018)'
      )
    ]
  };
  
  return updatedFacture;
};

// Generate simple hash for facture integrity
const generateFactureHash = async (facture: Facture): Promise<string> => {
  const data = JSON.stringify({
    number: facture.number,
    date: facture.date,
    clientId: facture.clientId,
    totalTTC: facture.totalTTC,
    sections: facture.sections
  });
  
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
};

// Add payment to facture
export const addReglementToFacture = (
  facture: Facture,
  reglement: Omit<Reglement, 'id'>,
  userId: string,
  userName: string
): Facture => {
  if (!facture.sentDate) {
    throw new Error('La facture doit être envoyée avant d\'enregistrer un règlement.');
  }
  
  const newReglement: Reglement = {
    ...reglement,
    id: `reglement_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
  };
  
  const reglements = [...(facture.reglements || []), newReglement];
  const paidAmount = reglements.reduce((sum, r) => sum + r.amount, 0);
  const remainingAmount = facture.totalTTC - paidAmount;
  
  let status = facture.status;
  if (remainingAmount <= 0) {
    status = FactureStatus.PAID;
  } else if (paidAmount > 0) {
    status = FactureStatus.PARTIAL;
  }
  
  return {
    ...facture,
    reglements,
    paidAmount,
    remainingAmount,
    status,
    updatedAt: Date.now(),
    auditLog: [
      ...(facture.auditLog || []),
      createAuditLogEntry(
        userId,
        userName,
        'AJOUT_REGLEMENT',
        `Règlement de ${reglement.amount}€ enregistré (${reglement.method})`
      )
    ]
  };
};

// Create avoir (credit note)
export const createFactureAvoir = async (
  factureOriginale: Facture,
  sections: FactureSection[],
  motif: string,
  userId: string,
  userName: string
): Promise<Facture> => {
  if (!factureOriginale.sentDate) {
    throw new Error('Seule une facture envoyée peut faire l\'objet d\'un avoir.');
  }
  
  const number = await generateFactureNumber(FactureType.CREDIT_NOTE);
  const now = Date.now();
  const dateEmission = new Date().toISOString().split('T')[0];

  const totals = calculateFactureTotals(sections);

  const avoir: Facture = {
    id: `facture_${now}_${Math.random().toString(36).substring(2, 11)}`,
    number,
    type: FactureType.CREDIT_NOTE,
    status: FactureStatus.DRAFT,
    devisId: factureOriginale.devisId,
    
    clientId: factureOriginale.clientId,
    clientName: factureOriginale.clientName,
    clientAddress: factureOriginale.clientAddress,
    clientEmail: factureOriginale.clientEmail,
    clientPhone: factureOriginale.clientPhone,
    
    projectId: factureOriginale.projectId,
    
    date: dateEmission,
    dueDate: dateEmission,
    
    sections,
    
    totalHT: -totals.totalHT,
    totalTVA: -totals.totalTVA,
    totalTTC: -totals.totalTTC,
    
    paidAmount: 0,
    remainingAmount: -totals.totalTTC,
    
    reglements: [],
    
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    
    auditLog: [
      createAuditLogEntry(
        userId,
        userName,
        'CREATION',
        `Avoir créé pour la facture ${factureOriginale.number} - Motif: ${motif}`
      )
    ]
  };
  
  return avoir;
};

// Get company settings
export const getCompanyInvoiceSettings = async (): Promise<CompanyInvoiceSettings> => {
  if (!db) throw new Error('Firebase not initialized');

  const settingsRef = doc(db, 'settings', 'invoicing');
  const settingsDoc = await getDoc(settingsRef);
  
  if (settingsDoc.exists()) {
    return settingsDoc.data() as CompanyInvoiceSettings;
  }
  
  // Default settings
  const defaultSettings: CompanyInvoiceSettings = {
    id: 'invoicing',
    companyName: 'BEL AIR HABITAT',
    siret: '123 456 789 00012',
    vatNumber: 'FR12345678901',
    address: '123 Rue Example',
    zipCode: '75001',
    city: 'Paris',
    phone: '01 23 45 67 89',
    email: 'contact@belairhabitat.fr',
    legalMentions: 'TVA non applicable, art. 293 B du CGI',
    paymentTerms: 30,
  };
  
  await setDoc(settingsRef, defaultSettings);
  return defaultSettings;
};

// Create new devis
export const createDevis = async (devis: Omit<Devis, 'id' | 'number' | 'createdAt' | 'updatedAt'>): Promise<Devis> => {
  if (!db) throw new Error('Firebase not initialized');

  const id = `devis_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const number = await generateDevisNumber();
  const now = Date.now();

  const newDevis: Devis = {
    ...devis,
    id,
    number,
    createdAt: now,
    updatedAt: now
  };

  const devisRef = doc(db, 'devis', id);
  await setDoc(devisRef, newDevis);

  return newDevis;
};

// Save devis
export const saveDevis = async (devis: Devis): Promise<void> => {
  if (!db) throw new Error('Firebase not initialized');
  const devisRef = doc(db, 'devis', devis.id);
  await setDoc(devisRef, devis);
};

// Save facture
export const saveFacture = async (facture: Facture): Promise<void> => {
  if (!db) throw new Error('Firebase not initialized');
  const factureRef = doc(db, 'factures', facture.id);
  await setDoc(factureRef, facture);
};

// Get all devis
export const getAllDevis = async (): Promise<Devis[]> => {
  if (!db) throw new Error('Firebase not initialized');
  const devisCollection = collection(db, 'devis');
  const q = query(devisCollection, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Devis);
};

// Get all factures
export const getAllFactures = async (): Promise<Facture[]> => {
  if (!db) throw new Error('Firebase not initialized');
  const facturesCollection = collection(db, 'factures');
  const q = query(facturesCollection, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => doc.data() as Facture);
};

// Get devis by ID
export const getDevisById = async (id: string): Promise<Devis | null> => {
  if (!db) throw new Error('Firebase not initialized');
  const devisRef = doc(db, 'devis', id);
  const devisDoc = await getDoc(devisRef);
  return devisDoc.exists() ? devisDoc.data() as Devis : null;
};

// Get facture by ID
export const getFactureById = async (id: string): Promise<Facture | null> => {
  if (!db) throw new Error('Firebase not initialized');
  const factureRef = doc(db, 'factures', id);
  const factureDoc = await getDoc(factureRef);
  return factureDoc.exists() ? factureDoc.data() as Facture : null;
};
