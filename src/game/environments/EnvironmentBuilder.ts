import * as THREE from 'three';
import { getChapterById } from '../data/gameCatalog';
import {
  createBuildingFacadeTexture,
  createCitadelStoneTexture,
  createCobblestoneTexture,
  createForestGroundTexture,
  createHospitalTileTexture,
  createLabFloorTexture,
} from '../textures/ProceduralTextures';
import type { ChapterId, GameModeId } from '../types';

export interface ColliderBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type InteractableKind =
  | 'beacon'
  | 'survivor'
  | 'clue'
  | 'puzzle_circuit'
  | 'puzzle_runes'
  | 'supply'
  | 'anchor';

export interface WorldInteractable {
  id: string;
  kind: InteractableKind;
  label: string;
  x: number;
  z: number;
  radius: number;
  mesh: THREE.Group;
  light?: THREE.PointLight;
  completed: boolean;
}

export interface BuiltEnvironment {
  group: THREE.Group;
  arenaRadius: number;
  colliders: ColliderBox[];
  interactables: WorldInteractable[];
  flickerLights: { light: THREE.PointLight; baseIntensity: number; phase: number }[];
  spawnPoints: THREE.Vector2[];
  playerStart: THREE.Vector3;
  disposables: { dispose: () => void }[];
}

function makeSurvivorGroup(x: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const coatMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.75 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xd8a98b, roughness: 0.65 });
  const beaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 1.6,
    roughness: 0.2,
  });
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.75, 8), coatMat);
  legs.position.y = 0.38;
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.18, 0.6, 8), coatMat);
  torso.position.y = 1.02;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), skinMat);
  head.position.y = 1.48;
  const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8), beaconMat);
  flare.position.set(0.26, 1.05, 0.18);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.7, 20),
    new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide, transparent: true, opacity: 0.6 })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  g.add(legs, torso, head, flare, ring);
  return g;
}

function makeBeaconGroup(x: number, z: number, colorHex = 0xf59e0b): { group: THREE.Group; light: THREE.PointLight } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.35 });
  const coreMat = new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: colorHex,
    emissiveIntensity: 1.4,
    roughness: 0.2,
  });

  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.35, 8), metalMat);
  base.position.y = 0.18;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.18, 2.2, 8), metalMat);
  mast.position.y = 1.35;
  const emitter = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), coreMat);
  emitter.position.y = 2.65;
  emitter.name = 'beaconCore';
  const light = new THREE.PointLight(colorHex, 2.4, 15, 1.6);
  light.position.y = 2.75;
  group.add(base, mast, emitter, light);
  return { group, light };
}

function makeCluePedestal(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const standMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.5, roughness: 0.5 });
  const pageMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xd97706,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.55), standMat);
  base.position.y = 0.42;
  const dossier = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.28), pageMat);
  dossier.position.y = 0.88;
  dossier.rotation.y = 0.3;
  const halo = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.55, 18),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  group.add(base, dossier, halo);
  return group;
}

function makeSupplyCrate(x: number, z: number): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.4, roughness: 0.55 });
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.5,
  });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.65), crateMat);
  box.position.y = 0.28;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.7), crateMat);
  lid.position.y = 0.58;
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), stripMat);
  strip.position.set(0, 0.34, 0.33);
  group.add(box, lid, strip);
  return group;
}

function makeStreetLamp(x: number, z: number, color = 0xf59e0b): { group: THREE.Group; light: THREE.PointLight } {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  const iron = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.35 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 2.2,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 4.6, 8), iron);
  pole.position.y = 2.3;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.08, 0.08), iron);
  arm.position.set(0.35, 4.5, 0);
  const lantern = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.14, 0.38, 6), bulbMat);
  lantern.position.set(0.7, 4.28, 0);
  const light = new THREE.PointLight(color, 3.6, 20, 1.5);
  light.position.set(0.7, 4.1, 0);
  group.add(pole, arm, lantern, light);
  return { group, light };
}

function makePineTree(x: number, z: number, scale = 1): THREE.Group {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);

  const barkMat = new THREE.MeshStandardMaterial({ color: 0x291f1a, roughness: 0.92, metalness: 0.05 });
  const needleMat = new THREE.MeshStandardMaterial({ color: 0x12261e, roughness: 0.85, metalness: 0.05 });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.42, 4.2, 8), barkMat);
  trunk.position.y = 2.1;
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(2.1, 3.2, 8), needleMat);
  c1.position.y = 4.0;
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.65, 2.8, 8), needleMat);
  c2.position.y = 5.6;
  const c3 = new THREE.Mesh(new THREE.ConeGeometry(1.15, 2.4, 8), needleMat);
  c3.position.y = 7.0;
  group.add(trunk, c1, c2, c3);
  return group;
}

export function buildEnvironment(
  chapterId: ChapterId,
  mode: GameModeId,
  maxAnisotropy: number
): BuiltEnvironment {
  const chapter = getChapterById(chapterId);
  const group = new THREE.Group();
  const colliders: ColliderBox[] = [];
  const interactables: WorldInteractable[] = [];
  const flickerLights: { light: THREE.PointLight; baseIntensity: number; phase: number }[] = [];
  const disposables: { dispose: () => void }[] = [];
  const arenaRadius = 46;

  // Ground Texture selection
  let groundTex: THREE.CanvasTexture;
  if (chapterId === 'hospital') groundTex = createHospitalTileTexture(maxAnisotropy);
  else if (chapterId === 'forest') groundTex = createForestGroundTexture(maxAnisotropy);
  else if (chapterId === 'underground') groundTex = createLabFloorTexture(maxAnisotropy);
  else if (chapterId === 'citadel') groundTex = createCitadelStoneTexture(maxAnisotropy);
  else groundTex = createCobblestoneTexture(maxAnisotropy);

  disposables.push(groundTex);

  const groundGeo = new THREE.PlaneGeometry(180, 180);
  const groundMat = new THREE.MeshStandardMaterial({
    map: groundTex,
    roughness: chapterId === 'city' || chapterId === 'hospital' ? 0.35 : 0.82,
    metalness: chapterId === 'underground' ? 0.3 : 0.08,
  });
  disposables.push(groundGeo, groundMat);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  const addBoxObstacle = (x: number, z: number, w: number, h: number, d: number, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    colliders.push({
      minX: x - w / 2,
      maxX: x + w / 2,
      minZ: z - d / 2,
      maxZ: z + d / 2,
    });
    return mesh;
  };

  const facadeTex = createBuildingFacadeTexture(maxAnisotropy, !chapter.isIndoor);
  disposables.push(facadeTex);

  if (chapterId === 'city') {
    const bldgMat = new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 0.72, metalness: 0.15 });
    const trimMat = new THREE.MeshStandardMaterial({ color: 0x1e2530, roughness: 0.6, metalness: 0.35 });
    disposables.push(bldgMat, trimMat);

    // City avenue buildings along perimeter + central monuments
    const buildingSpecs = [
      [-32, -26, 16, 18, 14],
      [-32, 0, 14, 22, 16],
      [-32, 26, 16, 16, 14],
      [32, -26, 16, 20, 14],
      [32, 0, 14, 17, 16],
      [32, 26, 16, 21, 14],
      [-14, -36, 16, 19, 12],
      [14, -36, 16, 24, 12],
      [-14, 36, 16, 16, 12],
      [14, 36, 16, 18, 12],
    ];
    for (const [x, z, w, h, d] of buildingSpecs) {
      addBoxObstacle(x, z, w, h, d, bldgMat);
      const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.6, d + 0.6), trimMat);
      cornice.position.set(x, h + 0.3, z);
      group.add(cornice);
    }

    // Abandoned barricades / vehicles for cover
    addBoxObstacle(-10, -10, 4.4, 1.5, 2.2, trimMat);
    addBoxObstacle(11, 9, 4.2, 1.5, 2.2, trimMat);
    addBoxObstacle(0, -18, 5.2, 1.4, 1.8, trimMat);

    // Streetlamps
    const lampCoords = [
      [-15, -16],
      [15, -16],
      [-15, 16],
      [15, 16],
    ];
    lampCoords.forEach(([lx, lz], idx) => {
      const { group: lamp, light } = makeStreetLamp(lx, lz, 0xf59e0b);
      group.add(lamp);
      flickerLights.push({ light, baseIntensity: 3.6, phase: idx * 1.7 });
    });

    if (mode === 'story') {
      const beaconSpots = [
        [-19, -20],
        [20, -14],
        [0, 22],
      ];
      beaconSpots.forEach(([bx, bz], i) => {
        const { group: bg, light } = makeBeaconGroup(bx, bz, 0xf59e0b);
        group.add(bg);
        interactables.push({
          id: `beacon_${i}`,
          kind: 'beacon',
          label: `Activate Signal Beacon ${i + 1}`,
          x: bx,
          z: bz,
          radius: 2.8,
          mesh: bg,
          light,
          completed: false,
        });
      });
      [
        [-21, 14],
        [21, 19],
      ].forEach(([sx, sz], i) => {
        const sg = makeSurvivorGroup(sx, sz);
        group.add(sg);
        interactables.push({
          id: `survivor_${i}`,
          kind: 'survivor',
          label: `Rescue Trapped Survivor`,
          x: sx,
          z: sz,
          radius: 2.6,
          mesh: sg,
          completed: false,
        });
      });
    }
  } else if (chapterId === 'hospital') {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x26292e, roughness: 0.78, metalness: 0.1 });
    const gurneyMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.65 });
    disposables.push(wallMat, gurneyMat);

    // Enclosed hospital ward perimeter + internal corridor partitions
    addBoxObstacle(0, -34, 72, 7, 2, wallMat);
    addBoxObstacle(0, 34, 72, 7, 2, wallMat);
    addBoxObstacle(-34, 0, 2, 7, 70, wallMat);
    addBoxObstacle(34, 0, 2, 7, 70, wallMat);

    // Interior ward walls with wide doorways
    addBoxObstacle(-12, -10, 12, 5.5, 1.4, wallMat);
    addBoxObstacle(12, -10, 12, 5.5, 1.4, wallMat);
    addBoxObstacle(-12, 10, 12, 5.5, 1.4, wallMat);
    addBoxObstacle(12, 10, 12, 5.5, 1.4, wallMat);

    // Ceiling beams for indoor horror framing
    for (let z = -28; z <= 28; z += 14) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(68, 0.8, 1.2), wallMat);
      beam.position.set(0, 6.8, z);
      group.add(beam);
    }

    // Gurneys & medical equipment
    addBoxObstacle(-6, 0, 2.4, 1.0, 1.1, gurneyMat);
    addBoxObstacle(7, -2, 2.4, 1.0, 1.1, gurneyMat);

    // Flickering amber emergency sconces
    [
      [-18, -18],
      [18, -18],
      [-18, 18],
      [18, 18],
      [0, 0],
    ].forEach(([lx, lz], i) => {
      const { group: lamp, light } = makeStreetLamp(lx, lz, i === 4 ? 0xef4444 : 0xf59e0b);
      lamp.scale.set(0.8, 0.72, 0.8);
      group.add(lamp);
      flickerLights.push({ light, baseIntensity: 4.2, phase: i * 2.1 });
    });

    if (mode === 'story') {
      const { group: genGroup, light: genLight } = makeBeaconGroup(0, -24, 0x38bdf8);
      group.add(genGroup);
      interactables.push({
        id: 'hospital_circuit',
        kind: 'puzzle_circuit',
        label: 'Restore Backup Generator (Circuit Puzzle)',
        x: 0,
        z: -24,
        radius: 3.0,
        mesh: genGroup,
        light: genLight,
        completed: false,
      });

      [
        [-22, -4],
        [22, 4],
        [0, 23],
      ].forEach(([cx, cz], i) => {
        const clue = makeCluePedestal(cx, cz);
        group.add(clue);
        interactables.push({
          id: `hosp_clue_${i}`,
          kind: 'clue',
          label: `Recover Patient Log #${i + 1}`,
          x: cx,
          z: cz,
          radius: 2.5,
          mesh: clue,
          completed: false,
        });
      });
    }
  } else if (chapterId === 'forest') {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9, metalness: 0.08 });
    disposables.push(stoneMat);

    // Dense outer pine ring & natural woodland clearings
    for (let i = 0; i < 42; i++) {
      const angle = (i / 42) * Math.PI * 2;
      const dist = 36 + (i % 3) * 5;
      const tx = Math.cos(angle) * dist;
      const tz = Math.sin(angle) * dist;
      group.add(makePineTree(tx, tz, 1.0 + (i % 4) * 0.18));
    }
    const innerTrees = [
      [-15, -14],
      [16, -15],
      [-18, 12],
      [17, 16],
      [-6, 22],
      [8, -24],
    ];
    innerTrees.forEach(([tx, tz], i) => {
      group.add(makePineTree(tx, tz, 0.9 + (i % 2) * 0.2));
      colliders.push({ minX: tx - 0.8, maxX: tx + 0.8, minZ: tz - 0.8, maxZ: tz + 0.8 });
    });

    // Ancient mossy monolith stones around center
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rx = Math.cos(a) * 11;
      const rz = Math.sin(a) * 11;
      addBoxObstacle(rx, rz, 1.4, 3.6, 1.2, stoneMat);
    }

    if (mode === 'story') {
      const { group: altar, light } = makeBeaconGroup(0, -18, 0x38bdf8);
      group.add(altar);
      interactables.push({
        id: 'forest_runes',
        kind: 'puzzle_runes',
        label: 'Unlock Moon Monolith Seal (Rune Puzzle)',
        x: 0,
        z: -18,
        radius: 3.0,
        mesh: altar,
        light,
        completed: false,
      });

      [
        [-22, -6],
        [20, -8],
        [10, 22],
      ].forEach(([cx, cz], i) => {
        const clue = makeCluePedestal(cx, cz);
        group.add(clue);
        interactables.push({
          id: `forest_clue_${i}`,
          kind: 'clue',
          label: `Inspect Expedition Relic #${i + 1}`,
          x: cx,
          z: cz,
          radius: 2.5,
          mesh: clue,
          completed: false,
        });
      });
    }
  } else if (chapterId === 'underground') {
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.35, metalness: 0.78 });
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.75,
    });
    disposables.push(steelMat, tubeMat);

    // Subterranean bunker walls
    addBoxObstacle(0, -35, 74, 7.5, 2, steelMat);
    addBoxObstacle(0, 35, 74, 7.5, 2, steelMat);
    addBoxObstacle(-35, 0, 2, 7.5, 72, steelMat);
    addBoxObstacle(35, 0, 2, 7.5, 72, steelMat);

    // Cryo-Containment vats
    const vatCoords = [
      [-12, -12],
      [12, -12],
      [-12, 12],
      [12, 12],
    ];
    vatCoords.forEach(([vx, vz], idx) => {
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.6, 14), steelMat);
      base.position.set(vx, 0.3, vz);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 3.8, 14), tubeMat);
      glass.position.set(vx, 2.5, vz);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.4, 0.5, 14), steelMat);
      cap.position.set(vx, 4.65, vz);
      const light = new THREE.PointLight(0x10b981, 3.5, 16, 1.5);
      light.position.set(vx, 3.0, vz);
      group.add(base, glass, cap, light);
      flickerLights.push({ light, baseIntensity: 3.5, phase: idx * 1.4 });
      colliders.push({ minX: vx - 1.5, maxX: vx + 1.5, minZ: vz - 1.5, maxZ: vz + 1.5 });
    });

    if (mode === 'story') {
      [
        [-24, -20],
        [24, -20],
        [0, 24],
      ].forEach(([bx, bz], i) => {
        const { group: lockGroup, light } = makeBeaconGroup(bx, bz, 0x10b981);
        group.add(lockGroup);
        interactables.push({
          id: `lab_lock_${i}`,
          kind: 'beacon',
          label: `Override Containment Lock ${i + 1}`,
          x: bx,
          z: bz,
          radius: 2.8,
          mesh: lockGroup,
          light,
          completed: false,
        });
      });

      [
        [-22, 6],
        [22, 6],
        [0, -24],
      ].forEach(([cx, cz], i) => {
        const clue = makeCluePedestal(cx, cz);
        group.add(clue);
        interactables.push({
          id: `lab_clue_${i}`,
          kind: 'clue',
          label: `Extract Research Dossier #${i + 1}`,
          x: cx,
          z: cz,
          radius: 2.5,
          mesh: clue,
          completed: false,
        });
      });
    }
  } else {
    // Chapter 5: The Final Night — Eclipse Citadel
    const obsidianMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.72, metalness: 0.35 });
    const crimsonMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      emissive: 0xe11d48,
      emissiveIntensity: 2.2,
    });
    disposables.push(obsidianMat, crimsonMat);

    // Blood moon suspended high in sky
    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(7.5, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xbe123c })
    );
    moon.position.set(0, 42, -68);
    group.add(moon);

    // Ritual pillars in ring
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const px = Math.cos(a) * 26;
      const pz = Math.sin(a) * 26;
      addBoxObstacle(px, pz, 2.4, 7.5, 2.4, obsidianMat);
      const brazier = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), crimsonMat);
      brazier.position.set(px, 7.9, pz);
      group.add(brazier);
    }

    if (mode === 'story') {
      [
        [-18, -14],
        [18, -14],
        [0, 20],
      ].forEach(([ax, az], i) => {
        const { group: ag, light } = makeBeaconGroup(ax, az, 0xf43f5e);
        group.add(ag);
        interactables.push({
          id: `anchor_${i}`,
          kind: 'anchor',
          label: `Shatter Eclipse Anchor ${i + 1}`,
          x: ax,
          z: az,
          radius: 2.9,
          mesh: ag,
          light,
          completed: false,
        });
      });
      const sg = makeSurvivorGroup(-20, 14);
      group.add(sg);
      interactables.push({
        id: 'citadel_sentinel',
        kind: 'survivor',
        label: 'Rescue Fallen Sentinel',
        x: -20,
        z: 14,
        radius: 2.6,
        mesh: sg,
        completed: false,
      });
    }
  }

  // Supply crates & extra exploration clues available across modes
  const supplySpots = [
    [-16, 0],
    [16, 0],
    [0, 15],
  ];
  supplySpots.forEach(([sx, sz], i) => {
    const crate = makeSupplyCrate(sx, sz);
    group.add(crate);
    interactables.push({
      id: `supply_${i}`,
      kind: 'supply',
      label: 'Collect Field Supply Cache (+HP / +Energy)',
      x: sx,
      z: sz,
      radius: 2.4,
      mesh: crate,
      completed: false,
    });
  });

  if (mode === 'exploration') {
    [
      [-20, -20],
      [20, -20],
      [-20, 20],
      [20, 20],
      [0, -24],
    ].forEach(([cx, cz], i) => {
      const clue = makeCluePedestal(cx, cz);
      group.add(clue);
      interactables.push({
        id: `explore_clue_${i}`,
        kind: 'clue',
        label: `Uncover Hidden Lore Clue #${i + 1}`,
        x: cx,
        z: cz,
        radius: 2.6,
        mesh: clue,
        completed: false,
      });
    });
  }

  const spawnPoints = [
    new THREE.Vector2(-24, -24),
    new THREE.Vector2(24, -24),
    new THREE.Vector2(-24, 24),
    new THREE.Vector2(24, 24),
    new THREE.Vector2(0, -28),
    new THREE.Vector2(-28, 0),
    new THREE.Vector2(28, 0),
  ];

  return {
    group,
    arenaRadius,
    colliders,
    interactables,
    flickerLights,
    spawnPoints,
    playerStart: new THREE.Vector3(0, 0, 18),
    disposables,
  };
}
