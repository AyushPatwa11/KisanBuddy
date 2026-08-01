import React, { useEffect, useState } from 'react';
import { WeatherModal as WeatherComponent } from '@/components/WeatherModal';
import Card, { CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { getNearbyPrices } from '@/lib/api';

type Forecast = {
  day: string;
  icon: string;
  hi: number;
  lo: number;
  rain: number;
  advisory?: string;
  humidity?: number;
  wind?: number;
};

function ForecastCard({ item, onSelect, selected }: { item: Forecast; onSelect: (f: Forecast) => void; selected?: boolean }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className="focus:outline-none"
      aria-label={`Select ${item.day} forecast`}
    >
      <Card
        variant="elevated"
        padding="sm"
        className={`w-full sm:w-44 transition transform hover:scale-102 ${selected ? 'ring-2 ring-primary-300 shadow-lg' : 'hover:shadow-lg'} rounded-md p-3`}
      >
        <div className="flex flex-col items-center text-center gap-2">
          <div className="text-4xl leading-none">{item.icon}</div>
          <div className="text-sm font-semibold text-neutral-700">{item.day}</div>
          <div className="text-xs text-neutral-500 mt-1">{item.hi}° / {item.lo}°</div>
          <div className="text-xs text-neutral-400">☔ {item.rain}%</div>
          <div className="text-xs text-neutral-400">💧 {item.humidity ?? '--'}%</div>
          <div className="text-xs text-neutral-400">💨 {item.wind ? (item.wind.toFixed ? item.wind.toFixed(1) : item.wind) : '--'} km/h</div>
          {item.advisory && (
            <div className="text-xs text-neutral-500 mt-2 px-2">{item.advisory}</div>
          )}
        </div>
      </Card>
    </button>
  );
}

import { useI18n } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';

export default function WeatherPage() {
  const { t } = useI18n();
  const sample7: Forecast[] = [
    { day: 'Today', icon: '🌧️', hi: 30, lo: 22, rain: 70, advisory: 'High winds + water logging predicted — secure support.' },
    { day: 'Tue', icon: '⛅', hi: 31, lo: 23, rain: 20, advisory: 'Light showers — safe to spray in dry windows.' },
    { day: 'Wed', icon: '☀️', hi: 33, lo: 24, rain: 5, advisory: 'Sunny — ideal for foliar feeding.' },
    { day: 'Thu', icon: '🌦️', hi: 29, lo: 21, rain: 55, advisory: 'Heavy showers likely — delay fertilizer application.' },
    { day: 'Fri', icon: '🌧️', hi: 28, lo: 20, rain: 80, advisory: 'Persistent rain — check drainage and stored seed.' },
    { day: 'Sat', icon: '⛈️', hi: 27, lo: 19, rain: 85, advisory: 'Thunderstorms — secure greenhouse panels.' },
    { day: 'Sun', icon: '☀️', hi: 32, lo: 22, rain: 10, advisory: 'Clear — plan field operations.' },
  ];

  const [forecasts, setForecasts] = useState<Forecast[]>(sample7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Forecast | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [serviceWarning, setServiceWarning] = useState<string | null>(null);
  const [currentWeather, setCurrentWeather] = useState<{ temp?: number; feels_like?: number; humidity?: number; wind_speed?: number } | null>(null);
  const [locationState, setLocationState] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestMandi, setNearestMandi] = useState<{ city: string; state?: string; modal_price?: number; effective_price?: number; distance_km?: number } | null>(null);
  const [mandiLoading, setMandiLoading] = useState(false);
  const [mandiError, setMandiError] = useState<string | null>(null);
  const [impactAlerts, setImpactAlerts] = useState<Array<{ type: 'flood' | 'heat' | 'frost' | 'wind' | 'heavy-rain'; title: string; description: string; days: number }>>([]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const base = process.env.NEXT_PUBLIC_API_URL || '';

    async function loadForecast() {
      try {
        // Attempt to get browser geolocation
        let location: { lat: number; lng: number } | null = null;
        if (typeof navigator !== 'undefined' && navigator.geolocation) {
          location = await new Promise((resolve) => {
            const onSuccess = (p: GeolocationPosition) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude });
            const onError = () => resolve(null);
            try {
              navigator.geolocation.getCurrentPosition(onSuccess, onError, { timeout: 5000 });
            } catch (e) {
              resolve(null);
            }
          });
          if (!location) {
            setServiceWarning('Geolocation not available or permission denied; using sample location.');
          } else {
            // persist location for other widgets (Impact Matrix / nearby mandi)
            setLocationState(location);
          }
        } else {
          setServiceWarning('Geolocation not supported by this browser; using sample data.');
        }

            const { getWeatherForecast } = await import('@/lib/api');
            const resp = await getWeatherForecast(location ?? undefined);
            if (resp.error) {
              if (resp.error.includes('401') || resp.error.toLowerCase().includes('unauthorized')) setServiceWarning('Weather service unauthorized (missing API key).');
              if (resp.error.includes('405')) setServiceWarning('Weather API not accepting POST requests (405).');
              throw new Error(resp.error);
            }
            const data = resp.data;
            // Backend returns { forecast, advisories, farmer_report }.
            const forecastPayload = data?.forecast ?? data ?? null;
            const dailyList = (forecastPayload && (forecastPayload.daily || forecastPayload?.daily)) || (Array.isArray(forecastPayload) ? forecastPayload : []);
            // current weather may be at forecastPayload.current
            const current = forecastPayload?.current ?? null;
            if (current && mounted) {
              setCurrentWeather({ temp: current.temp ?? current?.temp?.day ?? null, feels_like: current.feels_like ?? null, humidity: current.humidity ?? null, wind_speed: current.wind_speed ?? null });
            }
            const list = dailyList;
        if (Array.isArray(list) && mounted) {
          function makeAdvisoryFor(d: any) {
            const rain = d.rain ?? Math.round((d.pop ?? 0) * 100);
            const wind = d.wind_speed ?? d.wind?.speed ?? 0;
            const hi = d.temp?.max ?? d.hi ?? 0;
            const lo = d.temp?.min ?? d.lo ?? 0;
            const humidity = d.humidity ?? d.humidity_day ?? null;

            // High priority hazards
            if (wind > 25) return 'Strong winds expected — secure support structures and greenhouse panels.';
            if (rain >= 70) return 'Heavy rain expected — check drainage, secure stored seed, and delay field work.';

            // Moderate hazards
            if (rain >= 30) return 'Showers likely — avoid spraying and plan operations in dry windows.';
            if (hi >= 38) return 'High temperatures forecast — increase irrigation and monitor heat stress.';
            if (lo <= 3) return 'Low night temperatures — protect sensitive crops from possible frost.';

            // Disease risk from humidity
            if (humidity !== null && humidity >= 80) return 'High humidity — conditions may favour fungal diseases; avoid evening irrigation and monitor crops.';

            // Gusty but not extreme
            if (wind >= 15) return 'Gusty winds expected — secure lightweight covers and check trellises.';

            // Default mild advisory based on precipitation chance
            if (rain > 0 && rain < 30) return 'Light showers possible — operations generally safe; monitor short-term updates.';

            // Fallback short helpful advisory for calm conditions
            return 'Conditions look normal — proceed with routine operations and monitor the forecast for changes.';
          }

          const mapped = list.slice(0, 7).map((d: any, i: number) => ({
            day: d.day ?? d.dt_txt ?? ['Today','Tue','Wed','Thu','Fri','Sat','Sun'][i] ?? `Day ${i+1}`,
            icon: d.icon ?? (d.weather && d.weather[0] && d.weather[0].emoji) ?? '🌤️',
            hi: d.hi ?? d.temp?.max ?? Math.round((d.temp?.day ?? 30)),
            lo: d.lo ?? d.temp?.min ?? Math.round((d.temp?.night ?? 20)),
            rain: d.rain ?? Math.round((d.pop ?? 0) * 100),
            humidity: d.humidity ?? d.humidity_day ?? undefined,
            wind: d.wind_speed ?? d.wind?.speed ?? undefined,
            advisory: d.advisory ?? d.advisories ?? makeAdvisoryFor(d) ?? undefined,
          }));
          setForecasts(mapped.length ? mapped : sample7);
          
          // Generate impact-based alerts from forecast data
          const alerts = generateImpactAlerts(list.slice(0, 7));
          setImpactAlerts(alerts);
        } else if (mounted) {
          setForecasts(sample7);
        }
        if (mounted) setError(null);
      } catch (err) {
        if (!mounted) return;
        const msg = (err as any)?.message || String(err);
        if (msg.includes('405')) setServiceWarning('Weather API not accepting POST requests (405).');
        setError(`Could not load forecast (${msg})`);
        setForecasts(sample7);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadForecast();
    return () => { mounted = false; };
  }, []);

  // Fetch nearest mandi prices when we have a location
  useEffect(() => {
    let mounted = true;
    async function loadNearby() {
      if (!locationState) return;
      setMandiLoading(true);
      setMandiError(null);
      try {
        const r = await getNearbyPrices('Tomato', locationState, 200, 5);
        if (r.error) throw new Error(r.error || 'Failed to fetch nearby prices');
        const nearby = r.data?.nearby || [];
        if (Array.isArray(nearby) && nearby.length && mounted) {
          const first = nearby[0];
          setNearestMandi({ city: first.city, state: first.state, modal_price: first.modal_price, effective_price: first.effective_price, distance_km: first.distance_km });
        }
      } catch (err: any) {
        if (!mounted) return;
        setMandiError(err?.message || 'Could not fetch nearby mandi prices');
      } finally {
        if (mounted) setMandiLoading(false);
      }
    }
    loadNearby();
    return () => { mounted = false; };
  }, [locationState]);

  // Generate impact-based alerts from forecast data
  function generateImpactAlerts(dailyData: any[]) {
    const alerts: Array<{ type: 'flood' | 'heat' | 'frost' | 'wind' | 'heavy-rain'; title: string; description: string; days: number }> = [];
    
    // Check for heavy rain / flood risk (next 48h)
    const next2Days = dailyData.slice(0, 2);
    const totalRain48h = next2Days.reduce((sum, d) => sum + (d.rain ?? 0), 0);
    const highRainDays = dailyData.filter(d => {
      const rainMm = d.rain ?? 0;
      const rainPercent = d.pop ?? 0;
      return rainMm > 30 || rainPercent > 70;
    }).length;
    
    if (totalRain48h > 50 || highRainDays >= 2) {
      alerts.push({
        type: 'flood',
        title: 'Flood Watch — 48h',
        description: 'Localized water logging expected — secure stored seed and check drainage.',
        days: 2
      });
    } else if (highRainDays >= 1) {
      alerts.push({
        type: 'heavy-rain',
        title: `Heavy Rain Alert — ${highRainDays} day${highRainDays > 1 ? 's' : ''}`,
        description: 'Significant rainfall expected — delay fertilizer application and secure seedlings.',
        days: highRainDays
      });
    }
    
    // Check for heat stress (next 3 days)
    const next3Days = dailyData.slice(0, 3);
    const heatDays = next3Days.filter(d => {
      const maxTemp = d.temp?.max ?? d.hi ?? 0;
      return maxTemp >= 38;
    });
    
    if (heatDays.length >= 2) {
      alerts.push({
        type: 'heat',
        title: `Heat Alert — ${heatDays.length} days`,
        description: 'High temperatures forecasted — increase irrigation and provide shade for seedlings.',
        days: heatDays.length
      });
    }
    
    // Check for frost risk
    const frostDays = dailyData.filter(d => {
      const minTemp = d.temp?.min ?? d.lo ?? 20;
      return minTemp <= 5;
    });
    
    if (frostDays.length > 0) {
      alerts.push({
        type: 'frost',
        title: `Frost Warning — ${frostDays.length} day${frostDays.length > 1 ? 's' : ''}`,
        description: 'Low night temperatures expected — protect sensitive crops from frost damage.',
        days: frostDays.length
      });
    }
    
    // Check for high winds
    const windyDays = dailyData.filter(d => {
      const windSpeed = d.wind_speed ?? 0;
      return windSpeed > 25; // > 25 km/h
    });
    
    if (windyDays.length >= 2) {
      alerts.push({
        type: 'wind',
        title: `Wind Alert — ${windyDays.length} days`,
        description: 'Strong winds expected — secure support structures and greenhouse panels.',
        days: windyDays.length
      });
    }
    
    return alerts;
  }

  // Utility: derive quick tips and checklist from forecasts
  function deriveTips(from: Forecast[]) {
    const tips: string[] = [];
    const checklist: string[] = [];
    const soon = from.slice(0, 3);
    const maxRain = Math.max(...soon.map((d) => d.rain || 0));
    if (maxRain >= 70) {
      tips.push('Monitor soil moisture sensors after heavy rain.');
      checklist.push('Check drainage channels after heavy rain.');
    } else if (maxRain >= 30) {
      tips.push('Delay spray operations during active precipitation windows.');
      checklist.push('Record crop stage for advisory accuracy.');
    } else {
      tips.push('Conditions look stable — plan field operations on dry windows.');
    }
    if (from.some((d) => (d.advisory || '').toLowerCase().includes('wind') || (d.advisory || '').toLowerCase().includes('gust'))) {
      tips.push('Use rope supports for high-value fruiting plants before forecasted gusts.');
      checklist.push('Secure coverings before predicted gusts.');
    }
    return { tips, checklist };
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-2">
              🌤️ {t('weather')}
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 max-w-2xl">
              {t('weatherAlertsSub')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => window.open('/', '_self')}>
              🏠 {t('home')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.open('/diagnostic', '_self')}>
              🔬 {t('cropDiagnostics')}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => window.open('/market', '_self')}>
              💰 {t('market')}
            </Button>
            <LanguageSelector />
          </div>
        </div>

        {serviceWarning && (
          <Alert variant="warning" title="Service Notice" className="mb-6">
            {serviceWarning}
          </Alert>
        )}

        {/* Main Layout - 3 Column Grid on Large Screens */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Sidebar - Alerts & Current Weather */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* Current Weather Card */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-neutral-800 mb-4">Current Conditions</h2>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="text-5xl font-bold text-neutral-900">
                      {currentWeather?.temp ?? forecasts[0]?.hi}°
                    </div>
                    <div className="text-sm text-neutral-500 mt-1">
                      Feels like {currentWeather?.feels_like ?? currentWeather?.temp ?? forecasts[0]?.hi}°
                    </div>
                  </div>
                  <div className="text-6xl">
                    {forecasts[0]?.icon ?? '🌤️'}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-neutral-200">
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Humidity</div>
                    <div className="text-lg font-semibold text-neutral-800">
                      {currentWeather?.humidity ?? '--'}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Wind Speed</div>
                    <div className="text-lg font-semibold text-neutral-800">
                      {currentWeather?.wind_speed?.toFixed(1) ?? '--'} km/h
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Rain Chance</div>
                    <div className="text-lg font-semibold text-neutral-800">
                      {forecasts[0]?.rain ?? 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Status</div>
                    <div className="text-sm font-medium text-green-600">
                      {loading ? 'Updating...' : 'Live'}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Alerts Card */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-neutral-800 mb-4">⚠️ Recent Active Alerts</h2>
                <div className="space-y-3">
                  {impactAlerts.length > 0 ? (
                    impactAlerts.map((alert, idx) => {
                      const bgColor = alert.type === 'heat' ? 'bg-red-50 border-red-200' :
                                     alert.type === 'flood' || alert.type === 'heavy-rain' ? 'bg-amber-50 border-amber-200' :
                                     alert.type === 'frost' ? 'bg-blue-50 border-blue-200' :
                                     'bg-orange-50 border-orange-200';
                      const icon = alert.type === 'heat' ? '🌡️' :
                                  alert.type === 'flood' || alert.type === 'heavy-rain' ? '🌊' :
                                  alert.type === 'frost' ? '❄️' : '💨';
                      return (
                        <div key={idx} className={`${bgColor} border-2 p-4 rounded-lg shadow-sm`}>
                          <div className="flex items-start gap-3">
                            <span className="text-2xl">{icon}</span>
                            <div className="flex-1">
                              <div className="font-semibold text-neutral-900 mb-1">{alert.title}</div>
                              <div className="text-xs text-neutral-600">{alert.description}</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="bg-green-50 border-2 border-green-200 p-4 rounded-lg shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">✅</span>
                        <div>
                          <div className="font-semibold text-green-900 mb-1">No Active Warnings</div>
                          <div className="text-xs text-green-700">Weather conditions are favorable for normal farm operations.</div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mt-6 pt-4 border-t border-neutral-200">
                  <h3 className="text-sm font-semibold text-neutral-700 mb-2">Why this matters</h3>
                  <p className="text-xs text-neutral-600 leading-relaxed">
                    Impact-Based Forecasting (IBF) maps weather hazards to crop stage, providing tactical guidance 
                    like suspending fertilizer when rain exceeds 30mm during sowing.
                  </p>
                </div>
              </div>
            </Card>
          </aside>

          {/* Center - 7-Day Forecast */}
          <main className="lg:col-span-8 space-y-6">
            
            {/* 7-Day Forecast */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-neutral-900">7-Day Forecast</h2>
                    <p className="text-sm text-neutral-500 mt-1">Tap any day for detailed advisory</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
                      {loading ? 'Updating…' : error ? 'Sample Data' : '✓ Live Data'}
                    </span>
                    {selected && (
                      <Button variant="ghost" size="sm" onClick={() => { setSelected(null); setSelectedIndex(0); }}>
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {error && (
                  <Alert variant="error" className="mb-4">
                    {error}
                  </Alert>
                )}

                {/* Forecast Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {forecasts.slice(0, 7).map((forecast, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelected(forecast); setSelectedIndex(i); }}
                      className={`focus:outline-none transition-all ${
                        i === selectedIndex 
                          ? 'transform scale-105' 
                          : 'hover:transform hover:scale-102'
                      }`}
                    >
                      <div className={`rounded-xl p-4 text-center transition-all ${
                        i === selectedIndex
                          ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-lg ring-2 ring-primary-300'
                          : 'bg-white border-2 border-neutral-200 hover:border-primary-300 hover:shadow-md'
                      }`}>
                        <div className="text-xs font-medium mb-2 opacity-90">
                          {forecast.day}
                        </div>
                        <div className="text-4xl mb-2">{forecast.icon}</div>
                        <div className="text-lg font-bold mb-1">
                          {forecast.hi}°
                        </div>
                        <div className={`text-xs mb-2 ${i === selectedIndex ? 'opacity-80' : 'text-neutral-500'}`}>
                          {forecast.lo}°
                        </div>
                        <div className={`text-xs flex items-center justify-center gap-1 ${
                          i === selectedIndex ? 'opacity-90' : 'text-neutral-600'
                        }`}>
                          <span>💧</span>
                          <span>{forecast.rain}%</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </Card>

                {/* Selected Day Advisory — show today's advisory by default when none selected */}
            {
              (() => {
                const current = selected ?? (forecasts && forecasts.length ? forecasts[0] : null);
                if (!current) return null;
                return (
                  <Card variant="elevated" className="bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200">
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-primary-900 mb-1">
                            {current.day} Advisory
                          </h3>
                          <div className="flex items-center gap-4 text-sm text-primary-700">
                            <span className="flex items-center gap-1">
                              🌡️ {current.hi}° / {current.lo}°
                            </span>
                            <span className="flex items-center gap-1">
                              ☔ {current.rain}%
                            </span>
                            <span className="flex items-center gap-1">
                              💧 {current.humidity ?? '--'}%
                            </span>
                            <span className="flex items-center gap-1">
                              💨 {current.wind ? (typeof current.wind === 'number' ? current.wind.toFixed(1) : current.wind) : '--'} km/h
                            </span>
                          </div>
                        </div>
                        <span className="text-5xl">{current.icon}</span>
                      </div>
                      
                      <div className="bg-white/70 rounded-lg p-6 border border-primary-200">
                                {current.advisory ? (
                                  (() => {
                                    const parts = String(current.advisory)
                                      .split(/[\n\.;—–\-]+/) // split on common separators
                                      .map(s => s.trim())
                                      .filter(Boolean);
                                    return (
                                      <ul className="list-disc list-inside space-y-4 mt-3 sm:space-y-5">
                                        {parts.map((p, idx) => (
                                          <li key={idx} className="text-lg sm:text-lg font-medium text-primary-900 leading-relaxed">
                                            {p}
                                          </li>
                                        ))}
                                      </ul>
                                    );
                                  })()
                                ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })()
            }

            {/* Weather Widget */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">Detailed Weather View</h2>
                <div className="rounded-lg overflow-hidden border border-neutral-200">
                  <WeatherComponent inline />
                </div>
              </div>
            </Card>

          </main>

        </div>
      </div>
    </div>
  );
}
