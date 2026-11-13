import * as THREE from 'three';
import type { MonsterCategoryId } from '../types';

export interface MonsterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  leftLimb: THREE.Group;
  rightLimb: THREE.Group;
  haloOrTail?: THREE.Object3D;
  coreMesh: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
}

export function buildMonsterModel(category: MonsterCategoryId, shadowTex?: THREE.Texture): MonsterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const materials: THREE.MeshStandardMaterial[] = [];
  const trackMat = <T extends THREE.MeshStandardMaterial>(m: T): T => {
    materials.push(m);
    return m;
  };

  if (shadowTex) {
    const scale = category.startsWith('boss') ? 3.2 : category === 'mutated_beast' ? 2.4 : 1.5;
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(scale, scale),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.6 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.025;
    root.add(shadow);
  }

  const head = new THREE.Group();
  const leftLimb = new THREE.Group();
  const rightLimb = new THREE.Group();
  let coreMesh: THREE.Mesh;
  let haloOrTail: THREE.Object3D | undefined;

  if (category === 'shadow_creature') {
    const darkMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.85, metalness: 0.1 }));
    const glowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0ea5e9,
        emissiveIntensity: 2.2,
        roughness: 0.2,
      })
    );

    const torso = new THREE.Mesh(new THREE.ConeGeometry(0.36, 1.05, 8), darkMat);
    torso.position.y = 0.72;
    torso.rotation.x = 0.45;

    const spine1 = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 5), glowMat);
    spine1.position.set(0, 1.0, -0.18);
    spine1.rotation.x = -0.5;
    const spine2 = spine1.clone();
    spine2.position.set(0, 0.75, -0.3);

    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), glowMat);
    coreMesh.position.set(0, 0.82, 0.15);

    head.position.set(0, 1.15, 0.28);
    const skull = new THREE.Mesh(new THREE.DodecahedronGeometry(0.22, 0), darkMat);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.042, 6, 6), glowMat);
    eyeL.position.set(-0.08, 0.04, 0.18);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.08;
    head.add(skull, eyeL, eyeR);

    const makeClawArm = (x: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0.95, 0.12);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 0.65, 6), darkMat);
      upper.position.y = -0.3;
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 4), glowMat);
      blade.position.set(0, -0.68, 0.1);
      blade.rotation.x = Math.PI * 0.7;
      g.add(upper, blade);
      return g;
    };
    leftLimb.add(makeClawArm(-0.34));
    rightLimb.add(makeClawArm(0.34));

    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.85, 6), darkMat);
    tail.position.set(0, 0.45, -0.45);
    tail.rotation.x = -1.1;
    haloOrTail = tail;

    body.add(torso, spine1, spine2, coreMesh, head, leftLimb, rightLimb, tail);
  } else if (category === 'mutated_beast') {
    const fleshMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x3b2322, roughness: 0.78, metalness: 0.12 }));
    const boneMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.45, metalness: 0.25 }));
    const amberMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 1.8,
        roughness: 0.25,
      })
    );

    const legsL = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.85, 8), fleshMat);
    legsL.position.set(-0.4, 0.42, 0);
    const legsR = legsL.clone();
    legsR.position.x = 0.4;

    const chest = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 1), fleshMat);
    chest.scale.set(1.15, 1.05, 0.9);
    chest.position.y = 1.45;

    const bonePlate = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.36, 0.72), boneMat);
    bonePlate.position.set(0, 1.88, 0.05);

    coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 10), amberMat);
    coreMesh.position.set(0, 1.42, 0.56);

    head.position.set(0, 1.98, 0.42);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.36, 0.42), boneMat);
    const hornL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.42, 6), boneMat);
    hornL.position.set(-0.24, 0.22, 0);
    hornL.rotation.z = 0.55;
    const hornR = hornL.clone();
    hornR.position.x = 0.24;
    hornR.rotation.z = -0.55;
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), amberMat);
    eyeL.position.set(-0.12, 0.06, 0.21);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.12;
    head.add(jaw, hornL, hornR, eyeL, eyeR);

    const makeHeavyArm = (x: number, scale = 1) => {
      const g = new THREE.Group();
      g.position.set(x, 1.65, 0.08);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * scale, 0.18 * scale, 0.75, 8), fleshMat);
      upper.position.y = -0.35;
      const fist = new THREE.Mesh(new THREE.DodecahedronGeometry(0.28 * scale, 0), boneMat);
      fist.position.y = -0.82;
      g.add(upper, fist);
      return g;
    };
    leftLimb.add(makeHeavyArm(-0.85, 0.9));
    rightLimb.add(makeHeavyArm(0.85, 1.25));

    body.add(legsL, legsR, chest, bonePlate, coreMesh, head, leftLimb, rightLimb);
  } else if (category === 'night_stalker') {
    const cloakMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x181526, roughness: 0.85, metalness: 0.15 }));
    const maskMat = trackMat(new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.35, metalness: 0.3 }));
    const violetMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0x7c3aed,
        emissiveIntensity: 2.0,
        roughness: 0.2,
      })
    );

    const lowerCloak = new THREE.Mesh(new THREE.ConeGeometry(0.46, 1.65, 10, 1, true), cloakMat);
    lowerCloak.material.side = THREE.DoubleSide;
    lowerCloak.position.y = 0.85;
    const upperTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.16, 0.75, 8), cloakMat);
    upperTorso.position.y = 1.52;

    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.15, 0), violetMat);
    coreMesh.position.set(0, 1.5, 0.18);

    head.position.set(0, 2.02, 0.05);
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.48, 8), cloakMat);
    hood.position.y = 0.12;
    const faceMask = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.28, 0.12), maskMat);
    faceMask.position.set(0, 0.02, 0.13);
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), violetMat);
    eyeL.position.set(-0.05, 0.06, 0.19);
    const eyeR = eyeL.clone();
    eyeR.position.x = 0.05;
    head.add(hood, faceMask, eyeL, eyeR);

    const makeScytheArm = (x: number) => {
      const g = new THREE.Group();
      g.position.set(x, 1.72, 0);
      const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.72, 8), cloakMat);
      sleeve.position.y = -0.32;
      const scythe = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.75, 4), violetMat);
      scythe.position.set(0, -0.78, 0.18);
      scythe.rotation.x = Math.PI * 0.68;
      g.add(sleeve, scythe);
      return g;
    };
    leftLimb.add(makeScytheArm(-0.34));
    rightLimb.add(makeScytheArm(0.34));

    body.add(lowerCloak, upperTorso, coreMesh, head, leftLimb, rightLimb);
  } else if (category === 'underground_horror') {
    const carapaceMat = trackMat(new THREE.MeshStandardMaterial({ color: 0x132a27, roughness: 0.4, metalness: 0.45 }));
    const bioMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x059669,
        emissiveIntensity: 2.1,
        roughness: 0.2,
      })
    );

    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(0.52, 12, 10), carapaceMat);
    abdomen.scale.set(1, 0.78, 1.45);
    abdomen.position.set(0, 0.65, -0.25);

    const thorax = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.42, 0.68, 8), carapaceMat);
    thorax.position.set(0, 0.92, 0.25);
    thorax.rotation.x = 0.45;

    coreMesh = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 10), bioMat);
    coreMesh.position.set(0, 0.98, 0.45);

    head.position.set(0, 1.25, 0.56);
    const crest = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.45, 6), carapaceMat);
    crest.rotation.x = -Math.PI * 0.35;
    const mandL = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.35, 5), bioMat);
    mandL.position.set(-0.14, -0.05, 0.22);
    mandL.rotation.x = Math.PI * 0.55;
    const mandR = mandL.clone();
    mandR.position.x = 0.14;
    head.add(crest, mandL, mandR);

    const makeCrawlerLimb = (x: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0.75, 0.15);
      const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.05, 0.75, 6), carapaceMat);
      leg1.position.set(x > 0 ? 0.25 : -0.25, -0.25, 0);
      leg1.rotation.z = x > 0 ? 0.55 : -0.55;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.45, 5), bioMat);
      tip.position.set(x > 0 ? 0.42 : -0.42, -0.58, 0.1);
      g.add(leg1, tip);
      return g;
    };
    leftLimb.add(makeCrawlerLimb(-0.36));
    rightLimb.add(makeCrawlerLimb(0.36));

    body.add(abdomen, thorax, coreMesh, head, leftLimb, rightLimb);
  } else {
    // Apex Bosses: Dread Warden or Eclipse Sovereign
    const isSovereign = category === 'boss_sovereign';
    const plateColor = isSovereign ? 0x160b14 : 0x1e293b;
    const glowColor = isSovereign ? 0xf43f5e : 0xef4444;
    const armorMat = trackMat(new THREE.MeshStandardMaterial({ color: plateColor, roughness: 0.35, metalness: 0.78 }));
    const glowMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: glowColor,
        emissive: glowColor,
        emissiveIntensity: 2.3,
        roughness: 0.18,
      })
    );

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 1.15, 8), armorMat);
    legL.position.set(-0.42, 0.58, 0);
    const legR = legL.clone();
    legR.position.x = 0.42;

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.42, 1.35, 10), armorMat);
    torso.position.y = 1.72;

    coreMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), glowMat);
    coreMesh.position.set(0, 1.78, 0.48);

    head.position.set(0, 2.65, 0.08);
    const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.28, 0.48, 8), armorMat);
    const crownL = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.65, 5), glowMat);
    crownL.position.set(-0.24, 0.36, 0);
    crownL.rotation.z = 0.35;
    const crownR = crownL.clone();
    crownR.position.x = 0.24;
    crownR.rotation.z = -0.35;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.08, 0.12), glowMat);
    visor.position.set(0, 0.05, 0.24);
    head.add(helm, crownL, crownR, visor);

    // Floating Shadow Halo behind Boss
    const halo = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.055, 8, 28), glowMat);
    halo.position.set(0, 2.35, -0.45);
    haloOrTail = halo;

    const makeBossArm = (x: number, withWeapon: boolean) => {
      const g = new THREE.Group();
      g.position.set(x, 2.25, 0);
      const pauldron = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), armorMat);
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.05, 8), armorMat);
      arm.position.y = -0.52;
      g.add(pauldron, arm);
      if (withWeapon) {
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.3, 8), armorMat);
        shaft.position.set(0, -1.0, 0.55);
        shaft.rotation.x = Math.PI * 0.42;
        const cleaver = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.42), glowMat);
        cleaver.position.set(0, -1.15, 1.35);
        cleaver.rotation.x = Math.PI * 0.42;
        g.add(shaft, cleaver);
      }
      return g;
    };
    leftLimb.add(makeBossArm(-0.88, false));
    rightLimb.add(makeBossArm(0.88, true));

    body.add(legL, legR, torso, coreMesh, head, halo, leftLimb, rightLimb);
  }

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material instanceof THREE.Material && !mesh.material.transparent) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return {
    root,
    body,
    head,
    leftLimb,
    rightLimb,
    haloOrTail,
    coreMesh,
    materials,
  };
}

export function animateMonsterRig(
  rig: MonsterRig,
  params: {
    category: MonsterCategoryId;
    speed: number;
    attacking: number; // 0..1
    stunned: boolean;
    hitFlash: number;
    elapsed: number;
    banishProgress: number; // 0..1 when defeated
  }
): void {
  const { category, speed, attacking, stunned, hitFlash, elapsed, banishProgress } = params;

  if (banishProgress > 0) {
    const scale = Math.max(0.01, 1 - banishProgress);
    rig.root.scale.setScalar(scale);
    rig.body.rotation.y += 0.14;
    rig.body.position.y = banishProgress * 1.4;
    return;
  }

  const sway = Math.sin(elapsed * (category === 'shadow_creature' ? 11 : 6.5));
  rig.body.position.y = stunned ? 0 : Math.abs(sway) * Math.min(0.14, speed * 0.02);
  rig.head.rotation.y = Math.sin(elapsed * 2.1) * 0.18;
  rig.coreMesh.rotation.y = elapsed * 2.4;

  if (rig.haloOrTail) {
    if (category.startsWith('boss')) {
      rig.haloOrTail.rotation.z = elapsed * 0.85;
    } else {
      rig.haloOrTail.rotation.y = sway * 0.35;
    }
  }

  if (attacking > 0) {
    const swing = Math.sin(attacking * Math.PI);
    rig.rightLimb.rotation.x = -1.65 * swing;
    rig.leftLimb.rotation.x = -0.9 * swing;
  } else if (stunned) {
    rig.body.rotation.z = Math.sin(elapsed * 28) * 0.08;
    rig.rightLimb.rotation.x = 0.4;
    rig.leftLimb.rotation.x = 0.4;
  } else {
    rig.body.rotation.z = 0;
    rig.leftLimb.rotation.x = sway * 0.55;
    rig.rightLimb.rotation.x = -sway * 0.55;
  }

  for (const mat of rig.materials) {
    if (hitFlash > 0) {
      mat.emissiveIntensity = 2.6;
    } else if (mat.emissive.getHex() !== 0) {
      mat.emissiveIntensity = 1.6 + Math.sin(elapsed * 4) * 0.35;
    }
  }
}
