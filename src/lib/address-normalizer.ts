export interface NormalizedAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string | null;
  fullAddress: string;
  fallbackAddress: string;
}

const KNOWN_CITIES = [
  "Fort Collins",
  "Loveland",
  "Windsor",
  "Greeley",
  "Evans",
  "Timnath",
  "Johnstown",
  "Milliken",
  "Severance",
  "Berthoud",
  "Longmont",
  "Eaton",
  "Denver",
  "Centennial",
  "Boulder",
  "Ault",
  "Aurora",
  "Thornton",
  "Westminster",
  "Lakewood",
  "Arvada",
  "Broomfield",
];

export class AddressNormalizer {
  /**
   * Cleans raw address text from iCloud, web forms, or notes and extracts
   * clean street, city, state, zipCode, and standardized query addresses.
   */
  public static normalize(
    raw: string,
    defaultCity?: string,
    defaultState?: string,
    defaultZip?: string
  ): NormalizedAddress {
    if (!raw || typeof raw !== "string") {
      const c = defaultCity || "Loveland";
      const s = defaultState || "CO";
      const z = defaultZip || null;
      return {
        street: "",
        city: c,
        state: s,
        zipCode: z,
        fullAddress: `${c}, ${s}${z ? ` ${z}` : ""}`,
        fallbackAddress: `${c}, ${s}`,
      };
    }

    // 1. Converte quebras de linha em vírgula e espaço
    let text = raw.replace(/[\r\n]+/g, ", ").trim();

    // 2. Remove sufixos de país comuns em geolocalização do iOS / iCloud
    text = text.replace(/,?\s*(United States|USA|US)\b/gi, "");

    // 3. Normaliza hífens antes de estado (ex: "Loveland - CO" -> "Loveland, CO")
    text = text.replace(/\s+-\s+([A-Za-z]{2})\b/g, ", $1");

    // 4. Extrai CEP se existir (5 dígitos após a sigla de estado ou no final da string, NUNCA no início onde fica o número predial)
    const zipRegex = /(?:[A-Za-z]{2}[,\s]+)(\d{5})(-\d{4})?\b|,\s*(\d{5})\s*$/;
    const zipMatch = text.match(zipRegex);
    const extractedZip = zipMatch ? zipMatch[1] || zipMatch[3] : null;
    const zipCode = extractedZip || defaultZip || null;

    // Remove apenas o CEP identificado (não qualquer número de 5 dígitos como números prediais)
    let textWithoutZip = text;
    if (extractedZip) {
      textWithoutZip = text.replace(new RegExp(`\\b${extractedZip}(-\\d{4})?\\b`, "g"), "").trim();
    }

    // 5. Extrai ou valida Estado (padrão CO)
    const stateMatch = textWithoutZip.match(/,\s*([A-Za-z]{2})\b/);
    const state = stateMatch ? stateMatch[1].toUpperCase() : (defaultState || "CO").toUpperCase();

    // Remove o estado do texto temporário
    textWithoutZip = textWithoutZip.replace(new RegExp(`,?\\s*${state}\\b`, "i"), "").trim();

    // 6. Detecta a Cidade
    let city = defaultCity || "Loveland";
    for (const known of KNOWN_CITIES) {
      const regex = new RegExp(`\\b${known}\\b`, "i");
      if (regex.test(text)) {
        city = known;
        break;
      }
    }

    // 7. Extrai o logradouro (street)
    // Pega tudo antes da primeira menção à cidade ou vírgula
    let street = textWithoutZip;
    if (city) {
      const cityRegex = new RegExp(`,?\\s*${city}\\b.*$`, "i");
      street = street.replace(cityRegex, "").trim();
    }

    // Se após a remoção a rua ficou vazia (ex: o usuário só digitou o nome da rua que coincidia ou não tinha cidade)
    if (!street || street.length < 2) {
      street = text.split(",")[0].trim();
    }

    // Remove vírgulas e espaços residuais no final da rua
    street = street.replace(/[,;.\s]+$/, "").trim();

    // Deduplica cidade repetida
    city = city.replace(/\b([A-Za-z\s]+),\s*\1\b/gi, "$1").trim();

    const fullAddress = `${street}, ${city}, ${state}${zipCode ? ` ${zipCode}` : ""}`;
    const fallbackAddress = `${street}, ${city}, ${state}`;

    return {
      street,
      city,
      state,
      zipCode,
      fullAddress,
      fallbackAddress,
    };
  }

  /**
   * Retorna apenas a rua limpa (sem cidade, estado, país ou quebras de linha)
   */
  public static cleanStreet(raw: string, city?: string): string {
    return this.normalize(raw, city).street;
  }
}
