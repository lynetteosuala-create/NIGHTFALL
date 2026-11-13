import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HorrorAudio } from './audio/HorrorAudio';
import { getChapterById, MONSTERS, WEAPONS } from './data/gameCatalog';
import { buildEnvironment, type BuiltEnvironment, type WorldInteractable } from './environments/EnvironmentBuilder';
import { animateHunterRig, buildHunterModel, type HunterRig } from './models/HunterModel';
import { animateMonsterRig, buildMonsterModel, type MonsterRig } from './models/MonsterModels';
import { createContactShadowTexture } from './textures/ProceduralTextures';
import type {
  CameraPerspective,
  GameHudSnapshot,
  MissionLaunchConfig,
  MonsterCategoryId,
  PlayerSaveData,
  RadarBlip,
} from './types';

interface ActiveMonster {
  id: string;
  category: MonsterCategoryId;
  rig: MonsterRig;
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  health: number;
  maxHealth: number;
  speed: number;
  damage: number;
  attackRange: number;
  detectRange: number;
  attackCooldown: number;
  attackAnim: number;
  stunTimer: number;
  hitFlash: number;
  banishProgress: number;
  dead: boolean;
  isBoss: boolean;
  specialCooldown: number;
  stepTimer: number;
}

interface Projectile {
  mesh: THREE.Mesh;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  damage: number;
  fromPlayer: boolean;
  life: number;
  radius: number;
}

interface ImpactBurst {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
  expandSpeed: number;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _camTarget = new THREE.Vector3();
const _camGoal = new THREE.Vector3();

export class NightfallEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private clock = new THREE.Clock();
  private audio = new HorrorAudio();

  private frameId = 0;
  private disposed = false;
  private paused = false;
  private contextLost = false;

  private shadowTex: THREE.CanvasTexture;
  private env: BuiltEnvironment | null = null;
  private hunterRig: HunterRig | null = null;
  private rainPoints: THREE.Points | null = null;
  private lightningLight: THREE.DirectionalLight;
  private ambientFlash = 0;
  private lightningTimer = 5;

  private save: PlayerSaveData;
  private launchConfig: MissionLaunchConfig;
  private onHudUpdate: (hud: GameHudSnapshot) => void;
  private onRunReward: (delta: {
    xp: number;
    shards: number;
    killsByType: Partial<Record<MonsterCategoryId, number>>;
    rescues: number;
    clues: number;
    completedChapter?: string;
    survivalWave?: number;
    victory: boolean;
  }) => void;
  private onPauseRequested: () => void;

  // Player state
  private px = 0;
  private py = 0;
  private pz = 18;
  private vy = 0;
  private grounded = true;
  private yaw = 0;
  private pitch = 0.18;
  private cameraMode: CameraPerspective = 'third_person';
  private pointerLocked = false;

  private health = 100;
  private maxHealth = 100;
  private energy = 100;
  private maxEnergy = 100;
  private healCharges = 3;
  private attackCooldown = 0;
  private attackAnim = 0;
  private dodgeTimer = 0;
  private dodgeCooldown = 0;
  private dodgeDirX = 0;
  private dodgeDirZ = 0;
  private flareCooldown = 0;
  private invulnTimer = 0;
  private playerStepTimer = 0;

  // Input state
  private keys: Record<string, boolean> = {};
  private joyX = 0;
  private joyY = 0;
  private draggingLook = false;
  private lastDragX = 0;
  private lastDragY = 0;

  // Mission state
  private monsters: ActiveMonster[] = [];
  private projectiles: Projectile[] = [];
  private bursts: ImpactBurst[] = [];
  private elapsed = 0;
  private waveNumber = 1;
  private survivalSpawnTimer = 1.5;
  private killsThisRun = 0;
  private killsByType: Partial<Record<MonsterCategoryId, number>> = {};
  private rescuesThisRun = 0;
  private cluesThisRun = 0;
  private shardsEarned = 0;
  private xpEarned = 0;
  private beaconsDone = 0;
  private puzzlesDone = 0;
  private bossSpawned = false;
  private bossDefeated = false;
  private activePuzzleInteractable: WorldInteractable | null = null;
  private bannerMessage: string | null = null;
  private bannerTimer = 0;
  private outcome: GameHudSnapshot['outcome'] = null;
  private hudThrottle = 0;

  constructor(options: {
    container: HTMLElement;
    save: PlayerSaveData;
    launchConfig: MissionLaunchConfig;
    onHudUpdate: (hud: GameHudSnapshot) => void;
    onRunReward: NightfallEngine['onRunReward'];
    onPauseRequested: () => void;
  }) {
    this.container = options.container;
    this.save = options.save;
    this.launchConfig = options.launchConfig;
    this.onHudUpdate = options.onHudUpdate;
    this.onRunReward = options.onRunReward;
    this.onPauseRequested = options.onPauseRequested;
    this.cameraMode = options.save.settings.defaultCamera;
    this.audio.updateSettings(options.save.settings);

    // Software WebGL guard
    this.isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && options.save.settings.graphicsQuality === 'high',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && options.save.settings.graphicsQuality === 'high';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth || 1280, this.container.clientHeight || 720);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const width = this.container.clientWidth || 1280;
    const height = this.container.clientHeight || 720;
    this.camera = new THREE.PerspectiveCamera(68, width / height, 0.15, 220);

    // Balanced warm/cool 3-point horror lighting rig
    const hemi = new THREE.HemisphereLight(0x4a6b8c, 0x1c1412, 0.72);
    this.scene.add(hemi);

    const moonKey = new THREE.DirectionalLight(0xbfd7ff, 1.15);
    moonKey.position.set(26, 42, 18);
    if (!this.isSoftwareGl) {
      moonKey.castShadow = true;
      moonKey.shadow.mapSize.set(1024, 1024);
      moonKey.shadow.camera.left = -36;
      moonKey.shadow.camera.right = 36;
      moonKey.shadow.camera.top = 36;
      moonKey.shadow.camera.bottom = -36;
      moonKey.shadow.bias = -0.0005;
      moonKey.shadow.normalBias = 0.02;
    }
    this.scene.add(moonKey);

    this.lightningLight = new THREE.DirectionalLight(0xdbeafe, 0);
    this.lightningLight.position.set(-20, 48, -20);
    this.scene.add(this.lightningLight);

    this.shadowTex = createContactShadowTexture();

    this.initMissionWorld();
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.audio.playMissionIntro();
    this.pushHud();
    this.tick();
  }

  private initMissionWorld(): void {
    const chapter = getChapterById(this.launchConfig.chapterId);
    this.scene.background = new THREE.Color(chapter.skyColor);
    this.scene.fog = new THREE.FogExp2(chapter.fogColor, chapter.fogDensity);

    this.env = buildEnvironment(
      this.launchConfig.chapterId,
      this.launchConfig.mode,
      this.renderer.capabilities.getMaxAnisotropy()
    );
    this.scene.add(this.env.group);

    // Player stats scaled by upgrades
    this.maxHealth = 100 + (this.save.upgrades.vitalityLevel - 1) * 25;
    this.health = this.maxHealth;
    this.maxEnergy = 100 + (this.save.upgrades.enduranceLevel - 1) * 20;
    this.energy = this.maxEnergy;

    this.px = this.env.playerStart.x;
    this.pz = this.env.playerStart.z;
    this.py = 0;

    // Build Hunter 3D model
    this.hunterRig = buildHunterModel(this.save.character, this.shadowTex);
    this.hunterRig.root.position.set(this.px, 0, this.pz);
    this.scene.add(this.hunterRig.root);
    this.updateCameraVisibilityForMode();

    // Rain particle field for outdoor rain chapters
    if (chapter.hasRain) {
      const count = 900;
      const positions = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 60;
        positions[i * 3 + 1] = Math.random() * 24;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
      }
      const rainGeo = new THREE.BufferGeometry();
      rainGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const rainMat = new THREE.PointsMaterial({
        color: 0x94a3b8,
        size: 0.12,
        transparent: true,
        opacity: 0.52,
      });
      this.rainPoints = new THREE.Points(rainGeo, rainMat);
      this.scene.add(this.rainPoints);
    }

    this.audio.setEnvironmentAudio(chapter.hasRain, chapter.isIndoor);
    this.spawnInitialMonsters();
    this.showBanner(`${chapter.title} · ${this.launchConfig.mode.toUpperCase()}`, 4.2);
  }

  private spawnInitialMonsters(): void {
    const { mode, chapterId, huntTarget, bossTarget } = this.launchConfig;
    if (mode === 'boss') {
      const target = bossTarget || (chapterId === 'citadel' ? 'boss_sovereign' : 'boss_warden');
      this.spawnMonster(target, 0, -18, true);
      this.bossSpawned = true;
      return;
    }

    if (mode === 'hunt') {
      const target = huntTarget || 'night_stalker';
      this.spawnMonster(target, -14, -18, true);
      this.spawnMonster('shadow_creature', 16, -14, false);
      this.spawnMonster('shadow_creature', -18, 6, false);
      return;
    }

    if (mode === 'exploration') {
      // Sparse ambient roamers so exploration feels tense yet peaceful
      this.spawnMonster('shadow_creature', -22, -20, false);
      this.spawnMonster('night_stalker', 22, -20, false);
      return;
    }

    if (mode === 'survival') {
      this.spawnWave(1);
      return;
    }

    // Story Mode spawns per chapter
    if (chapterId === 'city') {
      this.spawnMonster('night_stalker', -16, -18, false);
      this.spawnMonster('night_stalker', 18, -16, false);
      this.spawnMonster('shadow_creature', -20, 8, false);
      this.spawnMonster('shadow_creature', 20, 10, false);
      this.spawnMonster('night_stalker', 0, -24, false);
    } else if (chapterId === 'hospital') {
      this.spawnMonster('shadow_creature', -16, -12, false);
      this.spawnMonster('night_stalker', 18, -12, false);
      this.spawnMonster('mutated_beast', 0, -16, true);
    } else if (chapterId === 'forest') {
      for (let i = 0; i < 7; i++) {
        const pt = this.env!.spawnPoints[i % this.env!.spawnPoints.length];
        this.spawnMonster(i % 3 === 0 ? 'night_stalker' : 'shadow_creature', pt.x, pt.y, false);
      }
    } else if (chapterId === 'underground') {
      this.spawnMonster('underground_horror', -18, -16, false);
      this.spawnMonster('underground_horror', 18, -16, false);
      this.spawnMonster('underground_horror', -18, 16, false);
      this.spawnMonster('underground_horror', 18, 16, false);
      this.spawnMonster('shadow_creature', 0, -22, false);
      this.spawnMonster('shadow_creature', 0, 0, false);
      this.spawnMonster('boss_warden', 0, -26, true);
      this.bossSpawned = true;
    } else {
      this.spawnMonster('night_stalker', -16, -12, false);
      this.spawnMonster('mutated_beast', 16, -12, false);
      this.spawnMonster('boss_sovereign', 0, -22, true);
      this.bossSpawned = true;
    }
  }

  private spawnWave(wave: number): void {
    const count = 3 + wave * 2;
    const pool: MonsterCategoryId[] = ['shadow_creature', 'night_stalker', 'mutated_beast', 'underground_horror'];
    for (let i = 0; i < count; i++) {
      const pt = this.env!.spawnPoints[i % this.env!.spawnPoints.length];
      const cat = i === 0 && wave % 3 === 0 ? 'boss_warden' : pool[(i + wave) % pool.length];
      this.spawnMonster(
        cat,
        pt.x + (Math.random() - 0.5) * 4,
        pt.y + (Math.random() - 0.5) * 4,
        cat.startsWith('boss')
      );
    }
    this.showBanner(`Survival Wave ${wave} Incoming`, 3.0);
  }

  private spawnMonster(category: MonsterCategoryId, x: number, z: number, isBoss: boolean): void {
    const def = MONSTERS[category];
    const rig = buildMonsterModel(category, this.shadowTex);
    rig.root.position.set(x, 0, z);
    this.scene.add(rig.root);

    const scaleBoost = this.launchConfig.mode === 'survival' ? 1 + (this.waveNumber - 1) * 0.14 : 1;
    const hp = Math.round(def.baseHealth * scaleBoost);

    this.monsters.push({
      id: `${category}_${Math.random().toString(36).slice(2, 8)}`,
      category,
      rig,
      x,
      z,
      vx: 0,
      vz: 0,
      yaw: 0,
      health: hp,
      maxHealth: hp,
      speed: def.speed,
      damage: def.damage,
      attackRange: def.attackRange,
      detectRange: def.detectRange,
      attackCooldown: 0.8,
      attackAnim: 0,
      stunTimer: 0,
      hitFlash: 0,
      banishProgress: 0,
      dead: false,
      isBoss,
      specialCooldown: 4.5,
      stepTimer: 0.3,
    });
  }

  private showBanner(text: string, duration = 3.2): void {
    this.bannerMessage = text;
    this.bannerTimer = duration;
  }

  private updateCameraVisibilityForMode(): void {
    if (!this.hunterRig) return;
    this.hunterRig.bodyGroup.visible = this.cameraMode === 'third_person';
  }

  public toggleCameraMode(): void {
    this.cameraMode = this.cameraMode === 'third_person' ? 'first_person' : 'third_person';
    this.updateCameraVisibilityForMode();
    this.showBanner(this.cameraMode === 'first_person' ? 'First-Person View' : 'Third-Person View', 1.6);
    this.pushHud();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused && document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    if (!paused) {
      this.clock.getDelta();
    }
  }

  public updateSettings(next: PlayerSaveData['settings']): void {
    this.save = { ...this.save, settings: next };
    this.audio.updateSettings(next);
  }

  public setVirtualJoystick(x: number, y: number): void {
    this.joyX = Math.max(-1, Math.min(1, x));
    this.joyY = Math.max(-1, Math.min(1, y));
  }

  public triggerTouchLook(dx: number, dy: number): void {
    const sens = 0.0045 * this.save.settings.mouseSensitivity;
    this.yaw -= dx * sens;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dy * sens, -0.45, 0.85);
  }

  public triggerJump(): void {
    if (this.paused || this.outcome || this.activePuzzleInteractable) return;
    this.audio.unlock();
    if (this.grounded) {
      this.vy = 8.4;
      this.grounded = false;
    }
  }

  public triggerAttack(): void {
    if (this.paused || this.outcome || this.activePuzzleInteractable) return;
    this.audio.unlock();
    if (this.attackCooldown > 0) return;

    const weapon = WEAPONS.find((w) => w.id === this.save.character.equippedWeapon) ?? WEAPONS[0];
    if (this.energy < weapon.energyCost) {
      this.showBanner('Low Energy — Strike with Arcane Edge or wait to recharge', 1.5);
      return;
    }

    this.energy -= weapon.energyCost;
    this.attackCooldown = weapon.cooldown;
    this.attackAnim = 1.0;
    this.audio.playAttack(weapon.id);

    const dmgScale = 1 + (this.save.upgrades.lethalityLevel - 1) * 0.16;
    const finalDmg = Math.round(weapon.damage * dmgScale);
    const forwardX = -Math.sin(this.yaw);
    const forwardZ = -Math.cos(this.yaw);

    if (weapon.type === 'Ranged' || weapon.type === 'Precision Lance') {
      const boltColor = new THREE.Color(weapon.accentHex);
      const boltGeo =
        weapon.id === 'aegis_lance'
          ? new THREE.CylinderGeometry(0.08, 0.08, 1.2, 8)
          : new THREE.SphereGeometry(0.16, 8, 8);
      if (weapon.id === 'aegis_lance') boltGeo.rotateX(Math.PI / 2);
      const boltMat = new THREE.MeshBasicMaterial({ color: boltColor });
      const mesh = new THREE.Mesh(boltGeo, boltMat);
      mesh.position.set(this.px + forwardX * 0.8, this.py + 1.35, this.pz + forwardZ * 0.8);
      mesh.rotation.y = this.yaw;
      this.scene.add(mesh);

      const speed = weapon.id === 'aegis_lance' ? 42 : 30;
      this.projectiles.push({
        mesh,
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
        vx: forwardX * speed,
        vy: -Math.sin(this.pitch) * speed * 0.35,
        vz: forwardZ * speed,
        damage: finalDmg,
        fromPlayer: true,
        life: 1.3,
        radius: weapon.id === 'aegis_lance' ? 1.15 : 0.85,
      });
    } else {
      // Melee slash wave + immediate arc hit detection
      this.spawnBurst(this.px + forwardX * 1.8, this.py + 1.2, this.pz + forwardZ * 1.8, weapon.accentHex, 2.2);
      let hits = 0;
      for (const m of this.monsters) {
        if (m.dead) continue;
        const dx = m.x - this.px;
        const dz = m.z - this.pz;
        const dist = Math.hypot(dx, dz);
        if (dist <= weapon.range + (m.isBoss ? 0.9 : 0.35)) {
          const dot = (dx / (dist || 1)) * forwardX + (dz / (dist || 1)) * forwardZ;
          if (dot > 0.1 || dist < 1.8) {
            this.damageMonster(m, finalDmg, weapon.id === 'umbral_scythe');
            hits++;
          }
        }
      }
      if (hits > 0 && weapon.id === 'arcane_edge') {
        this.energy = Math.min(this.maxEnergy, this.energy + hits * 8);
      }
      if (hits > 0 && weapon.id === 'umbral_scythe') {
        this.health = Math.min(this.maxHealth, this.health + hits * 6);
      }
    }
  }

  public triggerDodge(): void {
    if (this.paused || this.outcome || this.activePuzzleInteractable) return;
    this.audio.unlock();
    if (this.dodgeCooldown > 0 || this.energy < 18) return;

    this.energy -= 18;
    this.dodgeTimer = 0.28;
    this.dodgeCooldown = 0.85;
    this.invulnTimer = 0.36;

    const move = this.getDesiredMoveVector();
    if (move.len > 0.1) {
      this.dodgeDirX = move.x;
      this.dodgeDirZ = move.z;
    } else {
      this.dodgeDirX = -Math.sin(this.yaw);
      this.dodgeDirZ = -Math.cos(this.yaw);
    }
    this.spawnBurst(this.px, 0.8, this.pz, '#38BDF8', 1.6);
  }

  public triggerFlare(): void {
    if (this.paused || this.outcome || this.activePuzzleInteractable) return;
    this.audio.unlock();
    if (this.flareCooldown > 0) return;

    const radius = 8.5 + (this.save.upgrades.lanternLevel - 1) * 1.8;
    const stunDuration = 2.4 + (this.save.upgrades.lanternLevel - 1) * 0.45;
    this.flareCooldown = 7.0;
    this.audio.playFlare();
    this.spawnBurst(this.px, 1.1, this.pz, '#F59E0B', radius * 0.9);

    let stunned = 0;
    for (const m of this.monsters) {
      if (m.dead) continue;
      const dist = Math.hypot(m.x - this.px, m.z - this.pz);
      if (dist <= radius) {
        m.stunTimer = Math.max(m.stunTimer, stunDuration);
        this.damageMonster(m, 22, false);
        stunned++;
      }
    }
    this.showBanner(stunned > 0 ? `Lantern Flare stunned ${stunned} monster(s)!` : 'Lantern Flare pulsed!', 2.0);
  }

  public triggerHeal(): void {
    if (this.paused || this.outcome) return;
    this.audio.unlock();
    if (this.healCharges <= 0 || this.health >= this.maxHealth) return;
    this.healCharges--;
    this.health = Math.min(this.maxHealth, this.health + Math.round(this.maxHealth * 0.45));
    this.audio.playDiscover();
    this.spawnBurst(this.px, 1.0, this.pz, '#10B981', 1.8);
    this.showBanner('Field Med-Injector Applied', 1.8);
    this.pushHud();
  }

  public triggerInteract(): void {
    if (this.paused || this.outcome || this.activePuzzleInteractable || !this.env) return;
    this.audio.unlock();

    let closest: WorldInteractable | null = null;
    let bestDist = Infinity;
    for (const item of this.env.interactables) {
      if (item.completed) continue;
      const d = Math.hypot(item.x - this.px, item.z - this.pz);
      if (d <= item.radius && d < bestDist) {
        bestDist = d;
        closest = item;
      }
    }
    if (!closest) return;

    if (closest.kind === 'puzzle_circuit' || closest.kind === 'puzzle_runes') {
      this.activePuzzleInteractable = closest;
      if (document.pointerLockElement === this.renderer.domElement) {
        document.exitPointerLock();
      }
      this.pushHud();
      return;
    }

    this.completeInteractable(closest);
  }

  public completeActivePuzzle(): void {
    if (!this.activePuzzleInteractable) return;
    const target = this.activePuzzleInteractable;
    this.activePuzzleInteractable = null;
    this.completeInteractable(target);
    this.pushHud();
  }

  public cancelActivePuzzle(): void {
    this.activePuzzleInteractable = null;
    this.pushHud();
  }

  private completeInteractable(item: WorldInteractable): void {
    item.completed = true;
    this.audio.playDiscover();

    if (item.kind === 'supply') {
      this.health = Math.min(this.maxHealth, this.health + 40);
      this.energy = this.maxEnergy;
      this.healCharges = Math.min(4, this.healCharges + 1);
      item.mesh.visible = false;
      this.showBanner('Supply Cache Collected: Health & Energy Restored', 2.4);
    } else if (item.kind === 'survivor') {
      this.rescuesThisRun++;
      this.shardsEarned += 35;
      this.xpEarned += 60;
      item.mesh.visible = false;
      this.showBanner('Survivor Evacuated Safely (+35 Shards)', 2.8);
    } else if (item.kind === 'clue') {
      this.cluesThisRun++;
      this.shardsEarned += 25;
      this.xpEarned += 45;
      item.mesh.visible = false;
      this.showBanner('Clue & Research Data Logged (+25 Shards)', 2.5);
    } else if (item.kind === 'beacon' || item.kind === 'anchor') {
      this.beaconsDone++;
      this.shardsEarned += 30;
      this.xpEarned += 50;
      if (item.light) {
        item.light.color.setHex(0x10b981);
        item.light.intensity = 4.2;
      }
      this.spawnBurst(item.x, 2.2, item.z, item.kind === 'anchor' ? '#F43F5E' : '#10B981', 3.4);
      this.showBanner(item.kind === 'anchor' ? 'Eclipse Anchor Shattered!' : 'Beacon Online!', 2.5);
    } else if (item.kind === 'puzzle_circuit' || item.kind === 'puzzle_runes') {
      this.puzzlesDone++;
      this.shardsEarned += 60;
      this.xpEarned += 90;
      if (item.light) {
        item.light.color.setHex(0x10b981);
        item.light.intensity = 4.5;
      }
      this.spawnBurst(item.x, 2.4, item.z, '#38BDF8', 3.8);
      this.showBanner('Security Seal Solved (+60 Shards)!', 2.8);
    }

    this.checkMissionCompletion();
    this.pushHud();
  }

  private damageMonster(m: ActiveMonster, amount: number, heavy: boolean): void {
    if (m.dead) return;
    m.health = Math.max(0, m.health - amount);
    m.hitFlash = 0.16;
    this.audio.playHit(heavy || m.isBoss);
    this.spawnBurst(m.x, 1.3, m.z, MONSTERS[m.category].accentHex, m.isBoss ? 2.6 : 1.7);

    if (m.health <= 0) {
      m.dead = true;
      m.banishProgress = 0.01;
      const def = MONSTERS[m.category];
      this.killsThisRun++;
      this.killsByType[m.category] = (this.killsByType[m.category] || 0) + 1;
      this.shardsEarned += def.shardReward;
      this.xpEarned += def.xpReward;
      if (m.isBoss) {
        this.bossDefeated = true;
        this.showBanner(`${def.name} Banished! (+${def.shardReward} Shards)`, 3.5);
      }
      this.checkMissionCompletion();
    }
  }

  private spawnBurst(x: number, y: number, z: number, hex: string, expandSpeed = 3): void {
    const geo = new THREE.SphereGeometry(0.28, 10, 10);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(hex),
      transparent: true,
      opacity: 0.78,
      wireframe: true,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.bursts.push({ mesh, life: 0.34, maxLife: 0.34, expandSpeed });
  }

  private checkMissionCompletion(): void {
    if (this.outcome) return;
    const objs = this.computeObjectives();
    if (objs.length > 0 && objs.every((o) => o.completed)) {
      const chapter = getChapterById(this.launchConfig.chapterId);
      const bonusShards = this.launchConfig.mode === 'story' ? chapter.rewardShards : 120;
      const bonusXp = this.launchConfig.mode === 'story' ? chapter.rewardXp : 180;
      this.shardsEarned += bonusShards;
      this.xpEarned += bonusXp;

      this.finishRun(true, `${chapter.title} Cleared`, 'All objectives completed. Dawn edges closer across the district.');
    }
  }

  private finishRun(victory: boolean, title: string, summary: string): void {
    if (this.outcome) return;
    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }
    if (victory) this.audio.playVictory();
    else this.audio.playDefeat();

    this.outcome = {
      victory,
      title,
      summary,
      shardsEarned: this.shardsEarned,
      xpEarned: this.xpEarned,
      kills: this.killsThisRun,
      rescues: this.rescuesThisRun,
      clues: this.cluesThisRun,
    };

    this.onRunReward({
      xp: this.xpEarned,
      shards: this.shardsEarned,
      killsByType: this.killsByType,
      rescues: this.rescuesThisRun,
      clues: this.cluesThisRun,
      completedChapter: victory && this.launchConfig.mode === 'story' ? this.launchConfig.chapterId : undefined,
      survivalWave: this.launchConfig.mode === 'survival' ? this.waveNumber : undefined,
      victory,
    });
    this.pushHud();
  }

  private computeObjectives() {
    const { mode, chapterId, huntTarget, bossTarget } = this.launchConfig;
    if (mode === 'boss') {
      const bossName = MONSTERS[bossTarget || (chapterId === 'citadel' ? 'boss_sovereign' : 'boss_warden')].name;
      return [{ id: 'boss', label: `Defeat ${bossName}`, current: this.bossDefeated ? 1 : 0, target: 1, completed: this.bossDefeated }];
    }
    if (mode === 'hunt') {
      const targetName = MONSTERS[huntTarget || 'night_stalker'].name;
      return [{ id: 'hunt', label: `Track & Banish ${targetName}`, current: this.bossDefeated ? 1 : 0, target: 1, completed: this.bossDefeated }];
    }
    if (mode === 'exploration') {
      return [
        {
          id: 'explore_clues',
          label: 'Discover Hidden Lore Clues',
          current: Math.min(5, this.cluesThisRun),
          target: 5,
          completed: this.cluesThisRun >= 5,
        },
      ];
    }
    if (mode === 'survival') {
      return [
        {
          id: 'survive_waves',
          label: `Survive Monster Waves (Wave ${this.waveNumber})`,
          current: this.killsThisRun,
          target: 999,
          completed: false,
        },
      ];
    }

    // Story Chapter Objectives
    if (chapterId === 'city') {
      return [
        { id: 'c1_beacons', label: 'Activate Signal Beacons', current: Math.min(3, this.beaconsDone), target: 3, completed: this.beaconsDone >= 3 },
        { id: 'c1_rescues', label: 'Rescue Trapped Survivors', current: Math.min(2, this.rescuesThisRun), target: 2, completed: this.rescuesThisRun >= 2 },
        { id: 'c1_kills', label: 'Eliminate Stalking Creatures', current: Math.min(5, this.killsThisRun), target: 5, completed: this.killsThisRun >= 5 },
      ];
    }
    if (chapterId === 'hospital') {
      return [
        { id: 'c2_circuit', label: 'Restore Backup Generator (Circuit)', current: Math.min(1, this.puzzlesDone), target: 1, completed: this.puzzlesDone >= 1 },
        { id: 'c2_clues', label: 'Recover Patient Research Logs', current: Math.min(3, this.cluesThisRun), target: 3, completed: this.cluesThisRun >= 3 },
        { id: 'c2_boss', label: 'Purge the Osseous Juggernaut', current: this.bossDefeated ? 1 : 0, target: 1, completed: this.bossDefeated },
      ];
    }
    if (chapterId === 'forest') {
      return [
        { id: 'c3_runes', label: 'Unlock Moon Monolith Seal', current: Math.min(1, this.puzzlesDone), target: 1, completed: this.puzzlesDone >= 1 },
        { id: 'c3_clues', label: 'Discover Expedition Relics', current: Math.min(3, this.cluesThisRun), target: 3, completed: this.cluesThisRun >= 3 },
        { id: 'c3_kills', label: 'Banish Shadow Creatures', current: Math.min(7, this.killsThisRun), target: 7, completed: this.killsThisRun >= 7 },
      ];
    }
    if (chapterId === 'underground') {
      return [
        { id: 'c4_locks', label: 'Override Containment Locks', current: Math.min(3, this.beaconsDone), target: 3, completed: this.beaconsDone >= 3 },
        { id: 'c4_clues', label: 'Extract Classified Dossiers', current: Math.min(3, this.cluesThisRun), target: 3, completed: this.cluesThisRun >= 3 },
        { id: 'c4_boss', label: 'Defeat The Dread Warden', current: this.bossDefeated ? 1 : 0, target: 1, completed: this.bossDefeated },
      ];
    }
    return [
      { id: 'c5_anchors', label: 'Shatter Eclipse Anchors', current: Math.min(3, this.beaconsDone), target: 3, completed: this.beaconsDone >= 3 },
      { id: 'c5_rescue', label: 'Rescue Fallen Sentinel', current: Math.min(1, this.rescuesThisRun), target: 1, completed: this.rescuesThisRun >= 1 },
      { id: 'c5_boss', label: 'Defeat The Eclipse Sovereign', current: this.bossDefeated ? 1 : 0, target: 1, completed: this.bossDefeated },
    ];
  }

  private getDesiredMoveVector(): { x: number; z: number; len: number } {
    let forward = 0;
    let strafe = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) strafe += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) strafe -= 1;

    forward += -this.joyY;
    strafe += this.joyX;

    const len = Math.hypot(forward, strafe);
    if (len < 0.01) return { x: 0, z: 0, len: 0 };

    const nf = forward / Math.max(1, len);
    const ns = strafe / Math.max(1, len);
    const sinY = Math.sin(this.yaw);
    const cosY = Math.cos(this.yaw);
    const wx = -sinY * nf + cosY * ns;
    const wz = -cosY * nf - sinY * ns;
    return { x: wx, z: wz, len: Math.min(1, len) };
  }

  private resolveCollisions(x: number, z: number, radius: number): { x: number; z: number } {
    if (!this.env) return { x, z };
    const limit = this.launchConfig.chapterId === 'hospital' || this.launchConfig.chapterId === 'underground' ? 32.5 : this.env.arenaRadius;
    let rx = THREE.MathUtils.clamp(x, -limit, limit);
    let rz = THREE.MathUtils.clamp(z, -limit, limit);

    for (const c of this.env.colliders) {
      const closestX = THREE.MathUtils.clamp(rx, c.minX, c.maxX);
      const closestZ = THREE.MathUtils.clamp(rz, c.minZ, c.maxZ);
      const dx = rx - closestX;
      const dz = rz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq < radius * radius) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.0001) {
          const push = radius - dist;
          rx += (dx / dist) * push;
          rz += (dz / dist) * push;
        } else {
          rx += radius;
        }
      }
    }
    return { x: rx, z: rz };
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDelta = this.clock.getDelta();
    const dt = Math.min(0.05, rawDelta);

    if (!this.paused && !this.outcome && !this.contextLost) {
      this.updateSimulation(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateSimulation(dt: number): void {
    this.elapsed += dt;

    // Cooldowns & regeneration
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    this.attackAnim = Math.max(0, this.attackAnim - dt * 3.4);
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
    this.flareCooldown = Math.max(0, this.flareCooldown - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.bannerMessage = null;
    }

    const regenRate = 12 + (this.save.upgrades.enduranceLevel - 1) * 3.5;
    this.energy = Math.min(this.maxEnergy, this.energy + regenRate * dt);

    // Player Movement
    let currentSpeed = 0;
    const isSprinting = Boolean(this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.energy > 4;

    if (!this.activePuzzleInteractable) {
      if (this.dodgeTimer > 0) {
        this.dodgeTimer -= dt;
        const next = this.resolveCollisions(this.px + this.dodgeDirX * 15 * dt, this.pz + this.dodgeDirZ * 15 * dt, 0.55);
        this.px = next.x;
        this.pz = next.z;
        currentSpeed = 14;
      } else {
        const move = this.getDesiredMoveVector();
        if (move.len > 0.05) {
          const baseSpeed = isSprinting ? 10.2 : 6.6;
          if (isSprinting) this.energy = Math.max(0, this.energy - 11 * dt);
          const next = this.resolveCollisions(this.px + move.x * baseSpeed * dt, this.pz + move.z * baseSpeed * dt, 0.55);
          this.px = next.x;
          this.pz = next.z;
          currentSpeed = baseSpeed * move.len;

          if (this.grounded) {
            this.playerStepTimer -= dt;
            if (this.playerStepTimer <= 0) {
              this.playerStepTimer = isSprinting ? 0.28 : 0.44;
              this.audio.playFootstep(false, 0.7);
            }
          }
        }
      }
    }

    // Jump & gravity
    if (!this.grounded || this.vy !== 0) {
      this.vy -= 21 * dt;
      this.py += this.vy * dt;
      if (this.py <= 0) {
        this.py = 0;
        this.vy = 0;
        this.grounded = true;
      }
    }

    // Update Hunter Rig
    if (this.hunterRig) {
      this.hunterRig.root.position.set(this.px, this.py, this.pz);
      this.hunterRig.root.rotation.y = this.yaw;
      animateHunterRig(this.hunterRig, {
        moveSpeed: currentSpeed,
        isSprinting,
        isGrounded: this.grounded,
        attackProgress: this.attackAnim,
        dodgeProgress: this.dodgeTimer > 0 ? 1 - this.dodgeTimer / 0.28 : 0,
        elapsed: this.elapsed,
      });
    }

    // Update Camera smoothly
    if (this.cameraMode === 'first_person') {
      _camGoal.set(this.px, this.py + 1.66, this.pz);
      this.camera.position.lerp(_camGoal, 1 - Math.exp(-26 * dt));
      _camTarget.set(
        this.px - Math.sin(this.yaw) * Math.cos(this.pitch) * 10,
        this.py + 1.66 - Math.sin(this.pitch) * 10,
        this.pz - Math.cos(this.yaw) * Math.cos(this.pitch) * 10
      );
      this.camera.lookAt(_camTarget);
    } else {
      const camDist = 5.4;
      const offsetX = Math.sin(this.yaw) * Math.cos(this.pitch) * camDist + Math.cos(this.yaw) * 0.65;
      const offsetY = 2.0 + Math.sin(this.pitch) * camDist;
      const offsetZ = Math.cos(this.yaw) * Math.cos(this.pitch) * camDist - Math.sin(this.yaw) * 0.65;

      const clampedCam = this.resolveCollisions(this.px + offsetX, this.pz + offsetZ, 0.35);
      _camGoal.set(clampedCam.x, Math.max(0.75, this.py + offsetY), clampedCam.z);
      this.camera.position.lerp(_camGoal, 1 - Math.exp(-14 * dt));
      _camTarget.set(this.px, this.py + 1.45, this.pz);
      this.camera.lookAt(_camTarget);
    }

    // Update Monsters AI
    let nearestDist: number | null = null;
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      if (m.dead) {
        m.banishProgress += dt * 1.9;
        animateMonsterRig(m.rig, {
          category: m.category,
          speed: 0,
          attacking: 0,
          stunned: false,
          hitFlash: 0,
          elapsed: this.elapsed,
          banishProgress: m.banishProgress,
        });
        if (m.banishProgress >= 1) {
          this.scene.remove(m.rig.root);
          this.monsters.splice(i, 1);
        }
        continue;
      }

      const dx = this.px - m.x;
      const dz = this.pz - m.z;
      const dist = Math.hypot(dx, dz);
      if (nearestDist === null || dist < nearestDist) nearestDist = dist;

      m.hitFlash = Math.max(0, m.hitFlash - dt);
      m.attackCooldown = Math.max(0, m.attackCooldown - dt);
      m.attackAnim = Math.max(0, m.attackAnim - dt * 2.5);
      m.specialCooldown -= dt;

      if (m.stunTimer > 0) {
        m.stunTimer -= dt;
      } else {
        // Face player
        const targetYaw = Math.atan2(dx, dz);
        m.yaw = targetYaw;
        m.rig.root.rotation.y = m.yaw;

        // Movement pattern by category
        let moveSpeed = m.speed;
        const dirX = dx / (dist || 1);
        const dirZ = dz / (dist || 1);

        if (m.category === 'underground_horror' && dist < m.attackRange && dist > 4.5) {
          // Ranged spore fire
          moveSpeed = 0;
          if (m.attackCooldown <= 0) {
            m.attackCooldown = 2.1;
            m.attackAnim = 1;
            this.fireMonsterProjectile(m, dirX, dirZ, '#10B981');
          }
        } else if (dist > m.attackRange * 0.85) {
          // Shadow creatures weave slightly while flanking
          const flank = m.category === 'shadow_creature' ? Math.sin(this.elapsed * 3.5 + i) * 0.45 : 0;
          const vx = (dirX - dirZ * flank) * moveSpeed;
          const vz = (dirZ + dirX * flank) * moveSpeed;
          const next = this.resolveCollisions(m.x + vx * dt, m.z + vz * dt, m.isBoss ? 1.1 : 0.65);
          m.x = next.x;
          m.z = next.z;

          m.stepTimer -= dt;
          if (m.stepTimer <= 0 && dist < 24) {
            m.stepTimer = m.category === 'mutated_beast' || m.isBoss ? 0.55 : 0.36;
            this.audio.playFootstep(true, Math.max(0.15, 1 - dist / 24));
          }
        } else if (m.attackCooldown <= 0) {
          m.attackCooldown = m.isBoss ? 1.45 : 1.35;
          m.attackAnim = 1;
          this.audio.playMonsterGrowl(m.category);
          if (this.invulnTimer <= 0 && dist <= m.attackRange + 0.6) {
            this.hurtPlayer(m.damage);
          }
        }

        // Boss special shockwave / projectile attack
        if (m.isBoss && m.specialCooldown <= 0 && dist < 24) {
          m.specialCooldown = m.category === 'boss_sovereign' ? 5.2 : 6.8;
          this.audio.playMonsterGrowl(m.category);
          this.spawnBurst(m.x, 1.0, m.z, '#EF4444', 5.2);
          this.fireMonsterProjectile(m, dirX, dirZ, '#F43F5E');
          if (m.category === 'boss_sovereign' && this.monsters.length < 5) {
            this.spawnMonster('shadow_creature', m.x + 3.5, m.z + 2, false);
          }
        }
      }

      m.rig.root.position.set(m.x, 0, m.z);
      animateMonsterRig(m.rig, {
        category: m.category,
        speed: m.stunTimer > 0 ? 0 : m.speed,
        attacking: m.attackAnim,
        stunned: m.stunTimer > 0,
        hitFlash: m.hitFlash,
        elapsed: this.elapsed + i * 0.7,
        banishProgress: 0,
      });
    }

    // Survival Mode Wave Progression
    if (this.launchConfig.mode === 'survival') {
      const aliveCount = this.monsters.filter((m) => !m.dead).length;
      if (aliveCount === 0) {
        this.survivalSpawnTimer -= dt;
        if (this.survivalSpawnTimer <= 0) {
          this.waveNumber++;
          this.survivalSpawnTimer = 2.5;
          this.shardsEarned += 40;
          this.xpEarned += 75;
          this.spawnWave(this.waveNumber);
        }
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.mesh.position.set(p.x, p.y, p.z);

      let hit = false;
      if (p.fromPlayer) {
        for (const m of this.monsters) {
          if (m.dead) continue;
          const d = Math.hypot(m.x - p.x, m.z - p.z);
          if (d <= p.radius + (m.isBoss ? 1.1 : 0.65)) {
            this.damageMonster(m, p.damage, false);
            hit = true;
            break;
          }
        }
      } else {
        const d = Math.hypot(this.px - p.x, this.pz - p.z);
        if (d <= p.radius + 0.55 && this.invulnTimer <= 0) {
          this.hurtPlayer(p.damage);
          hit = true;
        }
      }

      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // Update Visual Bursts
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      const t = 1 - b.life / b.maxLife;
      b.mesh.scale.setScalar(1 + t * b.expandSpeed * 2.2);
      (b.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, 0.78 * (1 - t));
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        (b.mesh.material as THREE.Material).dispose();
        this.bursts.splice(i, 1);
      }
    }

    // Update Environment Lighting, Rain & Lightning
    if (this.env) {
      for (const fl of this.env.flickerLights) {
        const flicker = Math.sin(this.elapsed * 9 + fl.phase) * Math.sin(this.elapsed * 23 + fl.phase);
        fl.light.intensity = fl.baseIntensity * (flicker > 0.65 ? 0.35 : 0.9 + flicker * 0.12);
      }
      for (const item of this.env.interactables) {
        if (!item.completed && (item.kind === 'beacon' || item.kind === 'anchor' || item.kind === 'clue')) {
          item.mesh.children.forEach((ch) => {
            if (ch.name === 'beaconCore') ch.rotation.y += dt * 1.8;
          });
        }
      }
    }

    if (this.rainPoints) {
      const posAttr = this.rainPoints.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < posAttr.count; i++) {
        let y = posAttr.getY(i) - 22 * dt;
        if (y < 0) y = 24;
        posAttr.setY(i, y);
      }
      posAttr.needsUpdate = true;
      this.rainPoints.position.set(this.px, 0, this.pz);
    }

    const chapter = getChapterById(this.launchConfig.chapterId);
    if (chapter.hasLightning) {
      this.lightningTimer -= dt;
      if (this.lightningTimer <= 0) {
        this.lightningTimer = 7 + Math.random() * 11;
        this.ambientFlash = 2.6;
        this.audio.playThunder();
      }
      if (this.ambientFlash > 0) {
        this.ambientFlash = Math.max(0, this.ambientFlash - dt * 7);
        this.lightningLight.intensity = this.ambientFlash;
      }
    }

    // Dynamic Audio Threat Tension
    const threat = nearestDist !== null ? THREE.MathUtils.clamp(1 - nearestDist / 26, 0, 1) : 0;
    this.audio.setThreatLevel(threat, dt);

    // Throttled HUD sync (~20Hz)
    this.hudThrottle -= dt;
    if (this.hudThrottle <= 0) {
      this.hudThrottle = 0.05;
      this.pushHud(nearestDist);
    }
  }

  private fireMonsterProjectile(m: ActiveMonster, dirX: number, dirZ: number, hex: string): void {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.24, 8, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(hex) })
    );
    mesh.position.set(m.x + dirX * 0.9, 1.35, m.z + dirZ * 0.9);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      x: mesh.position.x,
      y: mesh.position.y,
      z: mesh.position.z,
      vx: dirX * 15,
      vy: 0,
      vz: dirZ * 15,
      damage: Math.round(m.damage * 0.8),
      fromPlayer: false,
      life: 2.2,
      radius: 0.55,
    });
  }

  private hurtPlayer(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.invulnTimer = 0.45;
    this.audio.playPlayerHurt();
    this.spawnBurst(this.px, 1.2, this.pz, '#EF4444', 1.8);
    if (this.health <= 0) {
      this.finishRun(false, 'Fallen in the Night', 'The darkness overwhelmed your lantern. Upgrade gear and return to the hunt.');
    }
  }

  private pushHud(nearestDist: number | null = null): void {
    let interactPrompt: string | null = null;
    const radarBlips: RadarBlip[] = [];
    const radarRange = 36;
    const cosY = Math.cos(this.yaw);
    const sinY = Math.sin(this.yaw);

    const toRadar = (wx: number, wz: number, kind: RadarBlip['kind']) => {
      const dx = wx - this.px;
      const dz = wz - this.pz;
      const dist = Math.hypot(dx, dz);
      if (dist > radarRange) return;
      const rx = (dx * cosY - dz * sinY) / radarRange;
      const rz = (dx * sinY + dz * cosY) / radarRange;
      radarBlips.push({ x: rx, z: rz, kind });
    };

    if (this.env) {
      let bestDist = Infinity;
      for (const item of this.env.interactables) {
        if (item.completed) continue;
        toRadar(
          item.x,
          item.z,
          item.kind === 'survivor' ? 'survivor' : item.kind === 'clue' ? 'clue' : item.kind === 'supply' ? 'supply' : 'objective'
        );
        const d = Math.hypot(item.x - this.px, item.z - this.pz);
        if (d <= item.radius && d < bestDist) {
          bestDist = d;
          interactPrompt = item.label;
        }
      }
    }

    let bossInfo: GameHudSnapshot['bossInfo'] = null;
    for (const m of this.monsters) {
      if (m.dead) continue;
      toRadar(m.x, m.z, m.isBoss ? 'boss' : 'monster');
      if (m.isBoss) {
        const def = MONSTERS[m.category];
        bossInfo = {
          name: def.name,
          category: def.category,
          health: m.health,
          maxHealth: m.maxHealth,
        };
      }
    }

    this.onHudUpdate({
      health: Math.ceil(this.health),
      maxHealth: this.maxHealth,
      energy: Math.round(this.energy),
      maxEnergy: this.maxEnergy,
      healCharges: this.healCharges,
      flareCooldown: Number(this.flareCooldown.toFixed(1)),
      flareMaxCooldown: 7.0,
      dodgeCooldown: Number(this.dodgeCooldown.toFixed(1)),
      cameraMode: this.cameraMode,
      pointerLocked: this.pointerLocked,
      objectives: this.computeObjectives(),
      interactPrompt,
      bossInfo,
      nearestThreatDist: nearestDist !== null ? Math.round(nearestDist) : null,
      waveNumber: this.waveNumber,
      killsThisRun: this.killsThisRun,
      cluesThisRun: this.cluesThisRun,
      rescuesThisRun: this.rescuesThisRun,
      shardsEarnedThisRun: this.shardsEarned,
      xpEarnedThisRun: this.xpEarned,
      elapsedSeconds: Math.floor(this.elapsed),
      bannerMessage: this.bannerMessage,
      radarBlips,
      playerYaw: this.yaw,
      activePuzzle: this.activePuzzleInteractable
        ? {
            id: this.activePuzzleInteractable.id,
            type: this.activePuzzleInteractable.kind === 'puzzle_circuit' ? 'circuit' : 'runes',
            title:
              this.activePuzzleInteractable.kind === 'puzzle_circuit'
                ? 'Emergency Ward Generator'
                : 'Moon Monolith Rune Lock',
            subtitle:
              this.activePuzzleInteractable.kind === 'puzzle_circuit'
                ? 'Align all four power conduits to restore hospital ward lighting.'
                : 'Activate the three ancient moon glyphs in ascending nocturnal order.',
          }
        : null,
      outcome: this.outcome,
    });
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys[e.code] = true;
    if (e.code === 'Space') {
      e.preventDefault();
      this.triggerJump();
    } else if (e.code === 'KeyE') {
      this.triggerInteract();
    } else if (e.code === 'KeyF') {
      this.triggerFlare();
    } else if (e.code === 'KeyQ') {
      this.triggerDodge();
    } else if (e.code === 'KeyR') {
      this.triggerHeal();
    } else if (e.code === 'KeyV') {
      this.toggleCameraMode();
    } else if (e.code === 'KeyJ') {
      this.triggerAttack();
    } else if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.activePuzzleInteractable) {
        this.cancelActivePuzzle();
      } else {
        this.onPauseRequested();
      }
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys[e.code] = false;
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (this.paused || this.outcome || this.activePuzzleInteractable) return;
    this.audio.unlock();
    if (e.button === 0) {
      if (!this.pointerLocked) {
        try {
          this.renderer.domElement.requestPointerLock?.();
        } catch {
          // Fallback to drag-look if pointer lock is blocked
        }
        this.draggingLook = true;
        this.lastDragX = e.clientX;
        this.lastDragY = e.clientY;
      }
      this.triggerAttack();
    } else if (e.button === 2) {
      this.triggerDodge();
    }
  };

  private onMouseUp = (): void => {
    this.draggingLook = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (this.paused || this.outcome || this.activePuzzleInteractable) return;
    const sens = 0.0024 * this.save.settings.mouseSensitivity;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.yaw -= e.movementX * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch + e.movementY * sens, -0.42, 0.88);
    } else if (this.draggingLook) {
      const dx = e.clientX - this.lastDragX;
      const dy = e.clientY - this.lastDragY;
      this.lastDragX = e.clientX;
      this.lastDragY = e.clientY;
      this.yaw -= dx * sens * 1.4;
      this.pitch = THREE.MathUtils.clamp(this.pitch + dy * sens * 1.4, -0.42, 0.88);
    }
  };

  private onPointerLockChange = (): void => {
    this.pointerLocked = document.pointerLockElement === this.renderer.domElement;
    this.pushHud();
  };

  private onContextMenu = (e: MouseEvent): void => {
    e.preventDefault();
  };

  private onResize = (): void => {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
  };

  private onContextRestored = (): void => {
    this.contextLost = false;
  };

  private bindEvents(): void {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.addEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('contextmenu', this.onContextMenu);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);

    if (document.pointerLockElement === this.renderer.domElement) {
      document.exitPointerLock();
    }

    this.shadowTex.dispose();
    this.env?.disposables.forEach((d) => d.dispose());
    this.audio.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
