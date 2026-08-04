import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Badge, Card } from '@/components/ui';
import useCountUp from '@/lib/useCountUp';
import { useI18n } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';
import ReactMarkdown from 'react-markdown';
import { getApiUrl } from '@/lib/api';

function CentralChat() {
  const { t } = useI18n();
  const [chatHistory, setChatHistory] = useState<{role:'user'|'assistant';content:string}[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const _prevChatLen = useRef(0);

  useEffect(() => {
    if (chatHistory.length > _prevChatLen.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    _prevChatLen.current = chatHistory.length;
  }, [chatHistory]);

  const send = async () => {
    if (!input.trim()) return;
    const message = input.trim();
    setChatHistory(prev => [...prev, {role:'user', content: message}]);
    setInput('');
    setLoading(true);
    try {
      const apiBase = getApiUrl();
      const res = await fetch(`${apiBase}/api/agents/central`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message }) });
      if (!res.ok) throw new Error('Server '+res.status);
      const data = await res.json();
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      setChatHistory(prev => [...prev, {role:'assistant', content}]);
    } catch (e:any) {
      setChatHistory(prev => [...prev, {role:'assistant', content: 'Error: '+(e?.message||String(e))}]);
    } finally { setLoading(false); }
  };

  return (
    <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200">
      <div className="text-sm font-medium text-neutral-600 mb-2">💬 {t('chat')}</div>
      <div className="h-40 overflow-auto mb-2 space-y-2">
        {chatHistory.map((m, i) => (
          <div key={i} className={m.role==='user'? 'text-right':'text-left'}>
            <div className={`inline-block p-2 rounded text-sm ${m.role==='user' ? 'bg-indigo-600 text-white' : 'bg-white border'}`}>
              {m.role==='assistant' ? <ReactMarkdown>{m.content}</ReactMarkdown> : <div>{m.content}</div>}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <div className="flex gap-2">
        <input value={input} onChange={(e)=>setInput(e.target.value)} onKeyPress={(e)=>e.key==='Enter'&&send()} className="flex-1 px-3 py-2 border rounded text-sm" placeholder={t('askPlaceholder')} />
        <button onClick={send} className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium" disabled={loading}>{t('send')}</button>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const features = [
    {
      icon: '🌿',
      title: t('cropHealth'),
      description: t('cropHealthSub'),
      badge: t('aiPowered'),
      badgeVariant: 'primary' as const,
      href: '/diagnostic',
      color: 'from-green-100 to-emerald-50',
      hoverColor: 'hover:border-green-200',
      textColor: 'text-green-600'
    },
    {
      icon: '💰',
      title: t('marketPrices'),
      description: t('marketPricesSub'),
      badge: t('liveData'),
      badgeVariant: 'success' as const,
      href: '/market',
      color: 'from-emerald-100 to-teal-50',
      hoverColor: 'hover:border-emerald-200',
      textColor: 'text-emerald-600'
    },
    {
      icon: '🌧️',
      title: t('weather'),
      description: t('weatherAlertsSub'),
      badge: t('ibfSystem'),
      badgeVariant: 'warning' as const,
      href: '/weather',
      color: 'from-amber-100 to-orange-50',
      hoverColor: 'hover:border-amber-200',
      textColor: 'text-amber-600'
    },
    {
      icon: '🧪',
      title: t('soilReportAdvisor'),
      description: t('soilAdvisorSub'),
      badge: t('ocrChat'),
      badgeVariant: 'primary' as const,
      href: '/soil-report',
      color: 'from-indigo-100 to-purple-50',
      hoverColor: 'hover:border-indigo-200',
      textColor: 'text-indigo-700'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600/40 to-emerald-600/40" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center text-white">
            {/* Logo */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-sm shadow-2xl mb-6">
              <span className="text-4xl">🌾</span>
            </div>
            
            {/* Main Heading */}
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4">
              {t('siteTitle')}
            </h1>
            <p className="text-xl sm:text-2xl font-medium text-green-100 mb-2">
              {t('siteSubtitle')}
            </p>
            <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto mb-8">
              {t('heroSubhead')}
            </p>

            <div className="absolute right-6 top-6 z-30">
              <LanguageSelector />
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
              <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/30">
                <div className="text-3xl font-bold mb-1">{useCountUp(50, 800)}+</div>
                <div className="text-sm text-green-100">{t('diseasesDetected')}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/30">
                <div className="text-3xl font-bold mb-1">₹{useCountUp(2450, 1000)}</div>
                <div className="text-sm text-green-100">{t('wheatPrice')}</div>
              </div>
              <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/30">
                <div className="text-3xl font-bold mb-1">{useCountUp(24, 800)}°C</div>
                <div className="text-sm text-green-100">{t('currentTemp')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Offline Notice */}
      {!isOnline && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 -mt-6 relative z-10">
          <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-xl flex items-start gap-3 shadow-lg">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="font-semibold text-amber-900 mb-1">{t('offlineTitle')}</h4>
              <p className="text-sm text-amber-700">{t('offlineSubtitle')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        
        {/* Features Grid */}
        <div className="mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-neutral-900 mb-2">
              {t('heroHeadline')}
            </h2>
            <p className="text-neutral-600">
              {t('heroSubhead')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, idx) => (
              <Card
                key={idx}
                variant="elevated"
                className={`group cursor-pointer hover:shadow-2xl ${feature.hoverColor} transition-all duration-300 transform hover:scale-105 bg-white/90 backdrop-blur-sm`}
                onClick={() => router.push(feature.href)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-md group-hover:scale-110 transition-transform duration-300`}>
                      <span className="text-4xl">{feature.icon}</span>
                    </div>
                    <Badge variant={feature.badgeVariant} size="sm">
                      {feature.badge}
                    </Badge>
                  </div>
                  
                  <h3 className="text-lg font-bold text-neutral-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-neutral-600 leading-relaxed mb-4">
                    {feature.description}
                  </p>
                  
                  <div className={`flex items-center ${feature.textColor} text-sm font-medium group-hover:gap-2 transition-all`}>
                    <span>{t('explore')}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card variant="elevated" className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">📱</span>
                <h3 className="text-lg font-bold text-neutral-900">{t('mobileFriendly')}</h3>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {t('mobileDesc')}
              </p>
            </div>
          </Card>

          <Card variant="elevated" className="bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🌐</span>
                <h3 className="text-lg font-bold text-neutral-900">{t('offlineSupport')}</h3>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {t('offlineDesc')}
              </p>
            </div>
          </Card>

          <Card variant="elevated" className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🇮🇳</span>
                <h3 className="text-lg font-bold text-neutral-900">{t('indiaFocused')}</h3>
              </div>
              <p className="text-sm text-neutral-600 leading-relaxed">
                {t('indiaDesc')}
              </p>
            </div>
          </Card>
        </div>

        {/* How It Helps */}
        <Card variant="elevated" className="bg-white/90 backdrop-blur-sm mb-12">
          <div className="p-8">
            <h2 className="text-2xl font-bold text-neutral-900 mb-6 text-center">
              {t('howItHelps')}
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <span className="text-2xl text-green-700">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">{t('preventLosses')}</h3>
                  <p className="text-sm text-neutral-600">
                    {t('preventLossesDesc')}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-2xl text-emerald-700">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">{t('maximizeProfits')}</h3>
                  <p className="text-sm text-neutral-600">
                    {t('maximizeProfitsDesc')}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center">
                  <span className="text-2xl text-amber-700">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">{t('reduceWeatherRisks')}</h3>
                  <p className="text-sm text-neutral-600">
                    {t('reduceWeatherRisksDesc')}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center">
                  <span className="text-2xl text-yellow-700">✓</span>
                </div>
                <div>
                  <h3 className="font-semibold text-neutral-900 mb-2">{t('improveSoilHealth')}</h3>
                  <p className="text-sm text-neutral-600">
                    {t('improveSoilHealthDesc')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Centralized AI Chat Component */}
        <CentralChat />
      </main>
    </div>
  );
}
