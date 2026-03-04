const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export const draftMessageWithAI = async (
  subject: string,
  context: string,
  recipientType: 'CLIENT' | 'PARTNER' | 'ALL'
): Promise<string> => {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured.');
  }

  const audienceLabel =
    recipientType === 'CLIENT' ? 'clients'
    : recipientType === 'PARTNER' ? 'partenaires'
    : 'clients et partenaires';

  const systemPrompt = `Tu es un assistant professionnel pour une entreprise de rénovation et habitat appelée Bel Air Habitat. 
Tu rédiges des messages professionnels, clairs et courtois en français destinés à ${audienceLabel}.
Réponds uniquement avec le corps du message, sans salutation ni signature.`;

  const userPrompt = `Rédige un message professionnel${subject ? ` sur le sujet : "${subject}"` : ''}${context ? `\n\nContexte supplémentaire : ${context}` : ''}.`;

  const response = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://bel-air-habitat.web.app',
      'X-Title': 'Bel Air Habitat',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
};
