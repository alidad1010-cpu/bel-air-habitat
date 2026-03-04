/**
 * AI Service - Now using RouteLLM (Abacus.AI) exclusively
 * This file re-exports all functions from routellmService for backward compatibility
 */

export type {
  ExtractedProjectData,
  BulkProjectData,
  ExtractedExpenseData,
  ProspectNoteAnalysis,
  BulkProspectData,
} from './routellmService';

export {
  extractProjectDetails,
  parseProjectList,
  extractQuoteAmount,
  generateEmailResponse,
  analyzeExpenseReceipt,
  analyzeProspectNote,
  parseProspectList,
} from './routellmService';
