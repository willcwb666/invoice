/**
 * Parser inteligente de serviços incomuns / pedidos especiais.
 * Utiliza o Google Gemini se GEMINI_API_KEY estiver configurada,
 * ou o analisador inteligente local em caso de ausência ou falha.
 */

export interface CustomServiceParsedItem {
  id: string;
  name: string;
  price: number;
}

export async function parseCustomServices(
  inputText: string,
  defaultPrice = 20
): Promise<CustomServiceParsedItem[]> {
  const text = inputText.trim();
  if (!text) return [];

  // 1. Tentar via Gemini se houver chave configurada
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (geminiKey) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `Você é um assistente especialista em precificação de serviços de limpeza residencial e comercial nos EUA.
O usuário digitou um texto livre com um ou mais serviços incomuns/pedidos especiais (ex: varrer garagem, limpar coifa, passar pano em rodapés, lavar sacada, etc).
Analise o texto e identifique cada serviço incomum separadamente.
Para cada serviço, atribua o preço padrão de $${defaultPrice}.00 (ou um valor proporcional se for algo excepcionalmente pesado).
Retorne SOMENTE um array JSON no formato:
[{"name": "Nome conciso e profissional do serviço", "price": ${defaultPrice}}]
Texto do usuário: "${text}"`,
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.2,
            },
          }),
        }
      );

      if (response.ok) {
        const json = await response.json();
        const rawContent = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawContent) {
          const parsed = JSON.parse(rawContent);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed.map((item, idx) => ({
              id: `custom-ai-${Date.now()}-${idx}`,
              name: String(item.name || "").trim(),
              price: Number(item.price) || defaultPrice,
            }));
          }
        }
      }
    } catch (e) {
      console.warn("Gemini parser falhou, usando parser local:", e);
    }
  }

  // 2. Analisador Inteligente Local (Fast & 100% Offline)
  return parseLocally(text, defaultPrice);
}

function parseLocally(text: string, defaultPrice = 20): CustomServiceParsedItem[] {
  // Limpar introduções de polidez comuns
  let cleaned = text
    .replace(/^(?:por favor|favor|preciso que|gostaria de|se der para|se poss[ií]vel|please|could you|can you|i need|we need)\s+/i, "")
    .replace(/[.!?]+$/, "");

  // Separar por quebras de linha, pontos e vírgulas, ou conectivos "e / and / além de / também"
  const tokens = cleaned
    .split(/\r?\n|;|\.|\b(?:al[eé]m de|al[eé]m disso|tamb[eé]m|e|and|plus|also)\b/i)
    .flatMap((t) => t.split(","))
    .map((t) => t.trim())
    .filter((t) => t.length > 2);

  const seen = new Set<string>();
  const items: CustomServiceParsedItem[] = [];

  for (const token of tokens) {
    // Limpar prefixos remanescentes
    const cleanToken = token
      .replace(/^(?:e|and|para|de|al[eé]m de|tamb[eé]m|um|uma|o|a|os|as)\s+/i, "")
      .replace(/^(?:favor|por favor)\s+/i, "")
      .trim();

    if (cleanToken.length < 3) continue;

    // Normalizar capitalização (Primeira letra maiúscula)
    const formatted = cleanToken.charAt(0).toUpperCase() + cleanToken.slice(1);
    const lowerKey = formatted.toLowerCase();

    if (!seen.has(lowerKey)) {
      seen.add(lowerKey);
      items.push({
        id: `custom-local-${Date.now()}-${items.length}`,
        name: formatted,
        price: defaultPrice,
      });
    }
  }

  // Fallback caso a frase não tenha sido fatiada
  if (items.length === 0 && text.trim().length > 2) {
    const single = text.trim();
    items.push({
      id: `custom-single-${Date.now()}`,
      name: single.charAt(0).toUpperCase() + single.slice(1),
      price: defaultPrice,
    });
  }

  return items;
}
