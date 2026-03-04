import { analyzeExpenseReceipt, ExtractedExpenseData } from './geminiService';

export type AIProvider = 'routellm';

const DEFAULT_PROVIDER: AIProvider = 'routellm';

export const getAIProvider = (): AIProvider => {
  return DEFAULT_PROVIDER;
};

export const setAIProvider = (provider: AIProvider) => {
  // No-op since we only have one provider now
};

export { analyzeExpenseReceipt };

export const isAIConfigured = (): { routellm: boolean } => {
  return {
    routellm: !!import.meta.env.VITE_ROUTELLM_API_KEY,
  };
};
