import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Card, Button, Input } from '@/components/ui';
import { useI18n } from '@/lib/i18n';
import LanguageSelector from '@/components/LanguageSelector';
import { getLocaleForLanguage, speak } from '@/lib/voice';

type Message = { from: 'user' | 'bot'; text: string };

export default function ChatPage() {
  const { t, lang } = useI18n();
  const formatVisionResponse = (j: any) => {
    if (!j) return '';
    if (j.crop && !j.diagnosis) {
      return `Crop: ${j.crop} (${Math.round((j.confidence || 0) * 100)}% confidence)`;
    }
    if (j.diagnosis || j.symptoms || j.treatment) {
      const parts: string[] = [];
      if (j.crop) parts.push(`Crop: ${j.crop} (${Math.round((j.confidence || 0) * 100)}% confidence)`);
      if (j.diagnosis) parts.push(`Diagnosis: ${j.diagnosis}`);
      if (j.symptoms && j.symptoms.length) parts.push(`Symptoms: ${j.symptoms.join(', ')}`);
      if (j.treatment) {
        const tVal: any = j.treatment;
        if (tVal.immediateActions && tVal.immediateActions.length) parts.push(`Immediate: ${tVal.immediateActions.join('; ')}`);
        if (tVal.organicRemedies && tVal.organicRemedies.length) parts.push(`Organic: ${tVal.organicRemedies.join('; ')}`);
        if (tVal.futurePrevention && tVal.futurePrevention.length) parts.push(`Prevention: ${tVal.futurePrevention.join('; ')}`);
      }
      if (j.warnings && j.warnings.length) parts.push(`Warnings: ${j.warnings.join('; ')}`);
      return parts.filter(Boolean).join('\n\n');
    }
    if (j.reply) return j.reply;
    try { return JSON.stringify(j, null, 2); } catch (e) { return String(j); }
  };

  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [serviceWarning, setServiceWarning] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const recogRef = useRef<any>(null);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        const r = new SR();
        r.lang = getLocaleForLanguage(lang);
        r.onresult = (ev: any) => {
          const trans = ev.results[0][0].transcript;
          setText(trans);
          setListening(false);
        };
        r.onerror = () => setListening(false);
        r.onend = () => setListening(false);
        recogRef.current = r;
      }
    }
  }, [lang]);

  const startListen = () => {
    if (!recogRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }
    try {
      recogRef.current.lang = getLocaleForLanguage(lang);
      recogRef.current.start();
      setListening(true);
    } catch (e) {
      console.warn('Speech start error:', e);
    }
  };

  const handleSend = async () => {
    const m = text.trim();
    if (!m) return;
    setMessages((s) => [...s, { from: 'user', text: m }]);
    setText('');
    try {
      const wantsIdentification = imagePreview && /\b(name|which|identify|what)\b/i.test(m) && /\b(crop|plant|this)\b/i.test(m);
      if (wantsIdentification) {
        const payload: any = { message: m, language: lang };
        if (imagePreview?.startsWith('data:')) payload.image_base64 = imagePreview.split(',')[1];
        else if (imagePreview) payload.image_url = imagePreview;
        const { visionChat, chat } = await import('@/lib/api');
        const res = await visionChat(payload);
        if (res.error) {
          if (res.error.includes('404')) setServiceWarning('Vision service not available — falling back to text-only chat.');
          const fallbackMsg = `${payload.message}` + (payload.image_url ? `\n\nImage: ${payload.image_url}` : '');
          const r2 = await chat(fallbackMsg, lang);
          if (r2.error) throw new Error('vision chat failed and fallback failed');
          const botReply = r2.data?.reply || 'No reply';
          setMessages((s) => [...s, { from: 'bot', text: botReply }]);
          speak(botReply, lang);
          return;
        }
        const j = res.data as any;
        const reply = (j && (j.diagnosis || j.crop || j.reply)) ? formatVisionResponse(j) : (j?.reply || 'No reply');
        setMessages((s) => [...s, { from: 'bot', text: reply }]);
        speak(reply, lang);
      } else {
        const { chat } = await import('@/lib/api');
        const r = await chat(m, lang);
        if (r.error) throw new Error(r.error);
        const botReply = r.data?.reply || 'No reply';
        setMessages((s) => [...s, { from: 'bot', text: botReply }]);
        speak(botReply, lang);
      }
    } catch (e: any) {
      setMessages((s) => [...s, { from: 'bot', text: 'Error contacting AI assistant: ' + (e.message || e) }]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Navigation & Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl shadow-sm border border-neutral-200">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
              🏠 {t('home')}
            </Button>
            <h1 className="text-xl font-bold text-neutral-900">
              💬 {t('chat')}
            </h1>
          </div>
          <LanguageSelector />
        </div>

        {serviceWarning && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-sm">
            ⚠️ {serviceWarning}
          </div>
        )}

        {/* Chat History Box */}
        <Card variant="elevated" className="bg-white/95 backdrop-blur-sm p-6 mb-6 min-h-[400px] max-h-[600px] overflow-y-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-neutral-400 py-16">
              <span className="text-5xl block mb-2">🌾</span>
              <p className="font-medium text-neutral-600">{t('askAboutCropSuitability')}</p>
              <p className="text-xs text-neutral-400 mt-1">{t('askPlaceholder')}</p>
            </div>
          ) : (
            messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                  m.from === 'user' 
                    ? 'bg-green-600 text-white rounded-br-none shadow-md' 
                    : 'bg-neutral-100 text-neutral-800 border border-neutral-200 rounded-bl-none shadow-sm'
                }`}>
                  {m.text}
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Input Bar */}
        <div className="flex gap-2">
          <Input 
            value={text} 
            onChange={(e) => setText(e.target.value)} 
            onKeyPress={(e) => e.key === 'Enter' && handleSend()} 
            placeholder={t('askPlaceholder')} 
            className="flex-1 text-sm sm:text-base py-3"
          />
          <Button onClick={startListen} variant={listening ? 'danger' : 'ghost'} className={listening ? 'animate-pulse bg-red-100 text-red-700' : ''}>
            {listening ? `🎙️ ${t('listening')}` : '🎙️'}
          </Button>
          <Button onClick={handleSend} variant="primary">
            {t('send')}
          </Button>
        </div>
      </div>
    </div>
  );
}
