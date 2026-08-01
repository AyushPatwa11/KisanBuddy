import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { getApiUrl } from '@/lib/api';
import { Card, Button } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useI18n } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';

export default function MarketPage() {
  const { t } = useI18n();
  const [searchCommodity, setSearchCommodity] = useState('');
  const [searchRegion, setSearchRegion] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [searchForecast, setSearchForecast] = useState<any[] | null>(null);
  const [locationState, setLocationState] = useState<{ lat: number; lng: number } | null>(null);
  const [nearestMandi, setNearestMandi] = useState<any | null>(null);
  const [mandiLoading, setMandiLoading] = useState(false);
  const [geoPermission, setGeoPermission] = useState<'unknown' | 'granted' | 'prompt' | 'denied'>('unknown');
  const [backendStatus, setBackendStatus] = useState<{ ok: boolean; status?: number; message?: string } | null>(null);
  const [nearbyDebug, setNearbyDebug] = useState<{ req?: any; res?: any; error?: string; ts?: string; radius?: number; lastAttemptMs?: number; attempts?: number } | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(200);
  const [limitToLocation, setLimitToLocation] = useState<boolean>(true);
  const [fuelRatePerTonKm, setFuelRatePerTonKm] = useState<number>(0.05);
  const [mandiFeesPerTon, setMandiFeesPerTon] = useState<number>(0.0);
  const [selectedMarketItem, setSelectedMarketItem] = useState<any | null>(null);
  const [modalTotalFuelCost, setModalTotalFuelCost] = useState<string>('0');
  const [modalQuantityQuintals, setModalQuantityQuintals] = useState<string>('10');
  const [modalMandiFees, setModalMandiFees] = useState<string>(String(mandiFeesPerTon));
  const [modalFuelPricePerL, setModalFuelPricePerL] = useState<string>('0');
  const [modalKmPerL, setModalKmPerL] = useState<string>('0');
  React.useEffect(() => {
    if (selectedMarketItem) {
      setModalTotalFuelCost('0');
      setModalQuantityQuintals('10');
      setModalMandiFees(String(mandiFeesPerTon));
      setModalFuelPricePerL('0');
      setModalKmPerL('0');
    }
  }, [selectedMarketItem, mandiFeesPerTon]);
  // expose default crop for inline MarketComponent auto-fetch
  try {
    (globalThis as any).__KISANBUDDY_DEFAULT_CROP = searchCommodity;
  } catch (e) {}

  // Preselect commodity from URL query (?commodity=Tomato or ?crop=Tomato)
  const router = useRouter();
  React.useEffect(() => {
    if (!searchCommodity) {
      const q = router.query || {};
      const fromQuery = (q.commodity as string) || (q.crop as string) || '';
      if (typeof fromQuery === 'string' && fromQuery.trim()) {
        setSearchCommodity(fromQuery.trim());
      }
    }
  }, [router.query, searchCommodity]);

  React.useEffect(() => {
    let mounted = true;
    const apiBase = getApiUrl();
    fetch(`${apiBase}/healthz`)
      .then(res => {
        if (!mounted) return;
        if (res.ok) setBackendStatus({ ok: true });
        else setBackendStatus({ ok: false, status: res.status, message: `Server error HTTP ${res.status}` });
      })
      .catch(err => {
        if (!mounted) return;
        setBackendStatus({ ok: false, message: 'Cannot connect to backend server. Make sure server is running on port 8080 or 8000.' });
      });

    return () => { mounted = false; };
  }, []);

  // On mount, attempt geolocation and fetch nearest mandi
  React.useEffect(() => {
    let mounted = true;

    async function requestLocationAndNearby() {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;
      try {
        const pos = await new Promise<GeolocationPosition | null>((resolve) => {
          try {
            navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { timeout: 20000 });
          } catch (e) {
            resolve(null);
          }
        });
        if (!pos) return;
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setNearbyDebug({ req: loc, ts: new Date().toISOString(), radius: radiusKm });
        if (!mounted) return;
        setLocationState(loc);
        // Do not auto-fetch markets until a commodity is selected by user
        if (!searchCommodity || !searchCommodity.trim()) {
          return;
        }
        setMandiLoading(true);
        // try with retry/backoff and longer timeouts to avoid spurious client-side timeouts
        try {
          const api = await import('@/lib/api');
              const getNearbyPrices = api.getNearbyPrices;
          const getMarketPrices = api.getMarketPrices;
          const attempts = [45000, 90000];
          let lastErr: any = null;
              for (let i = 0; i < attempts.length; i++) {
            const timeoutMs = attempts[i];
            const start = Date.now();
            try {
              const p = getNearbyPrices(searchCommodity, loc, radiusKm, 5, fuelRatePerTonKm, mandiFeesPerTon);
              const r = await Promise.race([
                p,
                new Promise((_, rej) => setTimeout(() => rej(new Error('Nearby request timed out (server may be slow). Please Retry Nearby.')), timeoutMs)),
              ]);
              const elapsed = Date.now() - start;
              if ((r as any).error) throw new Error((r as any).error);
              const nearby = (r as any).data?.nearby || [];
              setNearbyDebug((d) => ({ ...(d || {}), res: (r as any).data, lastAttemptMs: elapsed, attempts: i + 1, ts: new Date().toISOString() }));
              if (nearby && nearby.length) {
                setNearestMandi(nearby[0]);
                const mapped = nearby.map((n:any) => ({ city: n.city || n.market || n.name || '', modal_price: n.modal_price, effective_price: n.effective_price, min_price: n.min_price, max_price: n.max_price, date: n.date, distance_km: n.distance_km, lat: n.lat, lon: n.lon }));
                setSearchResults(mapped);
              }
              lastErr = null;
              break;
            } catch (err: any) {
              lastErr = err;
              setNearbyDebug((d) => ({ ...(d || {}), error: err?.message || String(err), lastAttemptMs: Date.now() - start, attempts: i + 1, ts: new Date().toISOString() }));
              // small backoff before next attempt
              await new Promise((r) => setTimeout(r, 500 * (i + 1)));
            }
          }
          if (lastErr) throw lastErr;
        } catch (err: any) {
          setNearbyDebug((d) => ({ ...(d || {}), error: err?.message || String(err), ts: new Date().toISOString() }));
          // ignore silently; user can search manually
        } finally {
          if (mounted) setMandiLoading(false);
        }
      } catch (e) {}
    }

    async function probePermissionAndMaybeRequest() {
      try {
        if (typeof navigator !== 'undefined' && (navigator as any).permissions && (navigator as any).permissions.query) {
          try {
            const p = await (navigator as any).permissions.query({ name: 'geolocation' });
            setGeoPermission(p.state as any);
            p.onchange = () => setGeoPermission(p.state as any);
            // If granted or prompt, try to request (prompt will show permission dialog)
            if (p.state === 'granted' || p.state === 'prompt') {
              await requestLocationAndNearby();
            }
          } catch (e) {
            // permissions API might throw on some browsers; fall back to calling geolocation directly
            await requestLocationAndNearby();
          }
        } else {
          // no permissions API – just attempt to request location (will prompt if needed)
          await requestLocationAndNearby();
        }
      } catch (e) {}
    }

    probePermissionAndMaybeRequest();
    return () => { mounted = false; };
  }, [searchCommodity]);

  // Manual location request (e.g., from UI button)
  async function requestLocationFromUser() {
    try {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return;
      setGeoPermission('prompt');
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        try {
          navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { timeout: 10000 });
        } catch (e) { resolve(null); }
      });
      if (!pos) return;
      const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setNearbyDebug({ req: loc, ts: new Date().toISOString(), radius: radiusKm });
      setLocationState(loc);
      // Only fetch nearby markets after the user selects a commodity
      if (!searchCommodity || !searchCommodity.trim()) {
        return;
      }
      setMandiLoading(true);
      try {
        const api = await import('@/lib/api');
        const getNearbyPrices = api.getNearbyPrices;
        const getMarketPrices = api.getMarketPrices;
        const attempts = [45000, 90000];
        let lastErr: any = null;
        for (let i = 0; i < attempts.length; i++) {
          const timeoutMs = attempts[i];
          const start = Date.now();
          try {
            const p = getNearbyPrices(searchCommodity, loc, radiusKm, 5, fuelRatePerTonKm, mandiFeesPerTon);
            const r = await Promise.race([
              p,
              new Promise((_, rej) => setTimeout(() => rej(new Error('Nearby request timed out (server may be slow). Please Retry Nearby.')), timeoutMs)),
            ]);
            const elapsed = Date.now() - start;
            if ((r as any).error) throw new Error((r as any).error);
            const nearby = (r as any).data?.nearby || [];
            setNearbyDebug((d) => ({ ...(d || {}), res: (r as any).data, lastAttemptMs: elapsed, attempts: i + 1, ts: new Date().toISOString() }));
            if (nearby && nearby.length) {
              setNearestMandi(nearby[0]);
              const mapped = nearby.map((n:any) => ({ city: n.city || n.market || n.name || '', modal_price: n.modal_price, effective_price: n.effective_price, min_price: n.min_price, max_price: n.max_price, date: n.date, distance_km: n.distance_km, lat: n.lat, lon: n.lon }));
              setSearchResults(mapped);
            }
            lastErr = null;
            break;
          } catch (err: any) {
            lastErr = err;
            setNearbyDebug((d) => ({ ...(d || {}), error: err?.message || String(err), lastAttemptMs: Date.now() - start, attempts: i + 1, ts: new Date().toISOString() }));
            await new Promise((r) => setTimeout(r, 500 * (i + 1)));
          }
        }
        if (lastErr) throw lastErr;
      } catch (err: any) {
        setNearbyDebug((d) => ({ ...(d || {}), error: err?.message || String(err), ts: new Date().toISOString() }));
        // ignore
      } finally {
        setMandiLoading(false);
      }
    } catch (e) {}
  }

  // Check backend health so we can surface connectivity issues in the UI
  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const api = getApiUrl();
        const url = api.replace(/\/$/, '') + '/healthz';
        const res = await fetch(url);
        if (!mounted) return;
        if (!res.ok) {
          setBackendStatus({ ok: false, status: res.status, message: await res.text().catch(() => '') });
        } else {
          setBackendStatus({ ok: true, status: res.status });
        }
      } catch (e: any) {
        if (!mounted) return;
        setBackendStatus({ ok: false, message: e?.message || String(e) });
      }
    })();
    return () => { mounted = false; };
  }, []);
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-neutral-900 mb-2">
                🏪 {t('marketPrices')}
              </h1>
              <p className="text-sm sm:text-base text-neutral-600 max-w-2xl">
                {t('marketPricesSub')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => window.open('/', '_self')}>
                🏠 {t('home')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.open('/diagnostic', '_self')}>
                🔬 {t('cropDiagnostics')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => window.open('/weather', '_self')}>
                🌤️ {t('weather')}
              </Button>
              <LanguageSelector />
            </div>
          </div>
        </div>

        {/* Backend Status Alert */}
        {backendStatus && !backendStatus.ok && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-xl">⚠️</span>
              <div>
                <div className="font-semibold text-red-900">Backend Connection Issue</div>
                <div className="text-sm text-red-700">{backendStatus.message || `Status: ${backendStatus.status || 'Unknown'}`}</div>
              </div>
            </div>
          </div>
        )}

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Sidebar - Search & Settings */}
          <aside className="lg:col-span-4 space-y-6">
            
            {/* Search Card */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">🔍 {t('searchMarkets')}</h2>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-neutral-600 mb-1 block">{t('quickSelect')}</label>
                    <select
                      value={searchCommodity}
                      onChange={(e)=>setSearchCommodity(e.target.value)}
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value="">{t('selectCommodity')}</option>
                      <option value="Wheat">Wheat (गेहूँ/ଗହମ)</option>
                      <option value="Rice">Rice (चावल/ଚାଉଳ)</option>
                      <option value="Tomato">Tomato (टमाटर/ଟମାଟୋ)</option>
                      <option value="Potato">Potato (आलू/ଆଳୁ)</option>
                      <option value="Maize">Maize (मक्का/ମକା)</option>
                      <option value="Cotton">Cotton (कपास/କପା)</option>
                      <option value="Chillies">Chillies (मिर्च/ଲଙ୍କା)</option>
                      <option value="Eggplant">Eggplant (बैंगन/ବାଇଗଣ)</option>
                      <option value="Okra">Okra (भिंडी/ଭେଣ୍ଡି)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-neutral-600 mb-1 block">{t('commodity')}</label>
                    <input 
                      value={searchCommodity} 
                      onChange={(e)=>setSearchCommodity(e.target.value)} 
                      placeholder="e.g., Wheat, Tomato" 
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs text-neutral-600 mb-1 block">{t('regionOptional')}</label>
                    <input 
                      value={searchRegion} 
                      onChange={(e)=>setSearchRegion(e.target.value)} 
                      placeholder="State or District" 
                      className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={limitToLocation} 
                      onChange={(e)=>setLimitToLocation(e.target.checked)} 
                      className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="text-neutral-700">{t('limitToLocation')}</span>
                  </label>

                  <div className="flex gap-2 pt-2">
                    <Button 
                      variant="primary" 
                      className="flex-1"
                      onClick={async ()=>{
                        setSearchError(null);
                        setSearchResults(null);
                        setSearchForecast(null);
                        if (!searchCommodity) { setSearchError('Enter a commodity'); return; }
                        setSearchLoading(true);
                        try {
                          const api = await import('@/lib/api');
                          if (limitToLocation && locationState) {
                            const nearbyResp = await api.getNearbyPrices(searchCommodity, locationState, radiusKm, 20, fuelRatePerTonKm, mandiFeesPerTon);
                            if (nearbyResp.error) {
                              setSearchError(typeof nearbyResp.error === 'string' ? nearbyResp.error : 'Server error fetching nearby prices');
                              setSearchResults([]);
                              setSearchForecast(null);
                              return;
                            }
                            const nearby = nearbyResp.data?.nearby || [];
                            const mapped = nearby.map((n:any) => ({ city: n.city || '', modal_price: n.modal_price, effective_price: n.effective_price, min_price: n.min_price, max_price: n.max_price, date: n.date, distance_km: n.distance_km, lat: n.lat, lon: n.lon }));
                            setSearchResults(mapped);
                            setSearchForecast(null);
                          } else {
                            const r = await api.getMarketPrices(searchCommodity, undefined, searchRegion || undefined);
                            if (r.error) {
                              setSearchError(typeof r.error === 'string' ? r.error : 'Server error fetching prices');
                              setSearchResults([]);
                              setSearchForecast(null);
                              return;
                            }
                            setSearchResults(r.data?.prices || []);
                            setSearchForecast(r.data?.forecast || null);
                          }
                        } catch (err: any) {
                          setSearchError(err?.message || 'Failed to fetch');
                        } finally { setSearchLoading(false); }
                      }}
                    >
                      {searchLoading ? 'Searching…' : `🔎 ${t('search')}`}
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={()=>{ 
                        setSearchCommodity(''); 
                        setSearchRegion(''); 
                        setSearchResults(null); 
                        setSearchError(null); 
                      }}
                    >
                      {t('clear')}
                    </Button>
                  </div>

                  {searchError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <p className="text-sm text-red-700">{searchError}</p>
                    </div>
                  )}
                </div>
              </div>
            </Card>

            {/* Transport Settings */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">⚙️ Transport Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-neutral-600 mb-1 block">Search Radius</label>
                    <div className="flex gap-2">
                      {[50, 100, 200].map((r) => (
                        <button
                          key={r}
                          className={`flex-1 px-3 py-2 text-sm rounded-lg font-medium transition ${
                            radiusKm === r 
                              ? 'bg-primary-600 text-white shadow-md' 
                              : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                          }`}
                          onClick={() => setRadiusKm(r)}
                        >
                          {r} km
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Fuel Rate (₹/ton·km)</label>
                      <input 
                        type="number"
                        step="0.001"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        value={fuelRatePerTonKm} 
                        onChange={(e)=>setFuelRatePerTonKm(Number(e.target.value || 0))} 
                      />
                    </div>
                    <div>
                      <label className="text-xs text-neutral-600 mb-1 block">Mandi Fees (₹/ton)</label>
                      <input 
                        type="number"
                        step="0.01"
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                        value={mandiFeesPerTon} 
                        onChange={(e)=>setMandiFeesPerTon(Number(e.target.value || 0))} 
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-neutral-200">
                    <h3 className="text-xs font-semibold text-neutral-700 mb-2">How Effective Price Works</h3>
                    <p className="text-xs text-neutral-600 leading-relaxed">
                      Effective Price = Modal Price − (Distance × Fuel Rate) − Mandi Fees
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Location Controls */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <h2 className="text-lg font-semibold text-neutral-900 mb-4">📍 Location</h2>
                <div className="space-y-3">
                  {locationState ? (
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">✓</span>
                        <span className="text-sm font-medium text-green-900">Location Active</span>
                      </div>
                      <p className="text-xs text-green-700">
                        {locationState.lat.toFixed(4)}, {locationState.lng.toFixed(4)}
                      </p>
                    </div>
                  ) : (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800">
                        {geoPermission === 'denied' 
                          ? 'Location access blocked. Enable in browser settings.' 
                          : 'Requesting location...'}
                      </p>
                    </div>
                  )}
                  
                  <Button 
                    variant="secondary" 
                    className="w-full"
                    onClick={async () => {
                      if (locationState) {
                        setMandiLoading(true);
                        try { await requestLocationFromUser(); } finally { setMandiLoading(false); }
                      } else {
                        await requestLocationFromUser();
                      }
                    }}
                  >
                    {mandiLoading ? 'Fetching...' : '🔄 Refresh Location'}
                  </Button>
                </div>
              </div>
            </Card>

          </aside>

          {/* Main Content - Results */}
          <main className="lg:col-span-8 space-y-6">
            
            {/* Nearest Market Card */}
            <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-neutral-900">Nearest Market</h2>
                      {searchCommodity?.trim() && (
                        <span className="px-2 py-1 text-xs rounded bg-emerald-100 text-emerald-800">for {searchCommodity}</span>
                      )}
                    </div>
                    <p className="text-sm text-neutral-500 mt-1">Distance-adjusted effective pricing</p>
                  </div>
                  {nearestMandi && (
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        if (nearestMandi.lat && nearestMandi.lon) {
                          window.open(`https://www.openstreetmap.org/#map=12/${nearestMandi.lat}/${nearestMandi.lon}`, '_blank');
                        } else {
                          window.open(`https://www.openstreetmap.org/search?query=${encodeURIComponent(nearestMandi.city || '')}`, '_blank');
                        }
                      }}
                    >
                      📍 Open Map
                    </Button>
                  )}
                </div>

                {nearestMandi ? (
                  <div className="bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-200 rounded-xl p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold text-emerald-900">
                          {nearestMandi.city}{nearestMandi.state ? `, ${nearestMandi.state}` : ''}
                        </h3>
                        <p className="text-sm text-emerald-700 mt-1">
                          📏 {Number(nearestMandi.distance_km || 0).toFixed(1)} km away
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-emerald-900">
                          ₹{Math.round(nearestMandi.modal_price || 0)}
                        </div>
                        <div className="text-sm text-emerald-700">per quintal</div>
                      </div>
                    </div>

                    {(() => {
                      const modal = Number(nearestMandi.modal_price || 0);
                      const dist = Number(nearestMandi.distance_km || 0);
                      const perQFuel = (Number(fuelRatePerTonKm || 0) || 0) / 10.0;
                      const fuelCost = +(dist * perQFuel).toFixed(2);
                      const mandiFeeQ = +(Number(mandiFeesPerTon || 0) / 10.0).toFixed(2);
                      const computedEff = +(modal - fuelCost - mandiFeeQ).toFixed(2);
                      const serverEff = nearestMandi.effective_price !== undefined ? Number(nearestMandi.effective_price) : undefined;
                      
                      return (
                        <div className="bg-white/70 rounded-lg p-4 border border-emerald-200">
                          <h4 className="text-sm font-semibold text-neutral-800 mb-3">Price Breakdown</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Modal Price:</span>
                              <span className="font-medium">₹{modal}/q</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Fuel Cost:</span>
                              <span className="text-red-600">- ₹{fuelCost}/q</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Mandi Fees:</span>
                              <span className="text-red-600">- ₹{mandiFeeQ}/q</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-neutral-300">
                              <span className="font-semibold text-neutral-800">Effective Price:</span>
                              <span className="font-bold text-emerald-700">₹{computedEff}/q</span>
                            </div>
                            {serverEff !== undefined && (
                              <p className="text-xs text-neutral-500 mt-1">Server calculated: ₹{serverEff.toFixed(2)}/q</p>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="p-8 text-center bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300">
                    {mandiLoading ? (
                      <div>
                        <div className="text-4xl mb-3">⏳</div>
                        <p className="text-neutral-600">Searching for nearest markets...</p>
                      </div>
                    ) : !searchCommodity?.trim() ? (
                      <div>
                        <div className="text-4xl mb-3">🛒</div>
                        <p className="text-neutral-900 font-medium mb-2">Select a commodity to see markets</p>
                        <p className="text-sm text-neutral-600">Choose a crop (e.g., Wheat, Rice, Tomato) and tap Search.</p>
                      </div>
                    ) : nearbyDebug?.error ? (
                      <div>
                        <div className="text-4xl mb-3">⚠️</div>
                        <p className="text-neutral-900 font-medium mb-2">Failed to fetch nearby markets</p>
                        <p className="text-sm text-neutral-600">{nearbyDebug.error}</p>
                      </div>
                    ) : geoPermission === 'denied' ? (
                      <div>
                        <div className="text-4xl mb-3">🚫</div>
                        <p className="text-neutral-900 font-medium mb-2">Location Access Blocked</p>
                        <p className="text-sm text-neutral-600">Enable location access in your browser settings</p>
                      </div>
                    ) : (
                      <div>
                        <div className="text-4xl mb-3">📍</div>
                        <p className="text-neutral-600">Requesting location to find nearest markets...</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            {/* Search Results */}
            {searchResults && searchResults.length > 0 && (
              <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                    Market Results ({searchResults.length})
                  </h2>
                  
                  <div className="space-y-3">
                    {searchResults.slice(0, 10).map((result: any, idx: number) => (
                      <div 
                        key={idx} 
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedMarketItem(result)}
                        className="p-4 bg-neutral-50 border border-neutral-200 rounded-lg hover:shadow-md transition cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-neutral-900">{result.city}</h3>
                            <div className="flex items-center gap-4 mt-2 text-sm text-neutral-600">
                              {result.distance_km !== undefined && (
                                <span className="flex items-center gap-1">
                                  📏 {Math.round(result.distance_km)} km
                                </span>
                              )}
                              {result.date && (
                                <span className="text-xs text-neutral-500">{result.date}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-primary-600">
                              ₹{Math.round(result.modal_price || 0)}
                            </div>
                            <div className="text-xs text-neutral-500">per quintal</div>
                            {result.effective_price !== undefined && (
                              <div className="text-sm text-emerald-600 mt-1">
                                Eff: ₹{Math.round(result.effective_price)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {(result.lat && result.lon) && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="mt-3"
                            onClick={(e:any) => {
                              e.stopPropagation();
                              window.open(`https://www.openstreetmap.org/#map=12/${result.lat}/${result.lon}`, '_blank');
                            }}
                          >
                            📍 View on Map
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

              {selectedMarketItem && (
                <Modal
                  title={`How Effective Price Works — ${selectedMarketItem.city || 'Market'}`}
                  subtitle={selectedMarketItem.date ? selectedMarketItem.date : ''}
                  onClose={() => setSelectedMarketItem(null)}
                  size="xl"
                >
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-neutral-700 font-medium">Formula</p>
                      <p className="text-sm text-neutral-700">Effective Price = Modal Price − Fuel Cost (per quintal) − Mandi Fees</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-neutral-600 mb-1 block">Total Fuel Cost (₹ per trip)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          value={modalTotalFuelCost}
                          onChange={(e) => setModalTotalFuelCost(e.target.value)}
                        />
                        <p className="text-xs text-neutral-400 mt-1">Enter expected fuel expense for the trip to this market.</p>

                        <label className="text-xs text-neutral-600 mb-1 block mt-2">Quantity Transported (quintals)</label>
                        <input
                          type="number"
                          step="1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          value={modalQuantityQuintals}
                          onChange={(e) => setModalQuantityQuintals(e.target.value)}
                        />
                        <p className="text-xs text-neutral-400 mt-1">How many quintals you expect to carry on this trip (e.g., 10 for 1 ton).</p>
                      </div>
                      <div>
                        <label className="text-xs text-neutral-600 mb-1 block">Fuel Price (₹/L)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          value={modalFuelPricePerL}
                          onChange={(e) => setModalFuelPricePerL(e.target.value)}
                        />
                        <p className="text-xs text-neutral-400 mt-1">Local fuel price per litre.</p>

                        <label className="text-xs text-neutral-600 mb-1 block mt-2">Vehicle Efficiency (km/L)</label>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          value={modalKmPerL}
                          onChange={(e) => setModalKmPerL(e.target.value)}
                        />
                        <p className="text-xs text-neutral-400 mt-1">Your vehicle's average kilometers per litre.</p>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            className="px-3 py-2 bg-primary-600 text-white rounded-lg text-sm"
                            onClick={() => {
                                const dist = Number(selectedMarketItem.distance_km || 0);
                                const roundTrip = dist * 2;
                                const kmPerL = parseFloat(modalKmPerL) || 0;
                                const pricePerL = parseFloat(modalFuelPricePerL) || 0;
                                if (!kmPerL || kmPerL <= 0) return;
                                const est = +(pricePerL * (roundTrip / kmPerL)).toFixed(2);
                                setModalTotalFuelCost(String(est));
                              }}
                          >Use estimate</button>
                          <div className="text-xs text-neutral-500">Estimated fuel = (round-trip km ÷ km/L) × ₹/L</div>
                        </div>

                        <label className="text-xs text-neutral-600 mb-1 block mt-3">Mandi Fees (₹/ton)</label>
                        <input
                          type="number"
                          step="0.01"
                          className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
                          value={modalMandiFees}
                          onChange={(e) => setModalMandiFees(e.target.value)}
                        />
                        <p className="text-xs text-neutral-400 mt-1">Enter fees you expect to pay at this mandi.</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-neutral-200">
                      {(() => {
                        const modalPrice = Number(selectedMarketItem.modal_price || 0);
                        const totalFuel = parseFloat(modalTotalFuelCost || '0') || 0;
                        const qtyQ = Math.max(1, Math.floor(parseFloat(modalQuantityQuintals || '1') || 1));
                        const perQFuel = +(totalFuel / qtyQ).toFixed(2);
                        const fuelCost = perQFuel;
                        const mandiFeeQ = +((parseFloat(modalMandiFees || '0') || 0) / 10.0).toFixed(2);
                        const computedEff = +(modalPrice - fuelCost - mandiFeeQ).toFixed(2);
                        return (
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Modal Price:</span>
                              <span className="font-medium">₹{modalPrice}/q</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Fuel Cost (per quintal):</span>
                              <span className="text-red-600">- ₹{fuelCost}/q</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-neutral-600">Mandi Fees:</span>
                              <span className="text-red-600">- ₹{mandiFeeQ}/q</span>
                            </div>
                            <div className="flex justify-between pt-2 border-t border-neutral-300">
                              <span className="font-semibold text-neutral-800">Effective Price:</span>
                              <span className="font-bold text-emerald-700">₹{computedEff}/q</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    <div className="pt-3 flex justify-end">
                      <Button variant="secondary" onClick={() => setSelectedMarketItem(null)}>Close</Button>
                    </div>
                  </div>
                </Modal>
              )}

            {/* 14-Day Forecast */}
            {searchForecast && searchForecast.length > 0 && (
              <Card variant="elevated" className="bg-white/90 backdrop-blur-sm">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-neutral-900 mb-4">
                    📊 14-Day Price Forecast
                  </h2>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {searchForecast.slice(0, 8).map((forecast: any, idx: number) => (
                      <div 
                        key={idx} 
                        className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200"
                      >
                        <div className="text-xs text-blue-700 mb-2">{forecast.date}</div>
                        <div className="text-2xl font-bold text-blue-900 mb-1">
                          ₹{Math.round(forecast.modal_price)}
                        </div>
                        <div className="text-xs text-blue-600">
                          {forecast.trend || 'Stable'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

          </main>

        </div>
      </div>
    </div>
  );
}
