import { Home, Play, RotateCcw, Settings, Share2 } from 'lucide-react';

interface PauseModalProps {
  open: boolean;
  onResume: () => void;
  onRestart: () => void;
  onOpenSettings: () => void;
  onOpenShare: () => void;
  onReturnMenu: () => void;
}

export function PauseModal({
  open,
  onResume,
  onRestart,
  onOpenSettings,
  onOpenShare,
  onReturnMenu,
}: PauseModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#0E131D] p-6 shadow-2xl">
        <div className="text-xs font-semibold uppercase tracking-widest text-amber-400">Game Paused</div>
        <h2 className="font-display text-2xl font-bold text-white mt-1">NIGHTFALL</h2>

        <div className="mt-6 space-y-2.5">
          <button
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 transition-colors"
          >
            <Play className="w-4 h-4 fill-current" />
            Resume Game
          </button>
          <button
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-sky-400" />
            Restart Mission
          </button>
          <button
            onClick={onOpenShare}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Share2 className="w-4 h-4 text-amber-400" />
            Share Mission & Preview
          </button>
          <button
            onClick={onOpenSettings}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-slate-900 py-2.5 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            Settings
          </button>
          <button
            onClick={onReturnMenu}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-950/30 py-2.5 text-sm font-medium text-rose-200 hover:bg-rose-950/60 transition-colors"
          >
            <Home className="w-4 h-4" />
            Return to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
}
