import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Badge, Button, Card } from '@/components/ui';
import useCountUp from '@/lib/useCountUp';
import { useI18n } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';
import ReactMarkdown from 'react-markdown';
import { getApiUrl } from '@/lib/api';

function CentralChat() {
  const { t } = useI18n();
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const prevChatLen = useRef(0);

  useEffect(() => {
    if (chatHistory.length > prevChatLen.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevChatLen.current = chatHistory.length;
  }, [chatHistory]);

  const send = async () => {
    if (!input.trim()) return;

    const message = input.trim();
    setChatHistory((prev) => [...prev, { role: 'user', content: message }]);
    setInput('');
    setLoading(true);

    try {
      const apiBase = getApiUrl();
      const res = await fetch(`${apiBase}/api/agents/central`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      if (!res.ok) throw new Error(`Server ${res.status}`);

      const data = await res.json();
      const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      setChatHistory((prev) => [...prev, { role: 'assistant', content }]);
    } catch (error: any) {
      setChatHistory((prev) => [...prev, { role: 'assistant', content: `Error: ${error?.message || String(error)}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card variant="elevated" className="overflow-hidden border-white/70 bg-white/95 shadow-[0_18px_40px_rgba(16,24,40,0.08)]">
      <div className="border-b border-neutral-200/70 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-700">{t('chat')}</div>
            <h3 className="mt-1 text-lg font-semibold text-neutral-950">AI farm desk</h3>
          </div>
          <Badge variant="success" dot>
            Live support
          </Badge>
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="max-h-56 space-y-3 overflow-auto pr-1">
          {chatHistory.map((message, index) => (
            <div key={index} className={message.role === 'user' ? 'text-right' : 'text-left'}>
              <div
                className={`inline-block max-w-[92%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                  message.role === 'user'
                    ? 'bg-emerald-600 text-white'
                    : 'border border-neutral-200 bg-white text-neutral-700'
                }`}
              >
                {message.role === 'assistant' ? <ReactMarkdown>{message.content}</ReactMarkdown> : <div>{message.content}</div>}
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && send()}
            className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            placeholder={t('askPlaceholder')}
          />
          <Button variant="primary" size="md" onClick={send} disabled={loading} className="sm:px-6">
            {t('send')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.26em] text-emerald-700">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-neutral-600">{description}</p>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [isOnline, setIsOnline] = useState(true);
  const diseasesDetected = useCountUp(50, 800);
  const wheatPrice = useCountUp(2450, 1000);
  const temperature = useCountUp(24, 800);

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

  const featureCards = [
    {
      icon: '🌿',
      title: t('cropHealth'),
      description: t('cropHealthSub'),
      badge: t('aiPowered'),
      badgeVariant: 'primary' as const,
      href: '/diagnostic',
    },
    {
      icon: '💰',
      title: t('marketPrices'),
      description: t('marketPricesSub'),
      badge: t('liveData'),
      badgeVariant: 'success' as const,
      href: '/market',
    },
    {
      icon: '🌧️',
      title: t('weather'),
      description: t('weatherAlertsSub'),
      badge: t('ibfSystem'),
      badgeVariant: 'warning' as const,
      href: '/weather',
    },
    {
      icon: '🧪',
      title: t('soilReportAdvisor'),
      description: t('soilAdvisorSub'),
      badge: t('ocrChat'),
      badgeVariant: 'primary' as const,
      href: '/soil-report',
    },
  ];

  const supportCards = [
    {
      icon: '📱',
      title: t('mobileFriendly'),
      description: t('mobileDesc'),
    },
    {
      icon: '🌐',
      title: t('offlineSupport'),
      description: t('offlineDesc'),
    },
    {
      icon: '🇮🇳',
      title: t('indiaFocused'),
      description: t('indiaDesc'),
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,253,245,0.88),_rgba(255,255,255,0.98)_36%,_rgba(247,250,247,0.98)_100%)] text-neutral-900">
      <section className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pt-6 lg:pb-14">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 rounded-full border border-emerald-100 bg-white/90 px-4 py-2 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-2xl">🌾</span>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-emerald-700">Kisan Buddy</div>
              <div className="text-sm font-medium text-neutral-700">{t('siteSubtitle')}</div>
            </div>
          </div>

          <div className="rounded-full border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm">
            <LanguageSelector className="text-neutral-700" />
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div className="space-y-6">
            <Badge variant="neutral" className="bg-white text-neutral-700" dot>
              Field-first agriculture dashboard
            </Badge>

            <div className="max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl lg:text-6xl">
                {t('siteTitle')}
              </h1>
              <p className="text-lg leading-8 text-neutral-600 sm:text-xl">
                {t('heroSubhead')}
              </p>
              <p className="max-w-2xl text-base leading-7 text-neutral-600">
                A straightforward dashboard for crop health, soil care, mandi prices, and weather alerts.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button
                variant="primary"
                size="lg"
                onClick={() => router.push('/diagnostic')}
                icon={<span>🌿</span>}
              >
                Start diagnosis
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={() => router.push('/market')}
                icon={<span>💰</span>}
              >
                View mandi prices
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Card variant="elevated" className="bg-white/95">
                <div className="p-4">
                  <div className="text-sm text-neutral-500">{t('diseasesDetected')}</div>
                  <div className="mt-2 text-3xl font-semibold text-neutral-950">{diseasesDetected}+</div>
                </div>
              </Card>
              <Card variant="elevated" className="bg-white/95">
                <div className="p-4">
                  <div className="text-sm text-neutral-500">{t('wheatPrice')}</div>
                  <div className="mt-2 text-3xl font-semibold text-neutral-950">₹{wheatPrice}</div>
                </div>
              </Card>
              <Card variant="elevated" className="bg-white/95">
                <div className="p-4">
                  <div className="text-sm text-neutral-500">{t('currentTemp')}</div>
                  <div className="mt-2 text-3xl font-semibold text-neutral-950">{temperature}°C</div>
                </div>
              </Card>
            </div>
          </div>

          <Card variant="elevated" className="border-emerald-100 bg-white/95 shadow-[0_18px_40px_rgba(16,24,40,0.08)]">
            <div className="p-6 sm:p-7">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Farm overview</div>
                  <h2 className="mt-1 text-2xl font-semibold tracking-tight text-neutral-950">Season summary</h2>
                </div>
                <Badge variant="success" dot>
                  Live
                </Badge>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                  <div className="text-sm text-neutral-500">Crop health</div>
                  <div className="mt-2 text-xl font-semibold text-neutral-950">Healthy</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">Crop growth looks steady with no immediate stress.</p>
                </div>
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                  <div className="text-sm text-neutral-500">Next step</div>
                  <div className="mt-2 text-xl font-semibold text-neutral-950">Plan field work</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">Weather is suitable for light farm work and inspection.</p>
                </div>
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-5 sm:col-span-2">
                  <div className="text-sm text-neutral-500">Harvest market</div>
                  <div className="mt-2 text-xl font-semibold text-neutral-950">Good nearby pricing</div>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">The nearest mandi shows a steady price trend for fresh produce.</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                <Badge variant="success" dot>Crop care</Badge>
                <Badge variant="warning" dot>Soil health</Badge>
                <Badge variant="primary" dot>Weather watch</Badge>
                <Badge variant="neutral" dot>Harvest planning</Badge>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {!isOnline && (
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 p-4 shadow-sm">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="mb-1 font-semibold text-amber-950">{t('offlineTitle')}</h4>
              <p className="text-sm text-amber-800">{t('offlineSubtitle')}</p>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 pb-14 pt-10 sm:px-6 sm:pb-18 lg:pb-24">
        <section className="mb-14">
          <SectionHeading
            eyebrow="Core tools"
            title="Clear access to the main farm workflows."
            description="The layout stays simple, but the content is tuned for crop care, field decisions, and harvest planning."
          />

          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            {featureCards.map((feature) => (
              <Card
                key={feature.title}
                variant="elevated"
                hover
                className="cursor-pointer border-white/70 bg-white/95 transition-all duration-300 hover:-translate-y-1"
                onClick={() => router.push(feature.href)}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-3xl shadow-sm">
                      {feature.icon}
                    </div>
                    <Badge variant={feature.badgeVariant} size="sm">
                      {feature.badge}
                    </Badge>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold tracking-tight text-neutral-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{feature.description}</p>
                  <div className="mt-5 text-sm font-semibold text-emerald-700">{t('explore')}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-14">
          <SectionHeading
            eyebrow="Why it helps"
            title="Less noise. More useful farm information."
            description="The page now feels like a dependable farming tool, with more whitespace and clearer hierarchy."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {supportCards.map((item) => (
              <Card key={item.title} variant="elevated" className="bg-white/95">
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">{item.icon}</span>
                    <h3 className="text-lg font-semibold tracking-tight text-neutral-950">{item.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-neutral-600">{item.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-4">
          <Card variant="elevated" className="bg-white/95">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-neutral-100 p-8 lg:border-b-0 lg:border-r">
                <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">How it helps</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950">Simple, practical support for daily farm decisions.</h2>
                <p className="mt-4 text-sm leading-7 text-neutral-600">
                  Use crop diagnostics, price checks, weather alerts, and soil guidance from one calm interface built for quick reading in the field.
                </p>
              </div>

              <div className="grid gap-4 p-8 sm:grid-cols-2">
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                  <h3 className="font-semibold text-neutral-950">{t('preventLosses')}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{t('preventLossesDesc')}</p>
                </div>
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                  <h3 className="font-semibold text-neutral-950">{t('maximizeProfits')}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{t('maximizeProfitsDesc')}</p>
                </div>
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                  <h3 className="font-semibold text-neutral-950">{t('reduceWeatherRisks')}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{t('reduceWeatherRisksDesc')}</p>
                </div>
                <div className="rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                  <h3 className="font-semibold text-neutral-950">{t('improveSoilHealth')}</h3>
                  <p className="mt-2 text-sm leading-6 text-neutral-600">{t('improveSoilHealthDesc')}</p>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section>
          <CentralChat />
        </section>
      </main>
    </div>
  );
}
