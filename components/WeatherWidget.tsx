import React, { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, CloudSnow, Loader2, Thermometer } from 'lucide-react';

interface WeatherWidgetProps {
    address?: string;
}

interface WeatherData {
    tempMax: number;
    tempMin: number;
    code: number;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = ({ address }) => {
    const [weather, setWeather] = useState<WeatherData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!address) return;

        const fetchWeather = async () => {
            setLoading(true);
            try {
                // 1. Geocode City from Address (Simple extraction)
                // We assume the address format contains the city or we just search the whole string
                // OpenMeteo Geocoding is smart enough to handle partial addresses often
                const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(address)}&count=1&language=fr&format=json`;
                const geoRes = await fetch(geoUrl);
                const geoData = await geoRes.json();

                if (!geoData.results || geoData.results.length === 0) {
                    // Fail silently or show generic
                    setError("Ville introuvable");
                    setLoading(false);
                    return;
                }

                const { latitude, longitude } = geoData.results[0];

                // 2. Get Weather
                const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`;
                const weatherRes = await fetch(weatherUrl);
                const weatherData = await weatherRes.json();

                if (weatherData.daily) {
                    setWeather({
                        tempMax: weatherData.daily.temperature_2m_max[0],
                        tempMin: weatherData.daily.temperature_2m_min[0],
                        code: weatherData.daily.weather_code[0]
                    });
                }
            } catch (err) {
                console.error("Weather fetch error", err);
                setError("Météo indisponible");
            } finally {
                setLoading(false);
            }
        };

        fetchWeather();
    }, [address]);

    if (!address) return null;
    if (loading) return <div className="text-xs text-slate-700 dark:text-slate-200 dark:text-white flex items-center"><Loader2 size={12} className="animate-spin mr-1" /> Météo...</div>;
    if (error) return null; // Hide on error to keep UI clean
    if (!weather) return null;

    // WMO Weather Codes interpretation
    const getWeatherIcon = (code: number) => {
        if (code <= 3) return <Sun size={20} className="text-yellow-500" />;
        if (code <= 48) return <Cloud size={20} className="text-slate-700 dark:text-slate-200 dark:text-white" />;
        if (code <= 67) return <CloudRain size={20} className="text-blue-400" />;
        if (code <= 77) return <CloudSnow size={20} className="text-blue-200" />;
        if (code <= 82) return <CloudRain size={20} className="text-blue-500" />; // Showers
        return <CloudRain size={20} className="text-slate-700 dark:text-slate-200 dark:text-white" />; // Default
    };

    const getWeatherLabel = (code: number) => {
        if (code <= 3) return "Ensoleillé";
        if (code <= 48) return "Nuageux";
        if (code <= 67) return "Pluvieux";
        if (code <= 77) return "Neige";
        return "Variable";
    };

    return (
        <div className="bg-blue-50 dark:bg-slate-800/50 p-3 rounded-lg flex items-center space-x-3 border border-blue-100 dark:border-slate-600">
            <div className="bg-white dark:bg-slate-900 dark:bg-slate-600 p-2 rounded-full shadow-sm">
                {getWeatherIcon(weather.code)}
            </div>
            <div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200 dark:text-white uppercase">{getWeatherLabel(weather.code)}</p>
                <div className="flex items-center text-sm font-semibold text-slate-900 dark:text-white dark:text-white dark:text-white">
                    <Thermometer size={14} className="mr-1 text-slate-700 dark:text-slate-200 dark:text-white" />
                    {weather.tempMin}° / {weather.tempMax}°
                </div>
            </div>
        </div>
    );
};

export default WeatherWidget;
