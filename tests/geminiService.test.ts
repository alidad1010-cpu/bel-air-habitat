import { describe, it, expect, vi, beforeAll } from 'vitest';
import { analyzeExpenseReceipt } from '../services/geminiService';

// Mock dependencies
vi.mock('../utils/imageProcessor', () => ({
  processImageForAI: vi.fn((file) => Promise.resolve(file)),
}));

// Mock @google/genai
const mockGenerateContent = vi.fn();
vi.mock('@google/genai', () => {
  return {
    GoogleGenAI: class {
      get models() {
        return {
          generateContent: mockGenerateContent,
        };
      }
    },
    Type: {
      OBJECT: 'OBJECT',
      STRING: 'STRING',
      NUMBER: 'NUMBER',
      ARRAY: 'ARRAY',
    },
  };
});

describe('analyzeExpenseReceipt', () => {
  beforeAll(() => {
    // Mock global File and FileReader if not in JSDOM (Vitest usually attempts this but good to be safe)
    // Actually JSDOM should handle File/FileReader, but we need to ensure the test environment is jsdom
  });

  it('should analyze an expense receipt correctly', async () => {
    // Setup Mock Response
    const mockResponseText = JSON.stringify({
      docType: 'Ticket',
      date: '2023-10-25',
      merchant: 'Leroy Merlin',
      amount: 45.5,
      vat: 9.1,
      category: 'Matériel',
      notes: 'Achat peinture',
    });

    mockGenerateContent.mockResolvedValue({
      text: mockResponseText,
    });

    // Create a dummy file
    const file = new File(['dummy content'], 'ticket.jpg', { type: 'image/jpeg' });

    // Call function
    const result = await analyzeExpenseReceipt(file);

    // Assertions
    expect(result).not.toBeNull();
    if (result) {
      expect(result.merchant).toBe('Leroy Merlin');
      expect(result.amount).toBe(45.5);
      expect(result.date).toBe('2023-10-25');
      // "Matériel" matches one of the enum values likely, but let's check exact mapping if any
      // In the function it defaults to provided category string if not mapped explicitly?
      // Actually code says: category: rawData.category || ExpenseCategory.OTHER
      expect(result.category).toBe('Matériel');
      expect(result.vat).toBe(9.1);
    }
  });

  it('should handle API errors gracefully', async () => {
    mockGenerateContent.mockRejectedValue(new Error('API Error'));
    const file = new File(['dummy'], 'ticket.jpg', { type: 'image/jpeg' });
    const result = await analyzeExpenseReceipt(file);
    expect(result).toBeNull();
  });
});
