import { useState, useEffect, useRef, type CSSProperties, type PointerEvent } from 'react';
import { useRouter } from 'next/router';
import { Badge, Button, Card } from '@/components/ui';
import useCountUp from '@/lib/useCountUp';
import { useI18n } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';
import ReactMarkdown from 'react-markdown';
import { getApiUrl } from '@/lib/api';

type PointerState = {
  x: number;
  y: number;
};

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
    <Card variant="glass" className="overflow-hidden border-white/30 bg-white/90 shadow-[0_24px_70px_rgba(20,83,45,0.18)]">
      <div className="border-b border-neutral-200/70 bg-white/75 px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">{t('chat')}</div>
            <h3 className="mt-1 text-lg font-semibold text-neutral-950">AI farm desk</h3>
          </div>
          <Badge variant="success" dot>
            Live assistance
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

function HeroBackdrop({ pointer }: { pointer: PointerState }) {
  const baseStyle: CSSProperties = {
    transform: `translate3d(${(pointer.x - 50) * 0.35}px, ${(pointer.y - 50) * 0.35}px, 0)`,
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.46),_transparent_28%),linear-gradient(180deg,_rgba(18,72,37,0.92),_rgba(15,50,27,0.84)_48%,_rgba(11,31,17,0.96))]" />
      <div
        className="absolute -left-24 top-6 h-72 w-72 rounded-full bg-lime-300/30 blur-3xl animate-[farm-drift_18s_ease-in-out_infinite]"
        style={baseStyle}
      />
      <div
        className="absolute -right-20 top-20 h-80 w-80 rounded-full bg-amber-200/20 blur-3xl animate-[farm-drift-reverse_22s_ease-in-out_infinite]"
        style={{ transform: `translate3d(${(pointer.x - 50) * -0.3}px, ${(pointer.y - 50) * 0.22}px, 0)` }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[58%] bg-[linear-gradient(180deg,transparent_0%,rgba(11,33,18,0.24)_16%,rgba(7,25,14,0.72)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[46%] bg-[repeating-linear-gradient(105deg,rgba(255,255,255,0.14)_0_2px,transparent_2px_28px)] opacity-45 animate-[field-sweep_14s_linear_infinite]" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[linear-gradient(165deg,rgba(77,139,62,0.18),rgba(31,87,45,0.52)),radial-gradient(circle_at_40%_18%,rgba(255,255,255,0.32),transparent_28%)]" />
    </div>
  );
}

function LiveFarmScene({ pointer }: { pointer: PointerState }) {
  const motionStyle: CSSProperties = {
    transform: `translate3d(${(pointer.x - 50) * 0.45}px, ${(pointer.y - 50) * 0.28}px, 0)`,
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.75rem] border border-white/18 bg-[#0a2213] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,240,200,0.32),_transparent_28%),linear-gradient(180deg,_rgba(10,31,17,0.15),_rgba(6,23,13,0.95))]" />

      <div className="absolute inset-0 opacity-85" style={motionStyle}>
        <div className="absolute inset-x-0 top-0 h-36 bg-[linear-gradient(180deg,rgba(172,225,255,0.45),rgba(173,232,255,0.08),transparent)]" />
        <div className="absolute left-8 top-10 h-16 w-20 rounded-full bg-white/35 blur-2xl animate-[farm-cloud_18s_linear_infinite]" />
        <div className="absolute right-12 top-14 h-14 w-24 rounded-full bg-white/25 blur-2xl animate-[farm-cloud_24s_linear_infinite]" />
        <div className="absolute inset-x-0 top-[28%] h-[12%] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.22)_50%,transparent_100%)] opacity-40 animate-[farm-pan_12s_linear_infinite]" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[repeating-linear-gradient(170deg,rgba(239,250,225,0.08)_0_2px,transparent_2px_24px)] opacity-70" />
        <div className="absolute inset-x-0 bottom-0 h-[68%] bg-[linear-gradient(180deg,transparent_0%,rgba(21,85,39,0.36)_20%,rgba(15,66,33,0.84)_100%)]" />
        <div className="absolute -left-8 bottom-[24%] h-56 w-56 rounded-[45%_55%_40%_60%] bg-[radial-gradient(circle_at_35%_30%,rgba(126,242,154,0.26),rgba(31,102,46,0.94))] blur-[1px] animate-[farm-drift_12s_ease-in-out_infinite]" />
        <div className="absolute left-[24%] bottom-[16%] h-72 w-72 rounded-[44%_56%_52%_48%] bg-[radial-gradient(circle_at_45%_28%,rgba(154,248,178,0.18),rgba(22,81,38,0.92))] blur-[1px] animate-[farm-drift-reverse_14s_ease-in-out_infinite]" />
        <div className="absolute right-[8%] bottom-[17%] h-64 w-64 rounded-[52%_48%_46%_54%] bg-[radial-gradient(circle_at_50%_26%,rgba(181,255,198,0.2),rgba(17,67,32,0.92))] blur-[1px] animate-[farm-drift_16s_ease-in-out_infinite]" />
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_58%,rgba(6,22,12,0.12)_74%,rgba(6,22,12,0.68)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.06),transparent_24%,transparent_76%,rgba(255,255,255,0.05))]" />

      <div className="absolute left-5 top-5 flex items-center gap-2 rounded-full border border-white/18 bg-black/20 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/85 backdrop-blur-md">
        <span className="h-2 w-2 rounded-full bg-lime-400 shadow-[0_0_16px_rgba(163,230,53,0.9)]" />
        Live field feed
      </div>

      <div className="absolute right-5 top-5 rounded-2xl border border-white/18 bg-black/25 px-3 py-2 text-right text-white backdrop-blur-md">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/60">Drone desk</div>
        <div className="mt-1 text-sm font-semibold">Nashik district</div>
      </div>

      <div className="absolute inset-x-5 bottom-5 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-white/14 bg-white/10 px-3 py-2 text-white backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">Canopy</div>
          <div className="mt-1 text-lg font-semibold">92%</div>
        </div>
        <div className="rounded-2xl border border-white/14 bg-white/10 px-3 py-2 text-white backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">Moisture</div>
          <div className="mt-1 text-lg font-semibold">Balanced</div>
        </div>
        <div className="rounded-2xl border border-white/14 bg-white/10 px-3 py-2 text-white backdrop-blur-md">
          <div className="text-[10px] uppercase tracking-[0.18em] text-white/60">Risk</div>
          <div className="mt-1 text-lg font-semibold text-lime-300">Low</div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,transparent_55%,rgba(255,255,255,0.08)_56%,transparent_57%)] opacity-30 animate-[farm-pan_7s_linear_infinite]" />
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <Card variant="glass" className="border-white/18 bg-white/12 text-white shadow-[0_20px_50px_rgba(4,15,8,0.2)]">
      <div className="p-4">
        <div className="text-[10px] uppercase tracking-[0.22em] text-white/65">{label}</div>
        <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
        <div className="mt-1 text-sm text-white/75">{detail}</div>
      </div>
    </Card>
  );
}

function SectionHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mx-auto max-w-3xl text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-950 sm:text-4xl">{title}</h2>
      <p className="mt-4 text-base leading-7 text-neutral-600">{description}</p>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [isOnline, setIsOnline] = useState(true);
  const [pointer, setPointer] = useState<PointerState>({ x: 50, y: 45 });
  const diseaseCount = useCountUp(50, 800);
  const wheatPrice = useCountUp(2450, 1000);
  const currentTemp = useCountUp(24, 800);

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

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setPointer({
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    });
  };

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
      textColor: 'text-green-600',
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
      textColor: 'text-emerald-600',
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
      textColor: 'text-amber-600',
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
      textColor: 'text-indigo-700',
    },
  ];

  const quickActions = [
    {
      icon: '📱',
      title: t('mobileFriendly'),
      description: t('mobileDesc'),
      tone: 'from-sky-50 to-cyan-50',
      border: 'border-sky-200/80',
    },
    {
      icon: '🌐',
      title: t('offlineSupport'),
      description: t('offlineDesc'),
      tone: 'from-amber-50 to-orange-50',
      border: 'border-amber-200/80',
    },
    {
      icon: '🇮🇳',
      title: t('indiaFocused'),
      description: t('indiaDesc'),
      tone: 'from-emerald-50 to-lime-50',
      border: 'border-emerald-200/80',
    },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(236,253,245,0.75),_rgba(255,255,255,0.92)_34%,_rgba(236,253,245,0.9)_72%,_rgba(227,242,214,0.96))] text-neutral-900">
      <section
        className="relative isolate overflow-hidden"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setPointer({ x: 50, y: 45 })}
      >
        <HeroBackdrop pointer={pointer} />

        <div className="relative mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 sm:pb-18 sm:pt-6 lg:pb-20 lg:pt-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 rounded-full border border-white/14 bg-white/8 px-4 py-2 text-white/90 backdrop-blur-md shadow-[0_12px_30px_rgba(9,33,18,0.2)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-2xl">🌾</span>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/60">Kisan Buddy</div>
                <div className="text-sm font-medium text-white">{t('siteSubtitle')}</div>
              </div>
            </div>

            <div className="shrink-0 rounded-full border border-white/14 bg-white/10 px-3 py-2 backdrop-blur-md shadow-[0_12px_30px_rgba(9,33,18,0.2)]">
              <LanguageSelector className="text-white" />
            </div>
          </div>

          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
            <div className="space-y-7 text-white">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="success" dot className="border-white/20 bg-white/10 px-3 py-1.5 text-white">
                  Live farm intelligence
                </Badge>
                <span className="rounded-full border border-white/14 bg-white/8 px-3 py-1.5 text-xs font-medium text-white/82 backdrop-blur-md">
                  Weather + market + soil in one desk
                </span>
              </div>

              <div className="max-w-3xl space-y-5">
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-6xl">
                  A modern command center for Indian farmers.
                </h1>
                <p className="text-lg leading-8 text-emerald-50/92 sm:text-xl">
                  {t('heroSubhead')}. Track crop health, compare mandi prices, read weather risk, and act faster with one polished field-first workspace.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => router.push('/diagnostic')}
                  icon={<span>🌿</span>}
                  className="shadow-[0_18px_40px_rgba(14,116,144,0.32)]"
                >
                  Diagnose crop
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => router.push('/market')}
                  icon={<span>💰</span>}
                  className="border-white/20 bg-white/95 text-emerald-950 hover:bg-white"
                >
                  Check mandi
                </Button>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur-md shadow-[0_16px_34px_rgba(9,33,18,0.16)]">
                  <div className="text-sm text-white/70">{t('diseasesDetected')}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight">{diseaseCount}+</div>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur-md shadow-[0_16px_34px_rgba(9,33,18,0.16)]">
                  <div className="text-sm text-white/70">{t('wheatPrice')}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight">₹{wheatPrice}</div>
                </div>
                <div className="rounded-3xl border border-white/12 bg-white/10 p-4 backdrop-blur-md shadow-[0_16px_34px_rgba(9,33,18,0.16)]">
                  <div className="text-sm text-white/70">{t('currentTemp')}</div>
                  <div className="mt-2 text-3xl font-semibold tracking-tight">{currentTemp}°C</div>
                </div>
              </div>

              <div className="flex flex-wrap gap-3 text-sm text-white/80">
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 backdrop-blur-md">Interactive live motion background</span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 backdrop-blur-md">Built for mobile-first field use</span>
                <span className="rounded-full border border-white/12 bg-white/8 px-3 py-1.5 backdrop-blur-md">Regional language support</span>
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-4 rounded-[2.4rem] bg-emerald-400/15 blur-3xl" />
              <Card variant="glass" className="relative overflow-hidden border-white/18 bg-white/8 p-4 shadow-[0_30px_80px_rgba(7,22,12,0.34)] sm:p-5">
                <div className="mb-4 flex items-center justify-between gap-4 text-white">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/60">Live video-style field view</div>
                    <div className="mt-1 text-lg font-semibold">Monsoon-ready crop watch</div>
                  </div>
                  <Badge variant="success" dot className="border-white/18 bg-white/10 text-white">
                    Live
                  </Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
                  <div className="relative min-h-[360px] overflow-hidden rounded-[1.75rem] border border-white/12">
                    <LiveFarmScene pointer={pointer} />
                  </div>

                  <div className="space-y-4">
                    <MetricCard label="Crop health" value="Stable" detail="Leaf pulse normal, no acute stress" />
                    <MetricCard label="Next action" value="Spray in 2 days" detail="Weather window looks clear" />
                    <MetricCard label="Market pulse" value="Top grade" detail="Best nearby price trending upward" />
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {!isOnline && (
        <div className="relative z-10 mx-auto max-w-7xl px-4 -mt-6 sm:px-6">
          <div className="flex items-start gap-3 rounded-[1.75rem] border border-amber-200/80 bg-amber-50/95 p-4 shadow-[0_18px_40px_rgba(120,53,15,0.12)] backdrop-blur-sm">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="mb-1 font-semibold text-amber-950">{t('offlineTitle')}</h4>
              <p className="text-sm text-amber-800">{t('offlineSubtitle')}</p>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 sm:pb-18 lg:pb-24">
        <section className="mb-16">
          <SectionHeading
            eyebrow="Why farmers use it"
            title="Everything important, surfaced fast and clearly."
            description="The homepage now reads like a real working dashboard: stronger hierarchy, cleaner actions, and a premium visual system that still feels rooted in the field."
          />

          <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
            {features.map((feature, index) => (
              <Card
                key={index}
                variant="elevated"
                hover
                className={`group cursor-pointer overflow-hidden border-white/70 bg-white/90 backdrop-blur-sm transition-all duration-300 ${feature.hoverColor} hover:-translate-y-1`}
                onClick={() => router.push(feature.href)}
              >
                <div className="h-full p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${feature.color} shadow-[0_14px_30px_rgba(16,24,40,0.12)] transition-transform duration-300 group-hover:scale-105`}>
                      <span className="text-4xl">{feature.icon}</span>
                    </div>
                    <Badge variant={feature.badgeVariant} size="sm" className="shrink-0">
                      {feature.badge}
                    </Badge>
                  </div>

                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-neutral-950">{feature.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{feature.description}</p>

                  <div className={`mt-5 flex items-center text-sm font-semibold ${feature.textColor} transition-transform duration-300 group-hover:translate-x-1`}>
                    <span>{t('explore')}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <SectionHeading
            eyebrow="Farmers first"
            title="A calmer interface with better depth and better motion."
            description="These surfaces are tuned for quick scanning on mobile, low-friction reading outdoors, and a more premium brand feel overall."
          />

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {quickActions.map((item) => (
              <Card
                key={item.title}
                variant="elevated"
                className={`overflow-hidden border-2 ${item.border} bg-gradient-to-br ${item.tone} shadow-[0_14px_34px_rgba(16,24,40,0.08)]`}
              >
                <div className="p-6">
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white/70 text-2xl shadow-sm">
                      {item.icon}
                    </span>
                    <h3 className="text-lg font-semibold tracking-tight text-neutral-950">{item.title}</h3>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-neutral-600">{item.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <Card variant="elevated" className="overflow-hidden border-white/70 bg-white/92 shadow-[0_22px_60px_rgba(16,24,40,0.08)]">
            <div className="grid gap-0 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="bg-[linear-gradient(180deg,rgba(6,78,59,0.95),rgba(12,99,73,0.92))] p-8 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-100/80">How it helps</div>
                <h2 className="mt-3 text-3xl font-semibold tracking-tight">Clear outcomes for every farm decision.</h2>
                <p className="mt-4 text-white/84">
                  Crop losses, bad pricing, and weather surprises are easier to handle when the page tells a cleaner story.
                </p>
                <div className="mt-6 flex flex-wrap gap-2">
                  <Badge variant="success" dot className="border-white/15 bg-white/10 text-white">
                    Loss prevention
                  </Badge>
                  <Badge variant="warning" dot className="border-white/15 bg-white/10 text-white">
                    Market timing
                  </Badge>
                  <Badge variant="info" dot className="border-white/15 bg-white/10 text-white">
                    Weather alerts
                  </Badge>
                </div>
              </div>

              <div className="p-8">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="flex gap-4 rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✓</div>
                    <div>
                      <h3 className="font-semibold text-neutral-950">{t('preventLosses')}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">{t('preventLossesDesc')}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-lime-100 text-2xl text-lime-700">✓</div>
                    <div>
                      <h3 className="font-semibold text-neutral-950">{t('maximizeProfits')}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">{t('maximizeProfitsDesc')}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-2xl text-amber-700">✓</div>
                    <div>
                      <h3 className="font-semibold text-neutral-950">{t('reduceWeatherRisks')}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">{t('reduceWeatherRisksDesc')}</p>
                    </div>
                  </div>

                  <div className="flex gap-4 rounded-3xl border border-neutral-100 bg-neutral-50 p-5">
                    <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-yellow-100 text-2xl text-yellow-700">✓</div>
                    <div>
                      <h3 className="font-semibold text-neutral-950">{t('improveSoilHealth')}</h3>
                      <p className="mt-2 text-sm leading-6 text-neutral-600">{t('improveSoilHealthDesc')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-4">
          <CentralChat />
        </section>
      </main>
    </div>
  );
}
