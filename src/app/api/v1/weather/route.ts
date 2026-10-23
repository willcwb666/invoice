import { NextResponse } from "next/server";
import { WeatherService } from "@/services/weather-service";

export const dynamic = "force-dynamic";
export const revalidate = 1800; // 30 min cache

export async function GET() {
  try {
    const weather = await WeatherService.getDailyWeather();
    return NextResponse.json({ success: true, data: weather });
  } catch {
    return NextResponse.json({ success: false, data: null }, { status: 500 });
  }
}
