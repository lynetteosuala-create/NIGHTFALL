import * as THREE from 'three';
import { OUTFITS } from '../data/gameCatalog';
import type { CharacterCustomization, WeaponId } from '../types';

export interface HunterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  weaponMount: THREE.Group;
  lanternLight: THREE.PointLight;
  lanternOrb: THREE.Mesh;
  hairGroup: THREE.Group;
}

function buildWeaponMesh(weaponId: WeaponId): THREE.Group {
  const group = new THREE.Group();

  const steelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    metalness: 0.85,
    roughness: 0.22,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.2,
    roughness: 0.85,
  });

  if (weaponId === 'arcane_edge') {
    const hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.24, 10), gripMat);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.035, 0.06), steelMat);
    guard.position.y = 0.13;
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.85, 4), steelMat);
    blade.position.y = 0.56;
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(0.018, 0.65, 0.025),
      new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 1.6,
        roughness: 0.2,
      })
    );
    core.position.y = 0.48;
    group.add(hilt, guard, blade, core);
  } else if (weaponId === 'solaris_repeater') {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.14, 0.68), gripMat);
    body.position.z = 0.22;
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.028, 0.58, 12), steelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.03, 0.58);
    const cell = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.34),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x38bdf8,
        emissiveIntensity: 1.8,
        roughness: 0.15,
      })
    );
    cell.position.set(0, 0.06, 0.26);
    group.add(body, barrel, cell);
    group.rotation.x = Math.PI / 2;
  } else if (weaponId === 'umbral_scythe') {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1.65, 10), gripMat);
    shaft.position.y = 0.55;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 10), steelMat);
    collar.position.y = 1.32;
    const curvedBlade = new THREE.Mesh(
      new THREE.TorusGeometry(0.36, 0.04, 8, 16, Math.PI * 0.65),
      new THREE.MeshStandardMaterial({
        color: 0xa78bfa,
        emissive: 0x6d28d9,
        emissiveIntensity: 1.2,
        metalness: 0.8,
        roughness: 0.2,
      })
    );
    curvedBlade.position.set(0.24, 1.36, 0);
    curvedBlade.rotation.z = Math.PI * 0.72;
    group.add(shaft, collar, curvedBlade);
  } else {
    // Aegis Rail-Lance
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.55), gripMat);
    stock.position.z = 0.15;
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.95), steelMat);
    railTop.position.set(0, 0.06, 0.68);
    const railBot = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.95), steelMat);
    railBot.position.set(0, -0.02, 0.68);
    const coil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.022, 0.85, 10),
      new THREE.MeshStandardMaterial({
        color: 0x10b981,
        emissive: 0x10b981,
        emissiveIntensity: 2.0,
        roughness: 0.15,
      })
    );
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0, 0.02, 0.68);
    group.add(stock, railTop, railBot, coil);
    group.rotation.x = Math.PI / 2;
  }

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
    }
  });
  return group;
}

export function buildHunterModel(customization: CharacterCustomization, shadowTex?: THREE.Texture): HunterRig {
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const outfitDef = OUTFITS.find((o) => o.id === customization.outfit) ?? OUTFITS[0];
  const primaryMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(outfitDef.primaryHex),
    roughness: 0.75,
    metalness: 0.15,
  });
  const armorMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.35,
    metalness: 0.7,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(customization.accentColor || outfitDef.secondaryHex),
    emissive: new THREE.Color(customization.accentColor || outfitDef.secondaryHex),
    emissiveIntensity: 0.55,
    roughness: 0.3,
    metalness: 0.6,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(customization.skinTone),
    roughness: 0.65,
    metalness: 0.05,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(customization.hairColor),
    roughness: 0.8,
    metalness: 0.08,
  });

  // Contact shadow disc grounded at y = 0.02
  if (shadowTex) {
    const shadowPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.55 })
    );
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = 0.02;
    root.add(shadowPlane);
  }

  // Legs (left & right articulated groups pivoted at hip y = 0.88)
  const makeLeg = (xOffset: number) => {
    const leg = new THREE.Group();
    leg.position.set(xOffset, 0.88, 0);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.095, 0.44, 10), primaryMat);
    thigh.position.y = -0.22;
    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, 0.42, 10), armorMat);
    shin.position.y = -0.62;
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.26), armorMat);
    boot.position.set(0, -0.82, 0.04);
    leg.add(thigh, shin, boot);
    return leg;
  };
  const leftLeg = makeLeg(-0.15);
  const rightLeg = makeLeg(0.15);
  bodyGroup.add(leftLeg, rightLeg);

  // Torso, Coat & Tactical Harness
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.56, 12), primaryMat);
  torso.position.y = 1.18;
  const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.32, 0.28), armorMat);
  chestPlate.position.set(0, 1.25, 0.02);
  const coatSkirt = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 0.48, 12, 1, true), primaryMat);
  coatSkirt.material.side = THREE.DoubleSide;
  coatSkirt.position.y = 0.78;
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.08, 12), armorMat);
  belt.position.y = 0.94;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.04), accentMat);
  buckle.position.set(0, 0.94, 0.21);
  bodyGroup.add(torso, chestPlate, coatSkirt, belt, buckle);

  // Tactical Lantern attached to hip
  const lanternGroup = new THREE.Group();
  lanternGroup.position.set(-0.27, 0.94, 0.14);
  const lanternFrame = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.16, 6), armorMat);
  const lanternOrb = new THREE.Mesh(
    new THREE.SphereGeometry(0.048, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffd166,
      emissive: 0xf59e0b,
      emissiveIntensity: 2.2,
      roughness: 0.1,
    })
  );
  const lanternLight = new THREE.PointLight(0xf59e0b, 3.2, 16, 1.5);
  lanternLight.position.set(0, 0.15, 0.2);
  lanternGroup.add(lanternFrame, lanternOrb, lanternLight);
  bodyGroup.add(lanternGroup);

  // Arms
  const makeArm = (xOffset: number) => {
    const arm = new THREE.Group();
    arm.position.set(xOffset, 1.4, 0);
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), armorMat);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.34, 10), primaryMat);
    upper.position.y = -0.18;
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.055, 0.32, 10), armorMat);
    forearm.position.y = -0.46;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.058, 8, 8), skinMat);
    hand.position.y = -0.64;
    arm.add(pauldron, upper, forearm, hand);
    return arm;
  };
  const leftArm = makeArm(-0.3);
  const rightArm = makeArm(0.3);
  const weaponMount = new THREE.Group();
  weaponMount.position.set(0, -0.64, 0.08);
  weaponMount.rotation.x = Math.PI / 2;
  weaponMount.add(buildWeaponMesh(customization.equippedWeapon));
  rightArm.add(weaponMount);
  bodyGroup.add(leftArm, rightArm);

  // Head & Hairstyles
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.56, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 14), skinMat);
  head.position.y = 0.1;

  // Mask / collar accent
  const mask = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.145, 0.11, 12), armorMat);
  mask.position.set(0, 0.04, 0.015);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe2e8f0 });
  const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 6), eyeMat);
  eyeL.position.set(-0.055, 0.13, 0.145);
  const eyeR = eyeL.clone();
  eyeR.position.x = 0.055;

  const hairGroup = new THREE.Group();
  if (customization.hairstyle === 'tactical_hood') {
    const hood = new THREE.Mesh(new THREE.SphereGeometry(0.195, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.65), primaryMat);
    hood.position.set(0, 0.11, -0.02);
    hood.rotation.x = -0.25;
    const trim = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.02, 8, 16), accentMat);
    trim.position.set(0, 0.1, 0.04);
    hairGroup.add(hood, trim);
  } else if (customization.hairstyle === 'swept_undercut') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.168, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
    cap.position.set(0, 0.12, -0.01);
    const sweep = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.22), hairMat);
    sweep.position.set(0.03, 0.23, 0.03);
    sweep.rotation.z = -0.22;
    hairGroup.add(cap, sweep);
  } else if (customization.hairstyle === 'long_braid') {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.168, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairMat);
    cap.position.set(0, 0.12, -0.01);
    const braid = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.025, 0.42, 8), hairMat);
    braid.position.set(0, -0.05, -0.17);
    braid.rotation.x = 0.25;
    hairGroup.add(cap, braid);
  } else {
    const crop = new THREE.Mesh(new THREE.SphereGeometry(0.166, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    crop.position.set(0, 0.13, -0.01);
    hairGroup.add(crop);
  }

  headGroup.add(head, mask, eyeL, eyeR, hairGroup);
  bodyGroup.add(headGroup);

  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material instanceof THREE.Material && !mesh.material.transparent) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
  });

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    weaponMount,
    lanternLight,
    lanternOrb,
    hairGroup,
  };
}

export function animateHunterRig(
  rig: HunterRig,
  params: {
    moveSpeed: number;
    isSprinting: boolean;
    isGrounded: boolean;
    attackProgress: number; // 0..1
    dodgeProgress: number; // 0..1
    elapsed: number;
  }
): void {
  const { moveSpeed, isSprinting, isGrounded, attackProgress, dodgeProgress, elapsed } = params;
  const strideFreq = isSprinting ? 13 : 8.5;
  const strideAmp = Math.min(1, moveSpeed / 7) * (isSprinting ? 0.72 : 0.48);

  if (dodgeProgress > 0) {
    rig.bodyGroup.rotation.x = Math.sin(dodgeProgress * Math.PI) * 0.65;
    rig.bodyGroup.position.y = Math.sin(dodgeProgress * Math.PI) * 0.25;
  } else {
    rig.bodyGroup.rotation.x = THREE.MathUtils.lerp(rig.bodyGroup.rotation.x, moveSpeed > 0.5 ? 0.08 : 0, 0.18);
    rig.bodyGroup.position.y = isGrounded
      ? Math.abs(Math.sin(elapsed * strideFreq)) * strideAmp * 0.07 + Math.sin(elapsed * 2.2) * 0.012
      : 0.08;
  }

  if (!isGrounded) {
    rig.leftLeg.rotation.x = -0.35;
    rig.rightLeg.rotation.x = 0.4;
  } else if (moveSpeed > 0.25) {
    rig.leftLeg.rotation.x = Math.sin(elapsed * strideFreq) * strideAmp;
    rig.rightLeg.rotation.x = -Math.sin(elapsed * strideFreq) * strideAmp;
  } else {
    rig.leftLeg.rotation.x = THREE.MathUtils.lerp(rig.leftLeg.rotation.x, 0, 0.2);
    rig.rightLeg.rotation.x = THREE.MathUtils.lerp(rig.rightLeg.rotation.x, 0, 0.2);
  }

  rig.leftArm.rotation.x = moveSpeed > 0.25 ? -Math.sin(elapsed * strideFreq) * strideAmp * 0.75 : Math.sin(elapsed * 2) * 0.04;

  if (attackProgress > 0) {
    const swing = Math.sin(attackProgress * Math.PI);
    rig.rightArm.rotation.x = -1.65 * swing;
    rig.rightArm.rotation.z = -0.45 * swing;
    rig.bodyGroup.rotation.y = swing * 0.35;
  } else {
    rig.rightArm.rotation.x = moveSpeed > 0.25 ? Math.sin(elapsed * strideFreq) * strideAmp * 0.65 : -0.15;
    rig.rightArm.rotation.z = THREE.MathUtils.lerp(rig.rightArm.rotation.z, 0, 0.2);
    rig.bodyGroup.rotation.y = THREE.MathUtils.lerp(rig.bodyGroup.rotation.y, 0, 0.2);
  }
}
