import { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Eye,
  Flame,
  Heart,
  Pause,
  RotateCcw,
  Share2,
  Shield,
  Sparkles,
  Swords,
  Zap,
} from 'lucide-react';
import { WEAPONS } from '../game/data/gameCatalog';
import type { GameHudSnapshot, GameSettings, WeaponId } from '../game/types';

interface InGameHudProps {
  hud: GameHudSnapshot;
  playerName: string;
  playerLevel: number;
  equippedWeapon: WeaponId;
  settings: GameSettings;
  onPause: () => void;
  onToggleCamera: () => void;
  onVirtualJoystick: (x: number, y: number) => void;
  onTouchLook: (dx: number, dy: number) => void;
  onAttack: () => void;
  onDodge: () => void;
  onJump: () => void;
  onFlare: () => void;
  onHeal: () => void;
  onInteract: () => void;
  onSolvePuzzle: () => void;
  onCancelPuzzle: () => void;
  onRestartMission: () => void;
  onReturnMenu: () => void;
  onShareMission: () => void;
}

export function InGameHud({
  hud,
  playerName,
  playerLevel,
  equippedWeapon,
  settings,
  onPause,
  onToggleCamera,
  onVirtualJoystick,
  onTouchLook,
  onAttack,
  onDodge,
  onJump,
  onFlare,
  onHeal,
  onInteract,
  onSolvePuzzle,
  onCancelPuzzle,
  onRestartMission,
  onReturnMenu,
  onShareMission,
}: InGameHudProps) {
  const radarRef = useRef<HTMLCanvasElement>(null);
  const weapon = WEAPONS.find((w) => w.id === equippedWeapon) ?? WEAPONS[0];

  // Touch detection + settings override
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);
  const showTouch =
    settings.showTouchControls === 'always' || (settings.showTouchControls === 'auto' && isTouchDevice);

  // Virtual Joystick state
  const joyBaseRef = useRef<HTMLDivElement>(null);
  const [joyKnob, setJoyKnob] = useState({ x: 0, y: 0 });
  const joyPointerId = useRef<number | null>(null);
  const lookPointerId = useRef<number | null>(null);
  const lastLookPos = useRef({ x: 0, y: 0 });

  // Interactive Puzzle States
  const [circuitAngles, setCircuitAngles] = useState([90, 180, 90, 270]);
  const [runeOrder, setRuneOrder] = useState<number[]>([]);

  useEffect(() => {
    if (hud.activePuzzle?.type === 'circuit') {
      setCircuitAngles([90, 180, 90, 270]);
    } else if (hud.activePuzzle?.type === 'runes') {
      setRuneOrder([]);
    }
  }, [hud.activePuzzle?.id, hud.activePuzzle?.type]);

  // Draw real-time Radar Mini-Map
  useEffect(() => {
    const canvas = radarRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 4;

    ctx.clearRect(0, 0, w, h);

    // Radar background
    ctx.fillStyle = 'rgba(9, 13, 22, 0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();

    // Rings
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
    ctx.lineWidth = 1;
    [0.35, 0.7, 1].forEach((scale) => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Forward view cone
    ctx.fillStyle = 'rgba(245, 158, 11, 0.12)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, -Math.PI * 0.72, -Math.PI * 0.28);
    ctx.closePath();
    ctx.fill();

    // Blips
    for (const b of hud.radarBlips) {
      const bx = cx + b.x * r;
      const by = cy + b.z * r;
      ctx.beginPath();
      ctx.arc(bx, by, b.kind === 'boss' ? 4.5 : 3.2, 0, Math.PI * 2);
      if (b.kind === 'boss') ctx.fillStyle = '#F43F5E';
      else if (b.kind === 'monster') ctx.fillStyle = '#EF4444';
      else if (b.kind === 'survivor') ctx.fillStyle = '#38BDF8';
      else if (b.kind === 'supply') ctx.fillStyle = '#10B981';
      else ctx.fillStyle = '#F59E0B';
      ctx.fill();
    }

    // Player center marker
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }, [hud.radarBlips]);

  const hpPct = Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100));
  const enPct = Math.max(0, Math.min(100, (hud.energy / hud.maxEnergy) * 100));

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP BAR: Health/Energy (Left) | Boss Bar (Center) | Mini-Map & Pause (Right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Hunter Status & Equipment */}
        <div className="pointer-events-auto w-64 sm:w-72 rounded-xl border border-white/10 bg-[#0B0F17]/90 p-3.5 shadow-2xl">
          <div className="flex items-center justify-between text-xs text-slate-300 mb-2">
            <span className="font-semibold text-white truncate max-w-[150px]">{playerName}</span>
            <span className="font-mono-tabular text-amber-400">LV {playerLevel}</span>
          </div>

          {/* Health */}
          <div className="space-y-1 mb-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <Heart className="w-3.5 h-3.5 text-rose-400" /> Health
              </span>
              <span className="font-mono-tabular">
                {hud.health} / {hud.maxHealth}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-600 to-rose-400 transition-all duration-150"
                style={{ width: `${hpPct}%` }}
              />
            </div>
          </div>

          {/* Energy */}
          <div className="space-y-1 mb-3">
            <div className="flex items-center justify-between text-[11px] text-slate-300">
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-sky-400" /> Energy
              </span>
              <span className="font-mono-tabular">
                {hud.energy} / {hud.maxEnergy}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-sky-600 to-sky-400 transition-all duration-150"
                style={{ width: `${enPct}%` }}
              />
            </div>
          </div>

          {/* Equipped Weapon & Ability Status */}
          <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px]">
            <div className="flex items-center gap-1.5 text-amber-300 font-medium truncate">
              <Swords className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{weapon.name}</span>
            </div>
            <div className="flex items-center gap-2 font-mono-tabular text-slate-300 shrink-0">
              <button
                onClick={onFlare}
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-amber-300"
                title="Lantern Flare [F]"
              >
                <Flame className="w-3 h-3 inline mr-0.5" />
                {hud.flareCooldown > 0 ? `${hud.flareCooldown}s` : 'F'}
              </button>
              <button
                onClick={onHeal}
                className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-emerald-300"
                title="Med-Injector [R]"
              >
                +{hud.healCharges}
              </button>
            </div>
          </div>
        </div>

        {/* Top-Center: Boss Bar & Transient Banner */}
        <div className="flex-1 max-w-md flex flex-col items-center gap-2 pt-1">
          {hud.bossInfo && (
            <div className="w-full rounded-xl border border-rose-500/30 bg-[#0B0F17]/90 px-4 py-2.5 shadow-xl">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="font-display font-semibold text-rose-200 tracking-wide">
                  {hud.bossInfo.name}
                </span>
                <span className="font-mono-tabular text-rose-300">
                  {hud.bossInfo.health} / {hud.bossInfo.maxHealth}
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-rose-700 via-red-500 to-amber-500 transition-all duration-150"
                  style={{ width: `${Math.max(0, (hud.bossInfo.health / hud.bossInfo.maxHealth) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {hud.bannerMessage && (
            <div className="rounded-lg border border-amber-500/30 bg-[#0B0F17]/90 px-4 py-2 text-xs sm:text-sm font-medium text-amber-200 shadow-lg text-center">
              {hud.bannerMessage}
            </div>
          )}
        </div>

        {/* Top-Right: Radar Mini-Map & Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleCamera}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B0F17]/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
              title="Toggle First/Third Person Camera [V]"
            >
              <Eye className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">
                {hud.cameraMode === 'first_person' ? '1st Person' : '3rd Person'}
              </span>
            </button>
            <button
              onClick={onPause}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0B0F17]/90 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors whitespace-nowrap"
              title="Pause [Esc]"
            >
              <Pause className="w-3.5 h-3.5 text-amber-400" />
              <span>Pause</span>
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#0B0F17]/90 p-2 shadow-xl flex flex-col items-center">
            <canvas ref={radarRef} width={108} height={108} className="rounded-full" />
            <div className="mt-1.5 flex items-center gap-3 text-[10px] font-mono-tabular text-slate-400">
              <span>{formatTime(hud.elapsedSeconds)}</span>
              <span>·</span>
              <span>{hud.killsThisRun} KILLS</span>
            </div>
          </div>
        </div>
      </div>

      {/* MIDDLE LEFT: Compact Mission Objectives */}
      <div className="my-auto max-w-[260px]">
        <div className="rounded-xl border border-white/10 bg-[#0B0F17]/85 p-3 shadow-lg">
          <div className="text-[11px] font-semibold tracking-wider text-amber-400 uppercase mb-2">
            Mission Objectives
          </div>
          <ul className="space-y-1.5">
            {hud.objectives.map((obj) => (
              <li
                key={obj.id}
                className={`flex items-center justify-between gap-2 text-xs ${
                  obj.completed ? 'text-emerald-400 line-through opacity-75' : 'text-slate-200'
                }`}
              >
                <span className="truncate">{obj.label}</span>
                {obj.target < 999 && (
                  <span className="font-mono-tabular shrink-0 text-[11px] text-slate-400">
                    {obj.current}/{obj.target}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {hud.nearestThreatDist !== null && hud.nearestThreatDist < 22 && (
            <div className="mt-2 pt-2 border-t border-white/10 text-[11px] font-mono-tabular text-rose-400">
              Threat Proximity: {hud.nearestThreatDist}m
            </div>
          )}
        </div>
      </div>

      {/* CENTER CROSSHAIR (First-Person) */}
      {hud.cameraMode === 'first_person' && !hud.activePuzzle && !hud.outcome && (
        <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
          <Crosshair className="w-5 h-5 text-amber-300/70" />
        </div>
      )}

      {/* BOTTOM AREA: Interact Prompt + Desktop Hints OR Mobile Virtual Controls */}
      <div className="flex flex-col items-center gap-2">
        {hud.interactPrompt && (
          <button
            onClick={onInteract}
            className="pointer-events-auto rounded-lg border border-amber-400/50 bg-[#0B0F17]/95 px-4 py-2 text-xs sm:text-sm font-semibold text-amber-300 shadow-xl hover:bg-amber-500/20 transition-colors"
          >
            Press <span className="font-mono-tabular text-white">[E]</span> · {hud.interactPrompt}
          </button>
        )}

        {!showTouch && (
          <div className="rounded-lg border border-white/10 bg-[#0B0F17]/80 px-4 py-1.5 text-[11px] text-slate-300 hidden sm:flex items-center gap-3">
            <span>WASD Move</span>
            <span aria-hidden="true">·</span>
            <span>Mouse Look & Attack</span>
            <span aria-hidden="true">·</span>
            <span>Space Jump</span>
            <span aria-hidden="true">·</span>
            <span>Shift Sprint</span>
            <span aria-hidden="true">·</span>
            <span>Q Dodge</span>
            <span aria-hidden="true">·</span>
            <span>F Flare</span>
            <span aria-hidden="true">·</span>
            <span>E Interact</span>
            <span aria-hidden="true">·</span>
            <span>V View</span>
          </div>
        )}
      </div>

      {/* MOBILE / TOUCH CONTROLS */}
      {showTouch && !hud.outcome && !hud.activePuzzle && (
        <div className="pointer-events-none fixed inset-0 z-20 flex items-end justify-between p-4 pb-6">
          {/* Left Virtual Joystick */}
          <div
            ref={joyBaseRef}
            onPointerDown={(e) => {
              e.stopPropagation();
              joyPointerId.current = e.pointerId;
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (joyPointerId.current !== e.pointerId || !joyBaseRef.current) return;
              const rect = joyBaseRef.current.getBoundingClientRect();
              const cx = rect.left + rect.width / 2;
              const cy = rect.top + rect.height / 2;
              const maxR = rect.width / 2 - 14;
              const dx = e.clientX - cx;
              const dy = e.clientY - cy;
              const dist = Math.hypot(dx, dy);
              const clamped = Math.min(maxR, dist);
              const nx = dist > 0 ? (dx / dist) * (clamped / maxR) : 0;
              const ny = dist > 0 ? (dy / dist) * (clamped / maxR) : 0;
              setJoyKnob({ x: nx * maxR, y: ny * maxR });
              onVirtualJoystick(nx, ny);
            }}
            onPointerUp={(e) => {
              if (joyPointerId.current === e.pointerId) {
                joyPointerId.current = null;
                setJoyKnob({ x: 0, y: 0 });
                onVirtualJoystick(0, 0);
              }
            }}
            onPointerCancel={() => {
              joyPointerId.current = null;
              setJoyKnob({ x: 0, y: 0 });
              onVirtualJoystick(0, 0);
            }}
            className="pointer-events-auto relative w-32 h-32 rounded-full border border-white/20 bg-black/50 touch-none flex items-center justify-center"
          >
            <div
              className="w-12 h-12 rounded-full bg-amber-500/80 border border-amber-200/60 shadow-lg"
              style={{ transform: `translate(${joyKnob.x}px, ${joyKnob.y}px)` }}
            />
          </div>

          {/* Right Look Pad (transparent upper-right drag area) + Action Buttons */}
          <div className="flex flex-col items-end gap-3">
            <div
              onPointerDown={(e) => {
                lookPointerId.current = e.pointerId;
                lastLookPos.current = { x: e.clientX, y: e.clientY };
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              }}
              onPointerMove={(e) => {
                if (lookPointerId.current !== e.pointerId) return;
                const dx = e.clientX - lastLookPos.current.x;
                const dy = e.clientY - lastLookPos.current.y;
                lastLookPos.current = { x: e.clientX, y: e.clientY };
                onTouchLook(dx, dy);
              }}
              onPointerUp={() => {
                lookPointerId.current = null;
              }}
              className="pointer-events-auto w-44 h-24 rounded-xl border border-white/10 bg-black/25 flex items-center justify-center text-[11px] text-slate-300 touch-none"
            >
              Drag to Look
            </div>

            <div className="pointer-events-auto grid grid-cols-3 gap-2">
              {hud.interactPrompt && (
                <button
                  onClick={onInteract}
                  className="col-span-3 h-11 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs shadow-lg"
                >
                  Interact
                </button>
              )}
              <button
                onClick={onFlare}
                className="w-14 h-14 rounded-full border border-amber-400/50 bg-[#0B0F17]/90 text-amber-300 text-[11px] font-semibold flex flex-col items-center justify-center"
              >
                <Flame className="w-4 h-4" />
                Flare
              </button>
              <button
                onClick={onDodge}
                className="w-14 h-14 rounded-full border border-sky-400/50 bg-[#0B0F17]/90 text-sky-300 text-[11px] font-semibold flex flex-col items-center justify-center"
              >
                <Shield className="w-4 h-4" />
                Dodge
              </button>
              <button
                onClick={onJump}
                className="w-14 h-14 rounded-full border border-white/20 bg-[#0B0F17]/90 text-slate-200 text-[11px] font-semibold"
              >
                Jump
              </button>
              <button
                onClick={onHeal}
                className="w-14 h-14 rounded-full border border-emerald-400/50 bg-[#0B0F17]/90 text-emerald-300 text-[11px] font-semibold"
              >
                Heal ({hud.healCharges})
              </button>
              <button
                onClick={onAttack}
                className="col-span-2 h-14 rounded-full bg-amber-500 active:bg-amber-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-1.5 shadow-xl"
              >
                <Swords className="w-4 h-4" />
                Attack
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IN-GAME PUZZLE MODAL */}
      {hud.activePuzzle && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0F141E] p-6 shadow-2xl">
            <h3 className="font-display text-xl font-bold text-amber-300">{hud.activePuzzle.title}</h3>
            <p className="mt-1 text-sm text-slate-300">{hud.activePuzzle.subtitle}</p>

            {hud.activePuzzle.type === 'circuit' ? (
              <div className="mt-5">
                <div className="grid grid-cols-4 gap-3">
                  {circuitAngles.map((deg, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const next = [...circuitAngles];
                        next[idx] = (next[idx] + 90) % 360;
                        setCircuitAngles(next);
                        if (next.every((v) => v === 0)) {
                          setTimeout(onSolvePuzzle, 250);
                        }
                      }}
                      className={`h-20 rounded-xl border flex flex-col items-center justify-center transition-colors ${
                        deg === 0
                          ? 'border-emerald-400/70 bg-emerald-950/50 text-emerald-300'
                          : 'border-white/15 bg-slate-900 hover:bg-slate-800 text-amber-300'
                      }`}
                    >
                      <div
                        className="w-10 h-2 rounded-full bg-current transition-transform duration-150"
                        style={{ transform: `rotate(${deg}deg)` }}
                      />
                      <span className="mt-2 text-[10px] font-mono-tabular">
                        {deg === 0 ? 'LOCKED' : 'ROTATE'}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Rotate each conduit until all four bars align horizontally (LOCKED).
                </p>
              </div>
            ) : (
              <div className="mt-5">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { id: 1, label: 'I · Crescent' },
                    { id: 2, label: 'II · Half Moon' },
                    { id: 3, label: 'III · Eclipse' },
                  ].map((glyph) => {
                    const active = runeOrder.includes(glyph.id);
                    return (
                      <button
                        key={glyph.id}
                        onClick={() => {
                          if (active) return;
                          const expectedNext = runeOrder.length + 1;
                          if (glyph.id === expectedNext) {
                            const next = [...runeOrder, glyph.id];
                            setRuneOrder(next);
                            if (next.length === 3) {
                              setTimeout(onSolvePuzzle, 250);
                            }
                          } else {
                            setRuneOrder([]);
                          }
                        }}
                        className={`h-24 rounded-xl border flex flex-col items-center justify-center gap-2 transition-colors ${
                          active
                            ? 'border-sky-400 bg-sky-950/60 text-sky-200'
                            : 'border-white/15 bg-slate-900 hover:bg-slate-800 text-slate-200'
                        }`}
                      >
                        <Sparkles className="w-6 h-6" />
                        <span className="text-xs font-medium">{glyph.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Sequence: Crescent (I) → Half Moon (II) → Eclipse (III). Wrong order resets the seal.
                </p>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                onClick={onCancelPuzzle}
                className="px-4 py-2 rounded-lg border border-white/15 text-xs font-medium text-slate-300 hover:bg-white/5"
              >
                Step Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MISSION OUTCOME OVERLAY */}
      {hud.outcome && (
        <div className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#0F141E] p-6 sm:p-8 shadow-2xl">
            <div
              className={`text-xs font-semibold uppercase tracking-widest ${
                hud.outcome.victory ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {hud.outcome.victory ? 'Mission Accomplished' : 'Hunter Fallen'}
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-white mt-1">
              {hud.outcome.title}
            </h2>
            <p className="mt-2 text-sm text-slate-300">{hud.outcome.summary}</p>

            <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div className="text-[11px] text-slate-400">Silver Shards</div>
                <div className="font-mono-tabular text-lg font-bold text-amber-400">
                  +{hud.outcome.shardsEarned}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div className="text-[11px] text-slate-400">Experience</div>
                <div className="font-mono-tabular text-lg font-bold text-sky-400">
                  +{hud.outcome.xpEarned} XP
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div className="text-[11px] text-slate-400">Banished</div>
                <div className="font-mono-tabular text-lg font-bold text-white">{hud.outcome.kills}</div>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/70 p-3">
                <div className="text-[11px] text-slate-400">Clues & Rescues</div>
                <div className="font-mono-tabular text-lg font-bold text-emerald-400">
                  {hud.outcome.clues + hud.outcome.rescues}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={onShareMission}
                className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/10"
              >
                <Share2 className="w-4 h-4 text-amber-400" />
                Share Mission Link
              </button>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={onReturnMenu}
                  className="rounded-lg border border-white/15 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-white/5"
                >
                  Main Menu
                </button>
                <button
                  onClick={onRestartMission}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-5 py-2.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
                >
                  <RotateCcw className="w-4 h-4" />
                  Play Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
