export enum ProjectStatus {
  NEW = 'NOUVEAU',
  IN_PROGRESS = 'EN_COURS',
  QUOTE_SENT = 'DEVIS_ENVOYE',
  VALIDATED = 'VALIDE',
  COMPLETED = 'TERMINE',
  CANCELLED = 'ANNULE',
  LOST = 'PERDU',
  WAITING_VALIDATION = 'EN_VALIDATION',
  REFUSED = 'REFUSE',
}

export enum ContactMethod {
  EMAIL = 'EMAIL',
  PHONE = 'TELEPHONE',
  WEBSITE = 'SITE_WEB',
}

export type UserRole = 'ADMIN' | 'USER';

export interface UserIntegrations {
  googleCalendarUrl?: string;
  smsApiKey?: string;
  emailApiKey?: string;
  automationWebhook?: string; // URL Make.com
}

export interface PersonalTask {
  id: string;
  label: string;
  dueDate: string;
  status: 'IN_PROGRESS' | 'DONE_ON_TIME' | 'DONE_LATE' | 'MISSED';
  completedAt?: number;
  createdAt: number;
}

export interface User {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  role: UserRole;
  email: string;
  lastLogin?: number;
  avatarColor?: string;
  avatarUrl?: string;
  customInitials?: string;
  integrations?: UserIntegrations;
  personalTasks?: PersonalTask[];
}

export interface ClientDocument {
  id: string;
  name: string;
  url: string;
  type: string;
  date: string;
  expiryDate?: string; // For Admin docs (Kbis, Insurance)
  isValid?: boolean;
}

export type ClientType =
  | 'PARTICULIER'
  | 'ENTREPRISE'
  | 'ARCHITECTE'
  | 'SYNDIC'
  | 'SOUS_TRAITANT'
  | 'PARTENAIRE'
  | 'BAILLEUR'
  | 'SCI';

export interface Tenant {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export interface Contact {
  id: string;
  name: string;
  role?: string; // e.g. "Gestionnaire", "Comptable", "Directeur"
  email?: string;
  phone?: string;
}

export interface Client {
  id?: string;
  name: string;
  email: string;
  phone: string;
  address: string; // Headquarters / Billing Address
  zipCode?: string;
  city?: string;
  type?: ClientType; // New classification field
  companyName?: string; // Optional company name if distinct
  siret?: string; // For Partners
  vatNumber?: string; // For Partners
  notes?: string;
  documents?: ClientDocument[];
  // Permanent access info for the client
  accessCodes?: {
    digicode?: string;
    intercom?: string;
    floor?: string;
    door?: string; // "Port" / Porte
    alarmCode?: string;
  };
  tenant?: Tenant; // Optional "Locataire"
  contacts?: Contact[]; // "Interlocuteurs"
}

export interface CommercialInfo {
  internalNotes?: string;
  // Legacy fields kept for compatibility, but UI now uses appointments array
  appointmentDate?: string;
  appointmentStartTime?: string;
  appointmentEndTime?: string;
}

export interface Appointment {
  id: string;
  date: string;
  startTime: string;
  endTime?: string;
  title: string; // e.g., "Premier RDV", "Prise de côtes"
  note?: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  visibility?: 'TEAM' | 'PRIVATE'; // NEW: Privacy setting
  createdBy?: string; // NEW: User ID who created it
}

export interface ProjectTask {
  id: string;
  label: string;
  isDone: boolean;
  dueDate?: string;
}

export interface AppNotification {
  id: string;
  type: 'ALERT' | 'WARNING' | 'INFO' | 'SUCCESS';
  title: string;
  message: string;
  projectId?: string;
  date: number;
}

export interface PurchaseOrder {
  id: string;
  number: string; // BDC-2025-001
  subcontractorId: string;
  subcontractorName: string;
  subcontractorAddress?: string; // Cache address
  description: string;
  tasks: string[]; // List of tasks/lots included
  amountHT: number;
  date: string; // Creation date
  startDate?: string; // Work start date
  endDate?: string; // Work end date
  status: 'DRAFT' | 'SENT' | 'SIGNED' | 'PAID';
  invoiceUrl?: string; // Link to the subcontractor's invoice
  signedUrl?: string; // Link to signed BDC
}

export interface Project {
  id: string;
  title: string;
  description: string;
  client: Client;
  tenant?: Tenant; // Specific tenant for this project/folder
  status: ProjectStatus;
  contactMethod: ContactMethod;
  createdAt: number;
  updatedAt?: number;
  budget?: number;
  vatRate?: number; // 0 (Autoliquidation), 10, 20
  priority: 'Haute' | 'Moyenne' | 'Basse';
  folderType?: string;
  tags?: string[]; // New: Tags for filtering (e.g. "Peinture", "Urgent")

  siteAddress?: string; // NEW: Specific address for the construction site (differs from Client HQ)

  agency?: string;
  businessCode?: string;
  orderGiver?: string;

  // Geolocation
  lat?: number;
  lng?: number;

  // External Platform Integration
  origin?: string; // ex: "HOMELIFE", "WEBSITE"
  externalReference?: string; // ex: "HL-12345"

  skills?: string[];
  damageDescription?: string;

  // Follow-up
  needsCallback?: boolean; // "À Relancer"

  // Access & Logistics
  accessInfo?: {
    digicode?: string;
    floor?: string;
    elevator?: boolean;
    keysLocation?: string; // Boite à clé
    wifiPassword?: string;
    parkingInfo?: string;
  };

  commercial?: CommercialInfo;

  // Multiple Appointments
  appointments?: Appointment[];

  tasks?: ProjectTask[];

  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  visitDate?: string;
  closureDate?: string;

  // Construction Reserves (Snags)
  hasReserves?: boolean;
  reservesDate?: string; // Date when reserves were noted
  reservesResolvedDate?: string; // Date when reserves were fixed

  clientRating?: string;
  closureComment?: string;

  createdBy?: string;
  createdTime?: string;
  updatedBy?: string;
  systemKey?: string;

  invoices?: Invoice[];
  documents?: ProjectDocument[];
  photos?: ProjectPhoto[];

  // Subcontracting
  purchaseOrders?: PurchaseOrder[];
}

export interface Invoice {
  id: string;
  number: string;
  type: string;
  amountHT: number;
  date: string;
  status: 'Payée' | 'En attente' | 'Bloquée';
}

export interface ProjectDocument {
  id: string;
  name: string;
  type: string;
  date: string;
  original: boolean;
  signed: boolean;
  url?: string;
  reference?: string;
  amountHT?: number;
}

export interface ProjectPhoto {
  id: string;
  room: string;
  type: 'AVANT' | 'PENDANT' | 'APRES';
  date: string;
  url?: string;
}

export interface DashboardStats {
  total: number;
  new: number;
  revenue: number;
}

// --- EMPLOYEES / RH MODULE ---

export interface EmployeeDocument {
  id: string;
  name: string;
  type: 'CONTRACT' | 'PAYSLIP' | 'ID_CARD' | 'VITALE' | 'BTP_CARD' | 'CV' | 'OTHER';
  url: string;
  date: string;
}

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  position: string; // Poste occupé
  startDate: string; // Date début poste
  nationality: string;
  isForeigner?: boolean; // Ressortissant Hors UE
  idCardNumber?: string;
  ssn?: string; // Numéro sécu / Carte vitale
  address?: string;
  birthDate?: string;
  documents?: EmployeeDocument[];
  isActive: boolean; // Employé actuel ou ancien
}

// --- ADMINISTRATIVE MODULE ---

export type AdminDocType =
  | 'KBIS'
  | 'DECENNALE'
  | 'PROBTP'
  | 'CIBTP'
  | 'URSSAF'
  | 'FISCAL'
  | 'OFFICE_INSURANCE'
  | 'OFFICE_LEASE'
  | 'VEHICLE_INSURANCE'
  | 'OTHER';

export interface AdminDocument {
  id: string;
  type: AdminDocType;
  name: string; // User friendly name
  url: string;
  uploadDate: string;
  documentDate: string; // The date written ON the document
  expiryDate: string; // Calculated date (3 or 6 months later)
  vehicleId?: string; // If linked to a specific vehicle
}

export interface Vehicle {
  id: string;
  name: string; // e.g. "Camion Renault Master"
  licensePlate: string;
  insuranceDoc?: AdminDocument;
}

export interface CompanyAdministrativeData {
  id: string; // usually 'administrative'
  documents: AdminDocument[];
  vehicles: Vehicle[];
}

// --- EXPENSES MODULE ---

export enum ExpenseType {
  FIXED = 'FIXE', // Monthly constant (Rent, Insurance)
  VARIABLE = 'VARIABLE', // One-off (Gas, Material, Restaurant)
}

export enum ExpenseCategory {
  FUEL = 'Carburant',
  RESTAURANT = 'Restaurant',
  MATERIAL = 'Matériel',
  RENT = 'Loyer',
  INSURANCE = 'Assurances',
  OFFICE = 'Bureau',
  SERVICES = 'Prestations',
  TAXES = 'Taxes',
  OTHER = 'Autre',
}

// --- PROSPECTION MODULE ---

export enum ProspectStatus {
  NEW = 'NOUVEAU', // Nouveaux Leads
  CONTACTED = 'CONTACTE', // Prise de Contact
  OFFER_SENT = 'OFFRE_ENVOYE', // Offre Envoyée
  NEGOTIATION = 'NEGOCIATION', // Négociation
  WON = 'GAGNE', // Gagné / Signé
  LOST = 'PERDU', // Perdu
}

export interface ProspectNote {
  id: string;
  content: string;
  date: number;
  author?: string;
}

export interface Prospect {
  id: string;
  status: ProspectStatus;
  companyName?: string;
  contactName: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;

  // Commercial Data
  estimatedAmount?: number;
  nextActionDate?: string; // YYYY-MM-DD

  // History
  notes?: ProspectNote[];

  // Meta
  createdAt: number;
  lastInteraction?: number;
  source?: string; // e.g. "Import Excel", "Manuel"
}

export interface Expense {
  id: string;
  date: string; // ISO Date of the expense
  merchant: string; // "Total Energies", "Leroy Merlin"
  amount: number;
  currency: string;
  category: ExpenseCategory | string;
  type: ExpenseType;
  receiptUrl?: string; // Image/PDF of the receipt
  notes?: string;
  vat?: number; // Montant de la TVA
  createdAt: number;
  updatedAt?: number;
  projectId?: string; // Optional link to a project
  employeeId?: string; // Link to specific employee
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT', // Présence Standard
  PAID_LEAVE = 'CONGES_PAYES',
  SICK_LEAVE = 'MALADIE',
  UNJUSTIFIED = 'ABSENCE_INJUSTIFIEE',
  WEEKEND = 'WEEKEND',
  HOLIDAY = 'FERIE',
}

export interface AttendanceRecord {
  id: string; // `${employeeId}_${date}`
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  breakDuration?: number; // minutes
  totalHours: number; // Calculated
  overtimeHours?: number; // Calculated
  notes?: string;
  updatedAt?: number;
}
