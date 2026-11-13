import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, Globe, Link2, Share2, X } from 'lucide-react';
import { CHAPTERS, COVER_KEYART_URL } from '../game/data/gameCatalog';
import type { ChapterId, GameModeId, LinkPreviewData } from '../game/types';
import { fetchLinkPreview } from '../services/api';

interface LinkPreviewModalProps {
  open: boolean;
  defaultChapter: ChapterId;
  defaultMode: GameModeId;
  onClose: () => void;
  onLaunchFromLink?: (chapterId: ChapterId, mode: GameModeId) => void;
}

export function LinkPreviewModal({
  open,
  defaultChapter,
  defaultMode,
  onClose,
  onLaunchFromLink,
}: LinkPreviewModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const buildShareUrl = (chapter: ChapterId, mode: GameModeId) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://nightfall.game';
    return `${origin}/share?chapter=${chapter}&mode=${mode}`;
  };

  const loadPreview = async (targetUrl: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLinkPreview(targetUrl);
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate link preview.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const initialUrl = buildShareUrl(defaultChapter, defaultMode);
    setUrlInput(initialUrl);
    void loadPreview(initialUrl);
  }, [open, defaultChapter, defaultMode]);

  if (!open) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    void loadPreview(urlInput.trim());
  };

  const handleCopy = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(preview.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore clipboard permissions
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#0E131D] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <Share2 className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-xl font-bold text-white">Mission Share & Link Preview</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close link preview modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Mission Share Presets */}
        <div className="mt-4">
          <div className="text-xs font-medium text-slate-400 mb-2">Quick Share Presets</div>
          <div className="flex flex-wrap gap-2">
            {CHAPTERS.map((ch) => (
              <button
                key={ch.id}
                onClick={() => {
                  const link = buildShareUrl(ch.id, defaultMode);
                  setUrlInput(link);
                  void loadPreview(link);
                }}
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-amber-400/50 hover:text-amber-300 transition-colors"
              >
                Ch.{ch.number}: {ch.title}
              </button>
            ))}
          </div>
        </div>

        {/* URL Inspector Input */}
        <form onSubmit={handleSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Paste a NIGHTFALL mission link or external URL (https://...)"
              className="w-full rounded-lg border border-white/15 bg-slate-900 pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-60 whitespace-nowrap"
          >
            {loading ? 'Inspecting...' : 'Generate Preview'}
          </button>
        </form>

        {error && (
          <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/50 px-3.5 py-2 text-xs text-rose-200">
            {error}
          </div>
        )}

        {/* Rich Link Preview Card */}
        {preview && (
          <div className="mt-5 overflow-hidden rounded-xl border border-white/15 bg-[#090D15] shadow-xl">
            <div className="relative h-52 w-full bg-slate-900 overflow-hidden">
              <img
                src={preview.image || COVER_KEYART_URL}
                alt={preview.title}
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = COVER_KEYART_URL;
                }}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#090D15] via-transparent to-transparent" />
            </div>

            <div className="p-5">
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{preview.metaLine}</span>
                <span aria-hidden="true">·</span>
                <span className="text-slate-400 truncate">{preview.domain}</span>
              </div>
              <h3 className="font-display text-lg font-bold text-white mt-1.5">{preview.title}</h3>
              <p className="mt-1.5 text-sm text-slate-300 leading-relaxed">{preview.description}</p>
              <div className="mt-3 text-[11px] font-mono-tabular text-slate-500 truncate">{preview.url}</div>

              <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Link Copied' : 'Copy Share Link'}
                </button>

                <div className="flex items-center gap-2">
                  {preview.type === 'mission' && onLaunchFromLink && (
                    <button
                      onClick={() => {
                        try {
                          const parsed = new URL(preview.url);
                          const ch = (parsed.searchParams.get('chapter') || defaultChapter) as ChapterId;
                          const md = (parsed.searchParams.get('mode') || defaultMode) as GameModeId;
                          onLaunchFromLink(ch, md);
                          onClose();
                        } catch {
                          onLaunchFromLink(defaultChapter, defaultMode);
                          onClose();
                        }
                      }}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                    >
                      Launch Linked Mission
                    </button>
                  )}
                  {preview.type === 'external' && (
                    <a
                      href={preview.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-lg border border-white/15 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Visit Link
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
