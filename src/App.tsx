import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  BookOpen,
  Compass,
  Play,
  RotateCcw,
  Settings,
  Share2,
  ShieldCheck,
  UserCheck,
  UserCog,
} from 'lucide-react';
import { AccountModal } from './components/AccountModal';
import { LinkPreviewModal } from './components/LinkPreviewModal';
import {
  AchievementsPanel,
  BestiaryPanel,
  CustomizePanel,
  GameModesPanel,
  SettingsPanel,
} from './components/MenuPanels';
import { InGameHud } from './components/InGameHud';
import { PauseModal } from './components/PauseModal';
import {
  ACHIEVEMENTS,
  CHAPTERS,
  COVER_KEYART_URL,
  createDefaultSaveData,
  DAILY_CHALLENGES,
  getChapterById,
  getTodayDateKey,
  xpRequiredForLevel,
} from './game/data/gameCatalog';
import { NightfallEngine } from './game/NightfallEngine';
import type {
  AccountUser,
  ChapterId,
  GameHudSnapshot,
  GameModeId,
  MissionLaunchConfig,
  MonsterCategoryId,
  PlayerSaveData,
} from './game/types';
import {
  fetchCurrentAccount,
  getStoredToken,
  loadLocalSave,
  saveCloudProgress,
  setStoredToken,
  writeLocalSave,
} from './services/api';

type MenuTab = 'home' | 'modes' | 'customize' | 'bestiary' | 'achievements' | 'settings';

function normalizeSave(raw: Partial<PlayerSaveData> | null): PlayerSaveData {
  const def = createDefaultSaveData();
  if (!raw) return def;
  const today = getTodayDateKey();
  const daily =
    raw.daily && raw.daily.dateKey === today
      ? raw.daily
      : { dateKey: today, killsToday: 0, missionsToday: 0, cluesToday: 0, claimedIds: [] };
  return {
    ...def,
    ...raw,
    discoveredMonsters: { ...def.discoveredMonsters, ...(raw.discoveredMonsters || {}) },
    character: { ...def.character, ...(raw.character || {}) },
    upgrades: { ...def.upgrades, ...(raw.upgrades || {}) },
    settings: { ...def.settings, ...(raw.settings || {}) },
    daily,
  };
}

export default function App() {
  const [save, setSave] = useState<PlayerSaveData>(() => normalizeSave(loadLocalSave()));
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [accountUser, setAccountUser] = useState<AccountUser | null>(null);

  const [menuTab, setMenuTab] = useState<MenuTab>('home');
  const [accountOpen, setAccountOpen] = useState(false);
  const [linkPreviewOpen, setLinkPreviewOpen] = useState(false);

  // Active Gameplay State
  const [activeMission, setActiveMission] = useState<MissionLaunchConfig | null>(null);
  const [loadingMission, setLoadingMission] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pauseSettingsOpen, setPauseSettingsOpen] = useState(false);
  const [hud, setHud] = useState<GameHudSnapshot | null>(null);
  const [missionRunKey, setMissionRunKey] = useState(0);

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<NightfallEngine | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  // Hydrate authenticated user on mount + parse shared mission link params
  useEffect(() => {
    const token = getStoredToken();
    if (token) {
      fetchCurrentAccount(token)
        .then((res) => {
          setAccountUser(res.user);
          if (res.progress) {
            const merged = normalizeSave(res.progress);
            setSave(merged);
            writeLocalSave(merged);
          }
        })
        .catch(() => {
          setStoredToken(null);
          setAuthToken(null);
        });
    }

    const params = new URLSearchParams(window.location.search);
    const sharedChapter = params.get('chapter') as ChapterId | null;
    const sharedMode = (params.get('mode') || 'story') as GameModeId;
    if (sharedChapter && CHAPTERS.some((c) => c.id === sharedChapter)) {
      setMenuTab('modes');
    }
    if (sharedMode && ['story', 'survival', 'hunt', 'boss', 'exploration'].includes(sharedMode) && sharedChapter) {
      setSave((prev) => ({ ...prev, lastChapter: sharedChapter, lastMode: sharedMode }));
    }
  }, []);

  const updateSave = useCallback(
    (updater: (prev: PlayerSaveData) => PlayerSaveData) => {
      setSave((prev) => {
        const next = normalizeSave(updater(prev));
        writeLocalSave(next);
        if (authToken) {
          void saveCloudProgress(authToken, next).catch(() => {
            // keep local save if offline
          });
        }
        return next;
      });
    },
    [authToken]
  );

  const handleRunReward = useCallback(
    (delta: {
      xp: number;
      shards: number;
      killsByType: Partial<Record<MonsterCategoryId, number>>;
      rescues: number;
      clues: number;
      completedChapter?: string;
      survivalWave?: number;
      victory: boolean;
    }) => {
      updateSave((prev) => {
        let xp = prev.xp + delta.xp;
        let level = prev.level;
        while (xp >= xpRequiredForLevel(level)) {
          xp -= xpRequiredForLevel(level);
          level++;
        }

        const totalKillsGain = Object.values(delta.killsByType).reduce((acc, v) => acc + (v || 0), 0);
        const discovered = { ...prev.discoveredMonsters };
        for (const [k, count] of Object.entries(delta.killsByType)) {
          const cid = k as MonsterCategoryId;
          discovered[cid] = (discovered[cid] || 0) + (count || 0);
        }

        const completedChapters = [...prev.completedChapters];
        const unlockedChapters = [...prev.unlockedChapters];
        if (delta.completedChapter) {
          const cid = delta.completedChapter as ChapterId;
          if (!completedChapters.includes(cid)) completedChapters.push(cid);
          const idx = CHAPTERS.findIndex((c) => c.id === cid);
          if (idx >= 0 && idx + 1 < CHAPTERS.length) {
            const nextCid = CHAPTERS[idx + 1].id;
            if (!unlockedChapters.includes(nextCid)) unlockedChapters.push(nextCid);
          }
        }

        const totalKills = prev.totalKills + totalKillsGain;
        const totalRescues = prev.totalRescues + delta.rescues;
        const totalClues = prev.totalClues + delta.clues;
        const bestSurvivalWave = Math.max(prev.bestSurvivalWave, delta.survivalWave || 0);

        // Evaluate Achievements
        const unlockedAch = [...prev.unlockedAchievements];
        let achShards = 0;
        const unlockAch = (id: string) => {
          if (!unlockedAch.includes(id)) {
            unlockedAch.push(id);
            const found = ACHIEVEMENTS.find((a) => a.id === id);
            if (found) achShards += found.rewardShards;
          }
        };
        if (totalKills >= 1) unlockAch('first_blood');
        if (totalRescues >= 3) unlockAch('survivor_savior');
        if (totalClues >= 5) unlockAch('lore_seeker');
        if (totalKills >= 25) unlockAch('slayer_25');
        if (bestSurvivalWave >= 4) unlockAch('wave_survivor');
        if ((discovered.boss_sovereign || 0) >= 1) unlockAch('sovereign_bane');

        return {
          ...prev,
          xp,
          level,
          silverShards: prev.silverShards + delta.shards + achShards,
          unlockedChapters,
          completedChapters,
          discoveredMonsters: discovered,
          unlockedAchievements: unlockedAch,
          totalKills,
          totalRescues,
          totalClues,
          bestSurvivalWave,
          daily: {
            ...prev.daily,
            killsToday: prev.daily.killsToday + totalKillsGain,
            missionsToday: prev.daily.missionsToday + (delta.victory ? 1 : 0),
            cluesToday: prev.daily.cluesToday + delta.clues,
          },
        };
      });
    },
    [updateSave]
  );

  const launchMission = useCallback(
    (cfg: MissionLaunchConfig) => {
      setPaused(false);
      setPauseSettingsOpen(false);
      setLoadingMission(true);
      updateSave((prev) => ({
        ...prev,
        lastChapter: cfg.chapterId,
        lastMode: cfg.mode,
      }));
      setTimeout(() => {
        setActiveMission(cfg);
        setMissionRunKey((k) => k + 1);
        setLoadingMission(false);
      }, 450);
    },
    [updateSave]
  );

  // Mount & clean up Three.js NightfallEngine whenever activeMission / missionRunKey changes
  useEffect(() => {
    if (!activeMission || !canvasHostRef.current) return;

    const engine = new NightfallEngine({
      container: canvasHostRef.current,
      save: saveRef.current,
      launchConfig: activeMission,
      onHudUpdate: (snapshot) => setHud(snapshot),
      onRunReward: handleRunReward,
      onPauseRequested: () => {
        setPaused((prev) => {
          const next = !prev;
          engine.setPaused(next);
          if (!next) setPauseSettingsOpen(false);
          return next;
        });
      },
    });

    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      setHud(null);
    };
  }, [activeMission, missionRunKey, handleRunReward]);

  const handleTogglePause = (nextPaused: boolean) => {
    setPaused(nextPaused);
    if (!nextPaused) setPauseSettingsOpen(false);
    engineRef.current?.setPaused(nextPaused);
  };

  const handleClaimDaily = (challengeId: string) => {
    const ch = DAILY_CHALLENGES.find((c) => c.id === challengeId);
    if (!ch) return;
    updateSave((prev) => {
      if (prev.daily.claimedIds.includes(challengeId) || prev.daily[ch.metric] < ch.target) return prev;
      let xp = prev.xp + ch.rewardXp;
      let level = prev.level;
      while (xp >= xpRequiredForLevel(level)) {
        xp -= xpRequiredForLevel(level);
        level++;
      }
      return {
        ...prev,
        xp,
        level,
        silverShards: prev.silverShards + ch.rewardShards,
        daily: { ...prev.daily, claimedIds: [...prev.daily.claimedIds, challengeId] },
      };
    });
  };

  const lastChapterDef = getChapterById(save.lastChapter);

  // ==========================================
  // ACTIVE 3D GAMEPLAY VIEWPORT
  // ==========================================
  if (activeMission) {
    return (
      <div className="relative w-screen h-screen overflow-hidden bg-[#080A0F]">
        {/* Isolated WebGL Container */}
        <div ref={canvasHostRef} className="w-full h-full" />

        {/* Real-time 2D HUD Overlay */}
        {hud && (
          <InGameHud
            hud={hud}
            playerName={save.character.name || 'Hunter'}
            playerLevel={save.level}
            equippedWeapon={save.character.equippedWeapon}
            settings={save.settings}
            onPause={() => handleTogglePause(true)}
            onToggleCamera={() => engineRef.current?.toggleCameraMode()}
            onVirtualJoystick={(x, y) => engineRef.current?.setVirtualJoystick(x, y)}
            onTouchLook={(dx, dy) => engineRef.current?.triggerTouchLook(dx, dy)}
            onAttack={() => engineRef.current?.triggerAttack()}
            onDodge={() => engineRef.current?.triggerDodge()}
            onJump={() => engineRef.current?.triggerJump()}
            onFlare={() => engineRef.current?.triggerFlare()}
            onHeal={() => engineRef.current?.triggerHeal()}
            onInteract={() => engineRef.current?.triggerInteract()}
            onSolvePuzzle={() => engineRef.current?.completeActivePuzzle()}
            onCancelPuzzle={() => engineRef.current?.cancelActivePuzzle()}
            onRestartMission={() => launchMission(activeMission)}
            onReturnMenu={() => {
              setActiveMission(null);
              setPaused(false);
            }}
            onShareMission={() => {
              handleTogglePause(true);
              setLinkPreviewOpen(true);
            }}
          />
        )}

        {/* Pause Menu */}
        <PauseModal
          open={paused && !pauseSettingsOpen && !linkPreviewOpen && !hud?.outcome}
          onResume={() => handleTogglePause(false)}
          onRestart={() => launchMission(activeMission)}
          onOpenSettings={() => setPauseSettingsOpen(true)}
          onOpenShare={() => setLinkPreviewOpen(true)}
          onReturnMenu={() => {
            setActiveMission(null);
            setPaused(false);
          }}
        />

        {/* In-Pause Settings Overlay */}
        {paused && pauseSettingsOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-2xl space-y-3">
              <SettingsPanel
                settings={save.settings}
                onChange={(next) => {
                  updateSave((prev) => ({ ...prev, settings: next }));
                  engineRef.current?.updateSettings(next);
                }}
              />
              <div className="flex justify-end">
                <button
                  onClick={() => setPauseSettingsOpen(false)}
                  className="rounded-lg bg-amber-500 px-5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                >
                  Back to Pause Menu
                </button>
              </div>
            </div>
          </div>
        )}

        <LinkPreviewModal
          open={linkPreviewOpen}
          defaultChapter={activeMission.chapterId}
          defaultMode={activeMission.mode}
          onClose={() => setLinkPreviewOpen(false)}
          onLaunchFromLink={(ch, md) => launchMission({ mode: md, chapterId: ch })}
        />
      </div>
    );
  }

  // ==========================================
  // LOADING SCREEN
  // ==========================================
  if (loadingMission) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#080A0F] p-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-400">
            Entering Quarantine Zone
          </div>
          <h2 className="font-display text-3xl font-bold text-white">NIGHTFALL: MONSTER HUNTERS</h2>
          <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
            <div className="h-full w-3/4 bg-amber-500 rounded-full animate-pulse" />
          </div>
          <p className="text-xs text-slate-400">
            Initializing 3D environment, procedural audio synthesis, and monster AI...
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // MAIN MENU SHELL
  // ==========================================
  const xpGoal = xpRequiredForLevel(save.level);
  const xpPct = Math.min(100, Math.round((save.xp / xpGoal) * 100));

  return (
    <div className="relative h-screen w-screen overflow-y-auto bg-[#080A0F] text-slate-100 flex flex-col">
      {/* Atmospheric Cover Backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <img
          src={COVER_KEYART_URL}
          alt="Nightfall Monster Hunters Atmosphere"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover opacity-25"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#080A0F]/85 via-[#080A0F]/75 to-[#080A0F]" />
      </div>

      {/* Top Navigation Bar (Clean 3-Zone Contract) */}
      <header className="relative z-10 border-b border-white/10 bg-[#080A0F]/85">
        <div className="mx-auto max-w-7xl px-4 sm:px-8 py-3.5 flex items-center justify-between gap-6">
          <button
            onClick={() => setMenuTab('home')}
            className="font-display text-lg sm:text-xl font-bold tracking-wider text-white whitespace-nowrap shrink-0"
          >
            NIGHTFALL
          </button>

          <nav className="flex items-center gap-4 sm:gap-6 overflow-x-auto text-xs sm:text-sm font-medium text-slate-300">
            {[
              { id: 'home' as const, label: 'Overview' },
              { id: 'modes' as const, label: 'Game Modes' },
              { id: 'customize' as const, label: 'Customize' },
              { id: 'bestiary' as const, label: 'Monsters' },
              { id: 'achievements' as const, label: 'Achievements' },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setMenuTab(item.id)}
                className={`whitespace-nowrap shrink-0 pb-1 transition-colors border-b-2 ${
                  menuTab === item.id
                    ? 'border-amber-400 text-amber-300'
                    : 'border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setLinkPreviewOpen(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 whitespace-nowrap"
              title="Share & Link Preview"
            >
              <Share2 className="w-3.5 h-3.5 text-amber-400" />
              Share
            </button>
            <button
              onClick={() => setMenuTab('settings')}
              className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
              title="Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAccountOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 whitespace-nowrap"
            >
              {accountUser ? <UserCheck className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{accountUser ? accountUser.email.split('@')[0] : 'Account'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="relative z-10 flex-1 mx-auto w-full max-w-7xl px-4 sm:px-8 py-6 sm:py-10">
        {menuTab === 'home' && (
          <div className="space-y-10">
            {/* Hero Feature Banner */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
                <div className="text-xs font-medium tracking-widest uppercase text-amber-400">
                  3D Survival Horror · Action Adventure
                </div>
                <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight text-balance">
                  NIGHTFALL: MONSTER HUNTERS
                </h1>
                <p className="text-sm sm:text-base text-slate-300 max-w-2xl leading-relaxed">
                  Step into rain-drenched quarantine districts, flickering hospital corridors, haunted forests, and subterranean vaults. Customize your hunter, solve security seals, rescue survivors, and banish apex horrors in real-time 3D combat.
                </p>

                {/* Primary Menu Actions */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={() =>
                      launchMission({ mode: save.lastMode || 'story', chapterId: save.lastChapter || 'city' })
                    }
                    className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 shadow-lg transition-colors"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Continue · {lastChapterDef.title}
                  </button>
                  <button
                    onClick={() => launchMission({ mode: 'story', chapterId: 'city' })}
                    className="flex items-center gap-2 rounded-lg border border-white/20 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 transition-colors"
                  >
                    <RotateCcw className="w-4 h-4 text-sky-400" />
                    New Game (Chapter 1)
                  </button>
                  <button
                    onClick={() => setMenuTab('modes')}
                    className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    <Compass className="w-4 h-4 text-amber-400" />
                    Game Modes
                  </button>
                  <button
                    onClick={() => setMenuTab('customize')}
                    className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors"
                  >
                    <UserCog className="w-4 h-4 text-emerald-400" />
                    Customize Hunter
                  </button>
                </div>
              </div>

              {/* Cover Key Art Card */}
              <div className="lg:col-span-5 rounded-2xl border border-white/15 bg-[#0E131D] overflow-hidden shadow-2xl flex flex-col">
                <div className="relative flex-1 min-h-[240px]">
                  <img
                    src={COVER_KEYART_URL}
                    alt="Nightfall Monster Hunters Key Art"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0E131D] via-transparent to-transparent" />
                </div>
                <div className="p-4 flex items-center justify-between border-t border-white/10 text-xs">
                  <div>
                    <div className="text-slate-400">Active Hunter</div>
                    <div className="font-semibold text-white">{save.character.name}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-slate-400">Next Deployment</div>
                    <div className="font-semibold text-amber-300">{lastChapterDef.subtitle}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Hunter Progression Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="rounded-xl border border-white/10 bg-[#0E131D]/90 p-4">
                <div className="text-xs text-slate-400">Hunter Level</div>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="font-mono-tabular text-2xl font-bold text-white">Lv.{save.level}</span>
                  <span className="font-mono-tabular text-xs text-sky-400">{xpPct}% XP</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                  <div className="h-full bg-sky-400" style={{ width: `${xpPct}%` }} />
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0E131D]/90 p-4">
                <div className="text-xs text-slate-400">Silver Shards</div>
                <div className="mt-1 font-mono-tabular text-2xl font-bold text-amber-400">
                  {save.silverShards}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">In-game upgrade currency</div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0E131D]/90 p-4">
                <div className="text-xs text-slate-400">Monsters Banished</div>
                <div className="mt-1 font-mono-tabular text-2xl font-bold text-white">{save.totalKills}</div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Best Survival Wave: {save.bestSurvivalWave}
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0E131D]/90 p-4">
                <div className="text-xs text-slate-400">Chapters Cleared</div>
                <div className="mt-1 font-mono-tabular text-2xl font-bold text-emerald-400">
                  {save.completedChapters.length} / {CHAPTERS.length}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  {save.unlockedAchievements.length} / {ACHIEVEMENTS.length} Achievements
                </div>
              </div>
            </div>

            {/* Quick Navigation Cards for Bestiary, Achievements & Link Preview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                onClick={() => setMenuTab('bestiary')}
                className="text-left rounded-xl border border-white/10 bg-[#0E131D]/90 p-5 hover:border-amber-400/40 transition-colors"
              >
                <BookOpen className="w-5 h-5 text-sky-400 mb-2" />
                <div className="font-display text-base font-bold text-white">Monster Collection</div>
                <p className="mt-1 text-xs text-slate-400">
                  Inspect Shadow Creatures, Mutated Beasts, Night Stalkers, Underground Horrors, and Apex Bosses.
                </p>
              </button>

              <button
                onClick={() => setMenuTab('achievements')}
                className="text-left rounded-xl border border-white/10 bg-[#0E131D]/90 p-5 hover:border-amber-400/40 transition-colors"
              >
                <Award className="w-5 h-5 text-amber-400 mb-2" />
                <div className="font-display text-base font-bold text-white">Achievements & Daily Contracts</div>
                <p className="mt-1 text-xs text-slate-400">
                  Claim daily mission rewards and unlock career hunter badges.
                </p>
              </button>

              <button
                onClick={() => setLinkPreviewOpen(true)}
                className="text-left rounded-xl border border-white/10 bg-[#0E131D]/90 p-5 hover:border-amber-400/40 transition-colors"
              >
                <Share2 className="w-5 h-5 text-emerald-400 mb-2" />
                <div className="font-display text-base font-bold text-white">Share Mission & Link Preview</div>
                <p className="mt-1 text-xs text-slate-400">
                  Generate rich OpenGraph previews for game chapters, missions, or external links.
                </p>
              </button>
            </div>
          </div>
        )}

        {menuTab === 'modes' && <GameModesPanel save={save} onLaunch={launchMission} />}

        {menuTab === 'customize' && <CustomizePanel save={save} onUpdateSave={updateSave} />}

        {menuTab === 'bestiary' && <BestiaryPanel save={save} />}

        {menuTab === 'achievements' && (
          <AchievementsPanel save={save} onClaimDaily={handleClaimDaily} />
        )}

        {menuTab === 'settings' && (
          <SettingsPanel
            settings={save.settings}
            onChange={(next) => updateSave((prev) => ({ ...prev, settings: next }))}
          />
        )}
      </main>

      {/* Account & Security Modal */}
      <AccountModal
        open={accountOpen}
        user={accountUser}
        token={authToken}
        save={save}
        onClose={() => setAccountOpen(false)}
        onAuthenticated={(token, user, serverProgress) => {
          setAuthToken(token);
          setStoredToken(token);
          setAccountUser(user);
          if (serverProgress) {
            const merged = normalizeSave(serverProgress);
            setSave(merged);
            writeLocalSave(merged);
          }
        }}
        onUserUpdated={(user) => setAccountUser(user)}
        onLoggedOut={() => {
          setAuthToken(null);
          setStoredToken(null);
          setAccountUser(null);
        }}
      />

      {/* Link Preview Modal */}
      <LinkPreviewModal
        open={linkPreviewOpen}
        defaultChapter={save.lastChapter}
        defaultMode={save.lastMode}
        onClose={() => setLinkPreviewOpen(false)}
        onLaunchFromLink={(ch, md) => launchMission({ mode: md, chapterId: ch })}
      />
    </div>
  );
}
