export type GameModeId = 'story' | 'survival' | 'hunt' | 'boss' | 'exploration';

export type ChapterId = 'city' | 'hospital' | 'forest' | 'underground' | 'citadel';

export type MonsterCategoryId =
  | 'shadow_creature'
  | 'mutated_beast'
  | 'night_stalker'
  | 'underground_horror'
  | 'boss_warden'
  | 'boss_sovereign';

export type WeaponId = 'arcane_edge' | 'solaris_repeater' | 'umbral_scythe' | 'aegis_lance';

export type OutfitId = 'nightwatch' | 'warden_plate' | 'crimson_inquisitor' | 'shadow_operative';

export type HairstyleId = 'tactical_hood' | 'swept_undercut' | 'long_braid' | 'short_crop';

export type CameraPerspective = 'third_person' | 'first_person';

export interface CharacterCustomization {
  name: string;
  hairstyle: HairstyleId;
  outfit: OutfitId;
  skinTone: string;
  hairColor: string;
  accentColor: string;
  equippedWeapon: WeaponId;
}

export interface PlayerUpgrades {
  vitalityLevel: number; // +max health
  enduranceLevel: number; // +max energy & regen
  lethalityLevel: number; // +weapon damage
  lanternLevel: number; // +flare radius & stun
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  mouseSensitivity: number;
  defaultCamera: CameraPerspective;
  graphicsQuality: 'high' | 'balanced';
  showTouchControls: 'auto' | 'always' | 'off';
}

export interface DailyChallengeProgress {
  dateKey: string;
  killsToday: number;
  missionsToday: number;
  cluesToday: number;
  claimedIds: string[];
}

export interface PlayerSaveData {
  xp: number;
  level: number;
  silverShards: number;
  lastChapter: ChapterId;
  lastMode: GameModeId;
  unlockedChapters: ChapterId[];
  completedChapters: ChapterId[];
  unlockedWeapons: WeaponId[];
  unlockedOutfits: OutfitId[];
  discoveredMonsters: Record<MonsterCategoryId, number>; // kill count per monster type
  unlockedAchievements: string[];
  totalKills: number;
  totalRescues: number;
  totalClues: number;
  bestSurvivalWave: number;
  character: CharacterCustomization;
  upgrades: PlayerUpgrades;
  settings: GameSettings;
  daily: DailyChallengeProgress;
}

export interface ChapterDefinition {
  id: ChapterId;
  number: number;
  title: string;
  subtitle: string;
  location: string;
  description: string;
  bannerImage: string;
  difficulty: 'Moderate' | 'High' | 'Severe' | 'Extreme' | 'Nightmare';
  rewardShards: number;
  rewardXp: number;
  fogColor: number;
  fogDensity: number;
  skyColor: number;
  hasRain: boolean;
  hasLightning: boolean;
  isIndoor: boolean;
  objectivesSummary: string[];
  recommendedLevel: number;
}

export interface MonsterDefinition {
  id: MonsterCategoryId;
  category: string;
  name: string;
  threatLevel: 'Moderate' | 'High' | 'Severe' | 'Apex Boss';
  baseHealth: number;
  speed: number;
  damage: number;
  attackRange: number;
  detectRange: number;
  xpReward: number;
  shardReward: number;
  description: string;
  behaviorNotes: string;
  weakness: string;
  accentHex: string;
}

export interface WeaponDefinition {
  id: WeaponId;
  name: string;
  type: 'Melee' | 'Ranged' | 'Heavy Melee' | 'Precision Lance';
  damage: number;
  energyCost: number;
  cooldown: number;
  range: number;
  costShards: number;
  description: string;
  specialTrait: string;
  accentHex: string;
}

export interface OutfitDefinition {
  id: OutfitId;
  name: string;
  costShards: number;
  description: string;
  primaryHex: string;
  secondaryHex: string;
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  rewardShards: number;
  category: 'Combat' | 'Exploration' | 'Story' | 'Survival';
}

export interface DailyChallengeDefinition {
  id: string;
  title: string;
  description: string;
  target: number;
  metric: 'killsToday' | 'missionsToday' | 'cluesToday';
  rewardShards: number;
  rewardXp: number;
}

export interface MissionLaunchConfig {
  mode: GameModeId;
  chapterId: ChapterId;
  huntTarget?: MonsterCategoryId;
  bossTarget?: 'boss_warden' | 'boss_sovereign';
}

export interface HudObjective {
  id: string;
  label: string;
  current: number;
  target: number;
  completed: boolean;
}

export interface RadarBlip {
  x: number; // relative to player (-1..1 in radar radius)
  z: number;
  kind: 'monster' | 'boss' | 'objective' | 'survivor' | 'clue' | 'supply';
}

export interface ActivePuzzlePrompt {
  id: string;
  type: 'circuit' | 'runes';
  title: string;
  subtitle: string;
}

export interface GameHudSnapshot {
  health: number;
  maxHealth: number;
  energy: number;
  maxEnergy: number;
  healCharges: number;
  flareCooldown: number;
  flareMaxCooldown: number;
  dodgeCooldown: number;
  cameraMode: CameraPerspective;
  pointerLocked: boolean;
  objectives: HudObjective[];
  interactPrompt: string | null;
  bossInfo: {
    name: string;
    category: string;
    health: number;
    maxHealth: number;
  } | null;
  nearestThreatDist: number | null;
  waveNumber: number;
  killsThisRun: number;
  cluesThisRun: number;
  rescuesThisRun: number;
  shardsEarnedThisRun: number;
  xpEarnedThisRun: number;
  elapsedSeconds: number;
  bannerMessage: string | null;
  radarBlips: RadarBlip[];
  playerYaw: number;
  activePuzzle: ActivePuzzlePrompt | null;
  outcome: null | {
    victory: boolean;
    title: string;
    summary: string;
    shardsEarned: number;
    xpEarned: number;
    kills: number;
    rescues: number;
    clues: number;
  };
}

export interface AccountUser {
  id: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface LinkPreviewData {
  url: string;
  title: string;
  description: string;
  image: string;
  domain: string;
  type: 'game' | 'mission' | 'external';
  metaLine: string;
}
