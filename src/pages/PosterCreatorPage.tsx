import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Sparkles, Upload, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { apiRequest } from '../services/api';
import type { Product, SupportedCurrency } from '../types';
import { formatCurrency } from '../utils/format';
import { StudioImage } from '../components/StudioImage';

const STUDIO_SAMPLE_IMAGES = [
  { label: 'Dark Basalt Plinth', url: './src/assets/images/studio_poster_backdrop_1795511632445.jpg' },
  { label: 'Titanium Watch', url: './src/assets/images/demo_luxury_watch_1795511633549.jpg' },
  { label: 'Cognac Leather Tote', url: './src/assets/images/demo_leather_tote_1795504837446.jpg' },
];

interface PosterFormat {
  id: string;
  label: string;
  width: number;
  height: number;
  aspectRatio: '1:1' | '9:16' | '16:9';
}

const POSTER_FORMATS: PosterFormat[] = [
  { id: 'ig_post', label: 'Instagram Post (1080×1080)', width: 1080, height: 1080, aspectRatio: '1:1' },
  { id: 'ig_story', label: 'Instagram Story (1080×1920)', width: 1080, height: 1920, aspectRatio: '9:16' },
  { id: 'fb_post', label: 'Facebook Post (1200×630)', width: 1200, height: 630, aspectRatio: '16:9' },
  { id: 'wa_status', label: 'WhatsApp Status (1080×1920)', width: 1080, height: 1920, aspectRatio: '9:16' },
  { id: 'tiktok', label: 'TikTok Graphic (1080×1920)', width: 1080, height: 1920, aspectRatio: '9:16' },
];

const TEMPLATES = [
  { id: 'navy_spotlight', label: 'Navy Executive Spotlight', bg: '#071426', card: '#12243D', accent: '#287BFF', text: '#FFFFFF' },
  { id: 'cyan_pulse', label: 'Electric Cyan Studio', bg: '#0A192F', card: '#0D1B30', accent: '#22D3EE', text: '#FFFFFF' },
  { id: 'minimal_ivory', label: 'Minimalist Editorial Ivory', bg: '#F8FAFC', card: '#FFFFFF', accent: '#0F172A', text: '#0F172A' },
  { id: 'flash_amber', label: 'Bold Promo Amber', bg: '#111827', card: '#1F2937', accent: '#F59E0B', text: '#FFFFFF' },
];

export const PosterCreatorPage: React.FC = () => {
  const { business } = useAuth();
  const { showToast } = useToast();
  const currency = (business?.currency || 'USD') as SupportedCurrency;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const [format, setFormat] = useState<PosterFormat>(POSTER_FORMATS[0]);
  const [templateId, setTemplateId] = useState(TEMPLATES[0].id);
  const [bgColor, setBgColor] = useState(TEMPLATES[0].bg);
  const [accentColor, setAccentColor] = useState(TEMPLATES[0].accent);
  const [textColor, setTextColor] = useState(TEMPLATES[0].text);
  const [textPosition, setTextPosition] = useState<'top' | 'bottom'>('bottom');

  const [headline, setHeadline] = useState('NEW ARRIVAL');
  const [subtext, setSubtext] = useState('Crafted for everyday performance & timeless style');
  const [priceLabel, setPriceLabel] = useState(formatCurrency(149, currency));
  const [bizName, setBizName] = useState(business?.name || 'SellSmart Store');
  const [contactLine, setContactLine] = useState(business?.phone || business?.email || 'Order online today');
  const [productImageUrl, setProductImageUrl] = useState('');

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [isAiGeneratedImage, setIsAiGeneratedImage] = useState(false);

  useEffect(() => {
    apiRequest<Product[]>('/api/products')
      .then((list) => {
        setProducts(list);
        if (list[0]) {
          setHeadline(list[0].name.toUpperCase());
          setPriceLabel(formatCurrency(list[0].sellingPrice, currency));
          if (list[0].imageUrl) setProductImageUrl(list[0].imageUrl);
        }
      })
      .catch(() => undefined);
  }, [currency]);

  const applyTemplate = (tplId: string) => {
    const tpl = TEMPLATES.find((t) => t.id === tplId) || TEMPLATES[0];
    setTemplateId(tpl.id);
    setBgColor(tpl.bg);
    setAccentColor(tpl.accent);
    setTextColor(tpl.text);
  };

  const renderCanvas = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = format.width;
    const H = format.height;
    canvas.width = W;
    canvas.height = H;

    // Background fill
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow
    const grad = ctx.createRadialGradient(W * 0.5, H * 0.4, 40, W * 0.5, H * 0.4, Math.max(W, H) * 0.65);
    grad.addColorStop(0, `${accentColor}30`);
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Load product image if provided
    if (productImageUrl) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const pad = Math.round(W * 0.08);
          const isLandscape = W > H;
          const imgBoxW = isLandscape ? W * 0.44 : W - pad * 2;
          const imgBoxH = isLandscape ? H - pad * 2 : H * 0.48;
          const imgX = isLandscape ? W - imgBoxW - pad : pad;
          const imgY = isLandscape ? pad : textPosition === 'top' ? H - imgBoxH - pad * 1.4 : pad * 1.3;

          ctx.save();
          const r = 32;
          ctx.beginPath();
          ctx.moveTo(imgX + r, imgY);
          ctx.arcTo(imgX + imgBoxW, imgY, imgX + imgBoxW, imgY + imgBoxH, r);
          ctx.arcTo(imgX + imgBoxW, imgY + imgBoxH, imgX, imgY + imgBoxH, r);
          ctx.arcTo(imgX, imgY + imgBoxH, imgX, imgY, r);
          ctx.arcTo(imgX, imgY, imgX + imgBoxW, imgY, r);
          ctx.closePath();
          ctx.clip();

          const scale = Math.max(imgBoxW / img.width, imgBoxH / img.height);
          const drawW = img.width * scale;
          const drawH = img.height * scale;
          ctx.drawImage(img, imgX + (imgBoxW - drawW) / 2, imgY + (imgBoxH - drawH) / 2, drawW, drawH);
          ctx.restore();
          resolve();
        };
        img.onerror = () => resolve();
        img.src = productImageUrl;
      });
    }

    const pad = Math.round(W * 0.08);
    const isLandscape = W > H;
    const contentWidth = isLandscape && productImageUrl ? W * 0.44 : W - pad * 2;

    // Top business wordmark
    ctx.fillStyle = textColor;
    ctx.font = `700 ${Math.round(W * 0.03)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillText(bizName.toUpperCase(), pad, pad * 0.9);

    // Price badge rectangle
    const textStartY = isLandscape
      ? H * 0.3
      : textPosition === 'top'
      ? pad * 1.7
      : H * 0.64;

    if (priceLabel.trim()) {
      ctx.font = `700 ${Math.round(W * 0.036)}px "JetBrains Mono", monospace`;
      const tw = ctx.measureText(priceLabel).width;
      const bw = tw + 48;
      const bh = Math.round(W * 0.068);
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.roundRect(pad, textStartY, bw, bh, 14);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(priceLabel, pad + 24, textStartY + bh * 0.68);
    }

    // Headline with word-wrap
    ctx.fillStyle = textColor;
    const headSize = Math.round(W * (isLandscape ? 0.048 : 0.062));
    ctx.font = `800 ${headSize}px "Plus Jakarta Sans", sans-serif`;
    const words = headline.split(' ');
    let line = '';
    let yCursor = textStartY + Math.round(W * 0.13);
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > contentWidth && line) {
        ctx.fillText(line, pad, yCursor);
        line = w;
        yCursor += headSize * 1.15;
      } else {
        line = test;
      }
    }
    if (line) {
      ctx.fillText(line, pad, yCursor);
      yCursor += headSize * 0.85;
    }

    // Subheadline
    ctx.fillStyle = textColor === '#FFFFFF' ? '#A7B4C7' : '#475569';
    const subSize = Math.round(W * (isLandscape ? 0.022 : 0.03));
    ctx.font = `400 ${subSize}px "DM Sans", sans-serif`;
    const subWords = subtext.split(' ');
    let subLine = '';
    for (const w of subWords) {
      const test = subLine ? `${subLine} ${w}` : w;
      if (ctx.measureText(test).width > contentWidth && subLine) {
        ctx.fillText(subLine, pad, yCursor);
        subLine = w;
        yCursor += subSize * 1.35;
      } else {
        subLine = test;
      }
    }
    if (subLine) ctx.fillText(subLine, pad, yCursor);

    // Bottom contact strip
    ctx.fillStyle = accentColor;
    ctx.fillRect(pad, H - pad * 0.9, 48, 4);
    ctx.fillStyle = textColor;
    ctx.font = `600 ${Math.round(W * 0.024)}px "DM Sans", sans-serif`;
    ctx.fillText(contactLine, pad, H - pad * 0.48);
  }, [format, bgColor, accentColor, textColor, textPosition, headline, subtext, priceLabel, bizName, contactLine, productImageUrl]);

  useEffect(() => {
    void renderCanvas();
  }, [renderCanvas]);

  const handleUploadPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) {
      showToast('Select a valid image file.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setProductImageUrl(reader.result);
        setIsAiGeneratedImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAiGenerateImage = async () => {
    if (!aiPrompt.trim()) {
      showToast('Enter a visual description for AI image generation.', 'error');
      return;
    }
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await apiRequest<{ imageDataUrl: string }>('/api/ai/poster-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: aiPrompt,
          aspectRatio: format.aspectRatio,
        }),
      });
      setProductImageUrl(res.imageDataUrl);
      setIsAiGeneratedImage(true);
      showToast('AI poster visual generated.', 'success');
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'AI image generation unavailable.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleDownloadPoster = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(headline || 'sellsmart-poster').toLowerCase().replace(/\s+/g, '-')}-${format.id}.png`;
    a.click();
    showToast('High-resolution poster downloaded.', 'success');
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
      {/* Studio Controls */}
      <div className="xl:col-span-5 surface-panel p-5 sm:p-6 space-y-4 h-fit">
        <div className="pb-3 border-b border-slate-100 dark:border-white/[0.07]">
          <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">Poster Studio Controls</h2>
          <p className="text-xs text-slate-500 dark:text-[#A7B4C7] mt-0.5">
            Design ready-to-publish graphics for Instagram, WhatsApp Status, Facebook, and TikTok.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Dimensions</label>
            <select
              value={format.id}
              onChange={(e) => setFormat(POSTER_FORMATS.find((f) => f.id === e.target.value) || POSTER_FORMATS[0])}
              className="input-field min-h-[40px] px-3 text-xs"
            >
              {POSTER_FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Template</label>
            <select
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
              className="input-field min-h-[40px] px-3 text-xs"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Background</label>
            <input
              type="color"
              value={bgColor}
              onChange={(e) => setBgColor(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-transparent cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Accent</label>
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-full h-10 rounded-xl border border-slate-200 dark:border-white/[0.12] bg-transparent cursor-pointer"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Text Position</label>
            <select
              value={textPosition}
              onChange={(e) => setTextPosition(e.target.value as 'top' | 'bottom')}
              className="input-field h-10 px-2 text-xs"
            >
              <option value="bottom">Bottom</option>
              <option value="top">Top</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Headline</label>
          <input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            className="input-field min-h-[40px] px-3"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Promotional Subtext</label>
          <input
            value={subtext}
            onChange={(e) => setSubtext(e.target.value)}
            className="input-field min-h-[40px] px-3"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Price Badge</label>
            <input
              value={priceLabel}
              onChange={(e) => setPriceLabel(e.target.value)}
              className="input-field min-h-[40px] px-3 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Business Name</label>
            <input
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              className="input-field min-h-[40px] px-3 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7] mb-1">Contact Line</label>
            <input
              value={contactLine}
              onChange={(e) => setContactLine(e.target.value)}
              className="input-field min-h-[40px] px-3 text-xs"
            />
          </div>
        </div>

        {/* Product Image Picker & Studio Backdrops */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] space-y-3">
          <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">
            Product Photograph & Studio Scenes
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="surface-well min-h-[38px] px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-white cursor-pointer flex items-center gap-1.5 hover:border-[#287BFF]/50 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Photo</span>
              <input type="file" accept="image/*" onChange={handleUploadPhoto} className="hidden" />
            </label>
            {products.some((p) => p.imageUrl) && (
              <select
                onChange={(e) => {
                  const p = products.find((x) => x.id === e.target.value);
                  if (p) {
                    setHeadline(p.name.toUpperCase());
                    setPriceLabel(formatCurrency(p.sellingPrice, currency));
                    if (p.imageUrl) setProductImageUrl(p.imageUrl);
                    setIsAiGeneratedImage(false);
                  }
                }}
                className="input-field !w-auto min-h-[38px] px-2.5 text-xs"
              >
                <option value="">Pick inventory product...</option>
                {products
                  .filter((p) => p.imageUrl)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {STUDIO_SAMPLE_IMAGES.map((sample) => (
              <button
                key={sample.url}
                type="button"
                onClick={() => {
                  setProductImageUrl(sample.url);
                  setIsAiGeneratedImage(false);
                }}
                className={`group text-left rounded-xl p-1 border transition-all ${
                  productImageUrl === sample.url
                    ? 'border-[#287BFF] dark:border-[#22D3EE] bg-[#287BFF]/10'
                    : 'border-slate-200/80 dark:border-white/[0.08] hover:border-[#287BFF]/40'
                }`}
              >
                <div className="aspect-[16/10] w-full rounded-lg overflow-hidden">
                  <StudioImage
                    src={sample.url}
                    alt={sample.label}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    fallbackClassName="w-full h-full bg-[#0A172B]"
                  />
                </div>
                <p className="text-[10px] font-medium text-slate-600 dark:text-[#A7B4C7] truncate px-1 pt-1">
                  {sample.label}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Optional AI Visual Generator */}
        <div className="pt-3 border-t border-slate-100 dark:border-white/[0.08] space-y-2">
          <label className="block text-xs font-medium text-slate-500 dark:text-[#A7B4C7]">
            AI Image Generator (Requires billing-enabled Gemini API key)
          </label>
          <div className="flex gap-2">
            <input
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g., Luxury studio backdrop for leather handbag..."
              className="input-field flex-1 min-h-[40px] px-3 text-xs"
            />
            <button
              type="button"
              disabled={aiGenerating}
              onClick={() => void handleAiGenerateImage()}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#22D3EE]/30 bg-[#22D3EE]/12 text-[#22D3EE] hover:bg-[#22D3EE]/22 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{aiGenerating ? 'Generating...' : 'Generate AI'}</span>
            </button>
          </div>
          {aiError && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-950/60 p-3 flex items-start gap-2 text-xs text-rose-200">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}
        </div>
      </div>

      {/* Live Canvas Preview */}
      <div className="xl:col-span-7 surface-panel p-5 sm:p-6 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 mb-4 border-b border-slate-100 dark:border-white/[0.07]">
          <div>
            <h2 className="font-display font-bold text-base text-slate-900 dark:text-white">Live Poster Preview</h2>
            <p className="text-xs text-slate-500 dark:text-[#A7B4C7] mt-0.5">
              {format.label} · {isAiGeneratedImage ? 'AI-generated visual layer' : 'Studio template composition'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadPoster}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#287BFF] to-[#1D68E6] hover:brightness-110 text-xs font-semibold text-white flex items-center gap-2 shadow-[0_8px_20px_-6px_rgba(40,123,255,0.55)]"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>
        </div>

        <div className="flex-1 flex items-center justify-center surface-well p-5 min-h-[460px] bg-[radial-gradient(circle_at_center,rgba(40,123,255,0.08),transparent_70%)]">
          {!productImageUrl && !headline ? (
            <div className="text-center text-xs text-slate-500">
              <ImageIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Configure your poster details on the left.
            </div>
          ) : (
            <div className="surface-frame p-2">
              <canvas
                ref={canvasRef}
                className="max-w-full max-h-[580px] w-auto h-auto rounded-lg shadow-2xl"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
