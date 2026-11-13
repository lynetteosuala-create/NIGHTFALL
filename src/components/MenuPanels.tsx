import {
  Award,
  Check,
  Compass,
  Crosshair,
  Flame,
  Lock,
  Play,
  Shield,
  Skull,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ACHIEVEMENTS,
  CHAPTERS,
  DAILY_CHALLENGES,
  HAIRSTYLES,
  MONSTERS,
  OUTFITS,
  WEAPONS,
} from '../game/data/gameCatalog';
import type {
  ChapterId,
  GameModeId,
  GameSettings,
  MissionLaunchConfig,
  MonsterCategoryId,
  PlayerSaveData,
} from '../game/types';
import { HunterPreviewCanvas } from './HunterPreviewCanvas';

interface GameModesPanelProps {
  save: PlayerSaveData;
  onLaunch: (cfg: MissionLaunchConfig) => void;
}

export function GameModesPanel({ save, onLaunch }: GameModesPanelProps) {
  const huntTargets: MonsterCategoryId[] = [
    'shadow_creature',
    'mutated_beast',
    'night_stalker',
    'underground_horror',
  ];

  return (
    <div className="space-y-8">
      {/* Story Chapters */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-white">Story Campaign</h2>
            <p className="text-sm text-slate-400">
              Five progressive horror chapters with environmental puzzles, survivor rescues, and boss encounters.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CHAPTERS.map((ch) => {
            const unlocked = save.unlockedChapters.includes(ch.id);
            const completed = save.completedChapters.includes(ch.id);
            return (
              <div
                key={ch.id}
                className="group rounded-xl border border-white/10 bg-[#0E131D] overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-36 w-full overflow-hidden bg-slate-900">
                    <img
                      src={ch.bannerImage}
                      alt={ch.title}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0E131D] via-black/30 to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-xs">
                      <span className="text-amber-300 font-medium">{ch.subtitle}</span>
                      <span className="text-slate-300">{ch.difficulty}</span>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-lg font-bold text-white">{ch.title}</h3>
                      {completed && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300 leading-relaxed">{ch.description}</p>
                    <ul className="mt-3 space-y-1 text-[11px] text-slate-400">
                      {ch.objectivesSummary.map((obj, idx) => (
                        <li key={idx}>· {obj}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="px-4 pb-4 pt-2 flex items-center justify-between border-t border-white/5">
                  <span className="text-xs font-mono-tabular text-amber-400">+{ch.rewardShards} Shards</span>
                  <button
                    disabled={!unlocked}
                    onClick={() => onLaunch({ mode: 'story', chapterId: ch.id })}
                    className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-colors ${
                      unlocked
                        ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {unlocked ? <Play className="w-3.5 h-3.5 fill-current" /> : <Lock className="w-3.5 h-3.5" />}
                    {unlocked ? 'Deploy' : 'Locked'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Special Game Modes */}
      <section>
        <h2 className="font-display text-2xl font-bold text-white mb-4">Special Operations & Modes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Survival Mode */}
          <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  Survival Mode
                </h3>
                <span className="font-mono-tabular text-xs text-slate-400">
                  Best Wave: {save.bestSurvivalWave}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-300">
                Hold out against escalating waves of monsters in rain-swept environments with periodic supply drops.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(['city', 'forest', 'citadel'] as ChapterId[]).map((cid) => (
                <button
                  key={cid}
                  onClick={() => onLaunch({ mode: 'survival', chapterId: cid })}
                  className="rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                >
                  Survive · {CHAPTERS.find((c) => c.id === cid)?.title}
                </button>
              ))}
            </div>
          </div>

          {/* Boss Battle */}
          <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Skull className="w-5 h-5 text-rose-400" />
                Boss Battle Arena
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Challenge Apex Bosses directly in high-stakes arena duels with multi-phase shockwave mechanics.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() =>
                  onLaunch({ mode: 'boss', chapterId: 'underground', bossTarget: 'boss_warden' })
                }
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500"
              >
                Fight Dread Warden
              </button>
              <button
                onClick={() =>
                  onLaunch({ mode: 'boss', chapterId: 'citadel', bossTarget: 'boss_sovereign' })
                }
                className="rounded-lg bg-rose-700 px-4 py-2 text-xs font-bold text-white hover:bg-rose-600"
              >
                Fight Eclipse Sovereign
              </button>
            </div>
          </div>

          {/* Monster Hunt */}
          <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Crosshair className="w-5 h-5 text-sky-400" />
                Monster Hunt Contracts
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Select a high-threat creature category to track via radar and eliminate for Silver Shard bounties.
              </p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {huntTargets.map((tid) => (
                <button
                  key={tid}
                  onClick={() =>
                    onLaunch({
                      mode: 'hunt',
                      chapterId: tid === 'underground_horror' ? 'underground' : tid === 'mutated_beast' ? 'hospital' : 'forest',
                      huntTarget: tid,
                    })
                  }
                  className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-sky-400/50 hover:text-sky-300 text-left truncate"
                >
                  Hunt {MONSTERS[tid].name}
                </button>
              ))}
            </div>
          </div>

          {/* Exploration Mode */}
          <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5 flex flex-col justify-between">
            <div>
              <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-emerald-400" />
                Exploration Mode
              </h3>
              <p className="mt-2 text-sm text-slate-300">
                Roam eerie locations with low monster pressure to uncover all 5 hidden lore clues and inspect environments.
              </p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {CHAPTERS.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => onLaunch({ mode: 'exploration' as GameModeId, chapterId: ch.id })}
                  className="rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-emerald-400/50 hover:text-emerald-300"
                >
                  Explore {ch.title}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface CustomizePanelProps {
  save: PlayerSaveData;
  onUpdateSave: (updater: (prev: PlayerSaveData) => PlayerSaveData) => void;
}

export function CustomizePanel({ save, onUpdateSave }: CustomizePanelProps) {
  const skinTones = ['#F1C7AD', '#D8A98B', '#B57B56', '#7B4C32', '#4D2E20'];
  const hairColors = ['#1E1B18', '#4A3423', '#8C5230', '#CBD5E1', '#7F1D1D'];
  const accentColors = ['#F59E0B', '#38BDF8', '#EF4444', '#10B981', '#A78BFA'];

  const upgradeCost = (lvl: number) => 80 * lvl;

  const buyUpgrade = (key: keyof PlayerSaveData['upgrades']) => {
    const cur = save.upgrades[key];
    const cost = upgradeCost(cur);
    if (cur >= 5 || save.silverShards < cost) return;
    onUpdateSave((prev) => ({
      ...prev,
      silverShards: prev.silverShards - cost,
      upgrades: { ...prev.upgrades, [key]: cur + 1 },
    }));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Live 3D Hunter Turntable */}
      <div className="lg:col-span-5 h-[430px]">
        <HunterPreviewCanvas character={save.character} />
      </div>

      {/* Appearance, Outfits, Weapons, Upgrades */}
      <div className="lg:col-span-7 space-y-6">
        {/* Identity & Colors */}
        <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-bold text-white">Hunter Identity & Appearance</h3>
            <span className="font-mono-tabular text-sm font-semibold text-amber-400">
              {save.silverShards} Silver Shards
            </span>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Hunter Name</label>
            <input
              type="text"
              maxLength={24}
              value={save.character.name}
              onChange={(e) =>
                onUpdateSave((prev) => ({
                  ...prev,
                  character: { ...prev.character, name: e.target.value },
                }))
              }
              className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="text-xs text-slate-400 mb-1.5">Hairstyle</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {HAIRSTYLES.map((h) => (
                <button
                  key={h.id}
                  onClick={() =>
                    onUpdateSave((prev) => ({
                      ...prev,
                      character: { ...prev.character, hairstyle: h.id },
                    }))
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    save.character.hairstyle === h.id
                      ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                      : 'border-white/10 bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {h.name}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <div className="text-xs text-slate-400 mb-1.5">Skin Tone</div>
              <div className="flex gap-2">
                {skinTones.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      onUpdateSave((prev) => ({ ...prev, character: { ...prev.character, skinTone: c } }))
                    }
                    className={`w-7 h-7 rounded-full border-2 ${
                      save.character.skinTone === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Skin tone ${c}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1.5">Hair Color</div>
              <div className="flex gap-2">
                {hairColors.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      onUpdateSave((prev) => ({ ...prev, character: { ...prev.character, hairColor: c } }))
                    }
                    className={`w-7 h-7 rounded-full border-2 ${
                      save.character.hairColor === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Hair color ${c}`}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400 mb-1.5">Gear Trim Accent</div>
              <div className="flex gap-2">
                {accentColors.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      onUpdateSave((prev) => ({ ...prev, character: { ...prev.character, accentColor: c } }))
                    }
                    className={`w-7 h-7 rounded-full border-2 ${
                      save.character.accentColor === c ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Accent color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Unlockable Outfits */}
        <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5">
          <h3 className="font-display text-lg font-bold text-white mb-3">Hunter Outfits</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OUTFITS.map((o) => {
              const owned = save.unlockedOutfits.includes(o.id);
              const equipped = save.character.outfit === o.id;
              return (
                <div
                  key={o.id}
                  className={`rounded-lg border p-3.5 flex flex-col justify-between ${
                    equipped ? 'border-amber-400/60 bg-amber-950/20' : 'border-white/10 bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{o.name}</span>
                      <span
                        className="w-4 h-4 rounded-full border border-white/20"
                        style={{ backgroundColor: o.primaryHex }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{o.description}</p>
                  </div>
                  <div className="mt-3">
                    {owned ? (
                      <button
                        onClick={() =>
                          onUpdateSave((prev) => ({
                            ...prev,
                            character: { ...prev.character, outfit: o.id },
                          }))
                        }
                        className={`w-full rounded-lg py-1.5 text-xs font-semibold ${
                          equipped
                            ? 'bg-amber-500 text-slate-950'
                            : 'border border-white/15 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {equipped ? 'Equipped' : 'Equip Outfit'}
                      </button>
                    ) : (
                      <button
                        disabled={save.silverShards < o.costShards}
                        onClick={() =>
                          onUpdateSave((prev) => ({
                            ...prev,
                            silverShards: prev.silverShards - o.costShards,
                            unlockedOutfits: [...prev.unlockedOutfits, o.id],
                            character: { ...prev.character, outfit: o.id },
                          }))
                        }
                        className="w-full rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-amber-300 hover:bg-slate-700 disabled:opacity-45"
                      >
                        Unlock ({o.costShards} Shards)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Combat Weapons */}
        <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5">
          <h3 className="font-display text-lg font-bold text-white mb-3">Combat Equipment</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {WEAPONS.map((w) => {
              const owned = save.unlockedWeapons.includes(w.id);
              const equipped = save.character.equippedWeapon === w.id;
              return (
                <div
                  key={w.id}
                  className={`rounded-lg border p-3.5 flex flex-col justify-between ${
                    equipped ? 'border-amber-400/60 bg-amber-950/20' : 'border-white/10 bg-slate-900/60'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white">{w.name}</span>
                      <span className="text-[11px] font-mono-tabular text-slate-400">{w.type}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{w.description}</p>
                    <div className="mt-2 text-[11px] text-amber-300">{w.specialTrait}</div>
                  </div>
                  <div className="mt-3">
                    {owned ? (
                      <button
                        onClick={() =>
                          onUpdateSave((prev) => ({
                            ...prev,
                            character: { ...prev.character, equippedWeapon: w.id },
                          }))
                        }
                        className={`w-full rounded-lg py-1.5 text-xs font-semibold ${
                          equipped
                            ? 'bg-amber-500 text-slate-950'
                            : 'border border-white/15 text-slate-200 hover:bg-white/10'
                        }`}
                      >
                        {equipped ? 'Equipped' : 'Equip Weapon'}
                      </button>
                    ) : (
                      <button
                        disabled={save.silverShards < w.costShards}
                        onClick={() =>
                          onUpdateSave((prev) => ({
                            ...prev,
                            silverShards: prev.silverShards - w.costShards,
                            unlockedWeapons: [...prev.unlockedWeapons, w.id],
                            character: { ...prev.character, equippedWeapon: w.id },
                          }))
                        }
                        className="w-full rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-amber-300 hover:bg-slate-700 disabled:opacity-45"
                      >
                        Unlock ({w.costShards} Shards)
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Character Upgrades */}
        <div className="rounded-xl border border-white/10 bg-[#0E131D] p-5">
          <h3 className="font-display text-lg font-bold text-white mb-3">Hunter Upgrades</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'vitalityLevel' as const, label: 'Vitality Conditioning', desc: '+25 Max Health per rank' },
              { key: 'enduranceLevel' as const, label: 'Endurance Core', desc: '+20 Max Energy & faster regen' },
              { key: 'lethalityLevel' as const, label: 'Combat Mastery', desc: '+16% Weapon Damage per rank' },
              { key: 'lanternLevel' as const, label: 'Solaris Lantern', desc: '+1.8m Flare Radius & longer stun' },
            ].map((u) => {
              const lvl = save.upgrades[u.key];
              const cost = upgradeCost(lvl);
              const maxed = lvl >= 5;
              return (
                <div key={u.key} className="rounded-lg border border-white/10 bg-slate-900/60 p-3.5 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-white">
                      {u.label} <span className="font-mono-tabular text-xs text-amber-400">Lv.{lvl}/5</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{u.desc}</div>
                  </div>
                  <button
                    disabled={maxed || save.silverShards < cost}
                    onClick={() => buyUpgrade(u.key)}
                    className="shrink-0 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-40"
                  >
                    {maxed ? 'Maxed' : `${cost} Shards`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BestiaryPanel({ save }: { save: PlayerSaveData }) {
  const entries = Object.values(MONSTERS);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl font-bold text-white">Monster Discovery Collection</h2>
        <p className="text-sm text-slate-400">
          Encounter and banish monsters across missions to log behavioral dossiers and weaknesses.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {entries.map((m) => {
          const kills = save.discoveredMonsters[m.id] || 0;
          const discovered = kills > 0;
          return (
            <div key={m.id} className="rounded-xl border border-white/10 bg-[#0E131D] p-5 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span style={{ color: m.accentHex }} className="font-semibold">
                  {m.category}
                </span>
                <span className="font-mono-tabular text-slate-400">
                  {discovered ? `${kills} Banished` : 'Undiscovered'}
                </span>
              </div>
              <h3 className="font-display text-lg font-bold text-white">{m.name}</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{m.description}</p>
              <div className="pt-2 border-t border-white/10 space-y-1 text-xs">
                <div className="text-slate-400">
                  <strong className="text-slate-200">AI Behavior:</strong> {m.behaviorNotes}
                </div>
                <div className="text-amber-300/90">
                  <strong>Weakness:</strong> {m.weakness}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function AchievementsPanel({
  save,
  onClaimDaily,
}: {
  save: PlayerSaveData;
  onClaimDaily: (challengeId: string) => void;
}) {
  return (
    <div className="space-y-8">
      <section>
        <h2 className="font-display text-2xl font-bold text-white mb-1">Daily Contracts</h2>
        <p className="text-sm text-slate-400 mb-4">Complete daily operational goals for bonus Silver Shards and XP.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DAILY_CHALLENGES.map((dc) => {
            const current = save.daily[dc.metric];
            const complete = current >= dc.target;
            const claimed = save.daily.claimedIds.includes(dc.id);
            return (
              <div key={dc.id} className="rounded-xl border border-white/10 bg-[#0E131D] p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between text-xs text-amber-400 mb-1">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Daily Challenge
                    </span>
                    <span className="font-mono-tabular">
                      {Math.min(current, dc.target)}/{dc.target}
                    </span>
                  </div>
                  <h3 className="font-semibold text-white">{dc.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{dc.description}</p>
                </div>
                <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                  <span className="text-xs font-mono-tabular text-slate-300">
                    +{dc.rewardShards} Shards · +{dc.rewardXp} XP
                  </span>
                  <button
                    disabled={!complete || claimed}
                    onClick={() => onClaimDaily(dc.id)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                      claimed
                        ? 'bg-emerald-950/60 text-emerald-300'
                        : complete
                          ? 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                          : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {claimed ? 'Claimed' : complete ? 'Claim' : 'In Progress'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold text-white mb-1">Achievement Badges</h2>
        <p className="text-sm text-slate-400 mb-4">Permanent milestones earned across your hunting career.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ACHIEVEMENTS.map((ach) => {
            const unlocked = save.unlockedAchievements.includes(ach.id);
            return (
              <div
                key={ach.id}
                className={`rounded-xl border p-4 flex items-start gap-3.5 ${
                  unlocked ? 'border-amber-400/40 bg-amber-950/15' : 'border-white/10 bg-[#0E131D] opacity-70'
                }`}
              >
                <div
                  className={`p-2.5 rounded-lg ${
                    unlocked ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {unlocked ? <Award className="w-5 h-5" /> : <Shield className="w-5 h-5" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{ach.category}</span>
                    <span className="font-mono-tabular text-amber-400">+{ach.rewardShards} Shards</span>
                  </div>
                  <h3 className="font-semibold text-white text-sm mt-0.5">{ach.title}</h3>
                  <p className="text-xs text-slate-400 mt-1">{ach.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function SettingsPanel({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (next: GameSettings) => void;
}) {
  return (
    <div className="max-w-2xl rounded-2xl border border-white/10 bg-[#0E131D] p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="font-display text-2xl font-bold text-white">Audio, Camera & Controls</h2>
          <p className="text-sm text-slate-400">Customize sound mix, sensitivity, and mobile touch controls.</p>
        </div>
        <button
          onClick={() => onChange({ ...settings, muted: !settings.muted })}
          className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          {settings.muted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-amber-400" />}
          {settings.muted ? 'Muted' : 'Sound Active'}
        </button>
      </div>

      <div className="space-y-4">
        {[
          { key: 'masterVolume' as const, label: 'Master Volume' },
          { key: 'musicVolume' as const, label: 'Music & Atmosphere (Wind/Rain)' },
          { key: 'sfxVolume' as const, label: 'Combat & Monster SFX' },
        ].map((item) => (
          <div key={item.key}>
            <div className="flex justify-between text-xs text-slate-300 mb-1.5">
              <span>{item.label}</span>
              <span className="font-mono-tabular">{Math.round(settings[item.key] * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={settings[item.key]}
              onChange={(e) => onChange({ ...settings, [item.key]: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
          </div>
        ))}

        <div>
          <div className="flex justify-between text-xs text-slate-300 mb-1.5">
            <span>Camera Sensitivity</span>
            <span className="font-mono-tabular">{settings.mouseSensitivity.toFixed(1)}x</span>
          </div>
          <input
            type="range"
            min={0.4}
            max={2.2}
            step={0.1}
            value={settings.mouseSensitivity}
            onChange={(e) => onChange({ ...settings, mouseSensitivity: Number(e.target.value) })}
            className="w-full accent-amber-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/10">
        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Default Camera</label>
          <select
            value={settings.defaultCamera}
            onChange={(e) =>
              onChange({ ...settings, defaultCamera: e.target.value as GameSettings['defaultCamera'] })
            }
            className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
          >
            <option value="third_person">Third-Person</option>
            <option value="first_person">First-Person</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Graphics Quality</label>
          <select
            value={settings.graphicsQuality}
            onChange={(e) =>
              onChange({ ...settings, graphicsQuality: e.target.value as GameSettings['graphicsQuality'] })
            }
            className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
          >
            <option value="high">High (Shadows & AA)</option>
            <option value="balanced">Balanced Performance</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-slate-400 mb-1.5">Touch Controls</label>
          <select
            value={settings.showTouchControls}
            onChange={(e) =>
              onChange({ ...settings, showTouchControls: e.target.value as GameSettings['showTouchControls'] })
            }
            className="w-full rounded-lg border border-white/15 bg-slate-900 px-3 py-2 text-xs text-white"
          >
            <option value="auto">Auto-Detect Mobile</option>
            <option value="always">Always On</option>
            <option value="off">Off (Desktop Only)</option>
          </select>
        </div>
      </div>
    </div>
  );
}
