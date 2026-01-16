/**
 * Validation Schema avec Zod
 * Sécurité: Validation stricte de tous les inputs utilisateur
 */
import { z } from 'zod';

// Enum schemas
export const ProjectStatusSchema = z.enum([
  'NOUVEAU',
  'EN_COURS',
  'DEVIS_ENVOYE',
  'VALIDE',
  'TERMINE',
  'ANNULE',
  'PERDU',
  'EN_VALIDATION',
  'REFUSE',
]);

export const ContactMethodSchema = z.enum(['EMAIL', 'TELEPHONE', 'SITE_WEB']);

export const ClientTypeSchema = z.enum([
  'PARTICULIER',
  'ENTREPRISE',
  'ARCHITECTE',
  'SYNDIC',
  'SOUS_TRAITANT',
  'PARTENAIRE',
  'BAILLEUR',
  'SCI',
]);

export const PrioritySchema = z.enum(['Haute', 'Moyenne', 'Basse']);

// Nested schemas
export const ClientSchema: z.ZodType<any> = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Le nom est requis').max(200, 'Le nom est trop long'),
  email: z.string().email('Email invalide').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  address: z.string().max(500).optional(),
  zipCode: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  type: ClientTypeSchema.optional(),
  companyName: z.string().max(200).optional(),
  siret: z.string().max(14).optional(),
  vatNumber: z.string().max(20).optional(),
  notes: z.string().max(5000).optional(),
});

export const ProjectSchema: z.ZodType<any> = z.object({
  id: z.string(),
  title: z.string().min(1, 'Le titre est requis').max(200, 'Le titre est trop long'),
  description: z.string().max(5000).optional(),
  client: ClientSchema,
  status: ProjectStatusSchema,
  contactMethod: ContactMethodSchema,
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive().optional(),
  budget: z.number().min(0, 'Le budget doit être positif').optional(),
  vatRate: z.number().min(0).max(100).optional(),
  priority: PrioritySchema,
  folderType: z.string().max(100).optional(),
  tags: z.array(z.string()).optional(),
  siteAddress: z.string().max(500).optional(),
  businessCode: z.string().max(50).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const ExpenseSchema: z.ZodType<any> = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  merchant: z.string().min(1).max(200),
  amount: z.number().min(0),
  currency: z.string().length(3).default('EUR'),
  category: z.string().max(100),
  type: z.enum(['FIXE', 'VARIABLE']),
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(1000).optional(),
  vat: z.number().min(0).optional(),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive().optional(),
  projectId: z.string().optional(),
  employeeId: z.string().optional(),
});

export const EmployeeSchema: z.ZodType<any> = z.object({
  id: z.string(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(20).optional(),
  position: z.string().max(100),
  hireDate: z.string().optional(),
  salary: z.number().min(0).optional(),
  documents: z.array(z.any()).optional(),
});

// Helper function pour valider avec messages d'erreur utilisateur-friendly
export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map((e) => {
        const path = e.path.join('.');
        return path ? `${path}: ${e.message}` : e.message;
      });
      return { success: false, errors };
    }
    return { success: false, errors: ['Erreur de validation inconnue'] };
  }
}

// Helper pour valider et retourner les erreurs formatées
export function validateWithFormat<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errorMessage: string } {
  const result = validate(schema, data);
  if (result.success) {
    return result;
  }
  return {
    success: false,
    errorMessage: result.errors.join('\n'),
  };
}
