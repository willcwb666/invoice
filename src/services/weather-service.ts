/**
 * Serviço de Previsão do Tempo (Northern Colorado - Evans/Greeley)
 * Utiliza Open-Meteo API com cache em memória e degradação suave.
 */

export interface WeatherData {
  city: string;
  tempCurrent: number;
  tempMax: number;
  tempMin: number;
  precipitationProbability: number;
  condition: string;
  icon: "sun" | "cloud" | "rain" | "snow" | "thunder";
  warning?: string | null;
}

// Cache em memória (30 minutos)
let cachedWeather: { data: WeatherData; expiresAt: number } | null = null;

export class WeatherService {
  static mapWeatherCode(code: number): {
    condition: string;
    icon: "sun" | "cloud" | "rain" | "snow" | "thunder";
    warning?: string | null;
  } {
    if (code === 0) return { condition: "Céu Limpo", icon: "sun" };
    if (code === 1) return { condition: "Predominantemente Ensolarado", icon: "sun" };
    if (code === 2) return { condition: "Parcialmente Nublado", icon: "cloud" };
    if (code === 3) return { condition: "Nublado", icon: "cloud" };
    if (code >= 45 && code <= 48) return { condition: "Neblina", icon: "cloud", warning: "Atenção: Neblina nas pistas matinais." };
    if (code >= 51 && code <= 55) return { condition: "Chuvisco Leve", icon: "rain" };
    if (code >= 61 && code <= 67) return { condition: "Chuva", icon: "rain", warning: "Pista molhada: Cuidado no trânsito." };
    if (code >= 71 && code <= 77) return { condition: "Queda de Neve", icon: "snow", warning: "Alerta de Neve: Pistas escorregadias, saia com antecedência." };
    if (code >= 80 && code <= 82) return { condition: "Pancadas de Chuva", icon: "rain" };
    if (code >= 85 && code <= 86) return { condition: "Nevasca / Neve Forte", icon: "snow", warning: "Alerta de Nevasca: Condições perigosas na estrada." };
    if (code >= 95) return { condition: "Tempestade com Raios", icon: "thunder", warning: "Alerta de Tempestade: Cuidado com granizo e descargas elétricas." };

    return { condition: "Tempo Estável", icon: "sun" };
  }

  static async getDailyWeather(latitude = 40.3789, longitude = -104.6922): Promise<WeatherData | null> {
    const now = Date.now();
    if (cachedWeather && cachedWeather.expiresAt > now) {
      return cachedWeather.data;
    }

    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=fahrenheit&timezone=America%2FDenver`;

      const res = await fetch(url, {
        headers: { "User-Agent": "RM-Cleaning-System/2.0" },
        next: { revalidate: 1800 }, // 30 min Next.js cache
      });

      if (!res.ok) {
        return null;
      }

      const json = await res.json();
      const current = json.current || {};
      const daily = json.daily || {};

      const code = current.weather_code ?? (daily.weather_code?.[0] || 0);
      const mapped = this.mapWeatherCode(code);

      const data: WeatherData = {
        city: "Evans & Greeley, CO",
        tempCurrent: Math.round(current.temperature_2m ?? (daily.temperature_2m_max?.[0] || 65)),
        tempMax: Math.round(daily.temperature_2m_max?.[0] || 70),
        tempMin: Math.round(daily.temperature_2m_min?.[0] || 45),
        precipitationProbability: Math.round(daily.precipitation_probability_max?.[0] || 0),
        condition: mapped.condition,
        icon: mapped.icon,
        warning: mapped.warning || null,
      };

      cachedWeather = {
        data,
        expiresAt: now + 30 * 60 * 1000, // 30 min
      };

      return data;
    } catch (err) {
      console.warn("[WeatherService] Erro ao obter dados do clima:", err);
      return null;
    }
  }
}
