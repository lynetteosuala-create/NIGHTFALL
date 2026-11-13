import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { animateHunterRig, buildHunterModel, type HunterRig } from '../game/models/HunterModel';
import { createContactShadowTexture } from '../game/textures/ProceduralTextures';
import type { CharacterCustomization } from '../game/types';

interface HunterPreviewCanvasProps {
  character: CharacterCustomization;
}

export function HunterPreviewCanvas({ character }: HunterPreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const characterRef = useRef(character);
  characterRef.current = character;

  const rebuildRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(el.clientWidth || 380, el.clientHeight || 420);
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, (el.clientWidth || 380) / (el.clientHeight || 420), 0.1, 50);
    camera.position.set(0, 1.45, 3.85);
    camera.lookAt(0, 1.05, 0);

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e1b18, 0.85);
    const key = new THREE.DirectionalLight(0xfde68a, 1.5);
    key.position.set(2.5, 4, 3);
    const rim = new THREE.DirectionalLight(0x38bdf8, 1.1);
    rim.position.set(-3, 2.5, -2);
    scene.add(hemi, key, rim);

    const shadowTex = createContactShadowTexture();
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.05, 1.18, 0.12, 28),
      new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.7, roughness: 0.3 })
    );
    pedestal.position.y = -0.06;
    scene.add(pedestal);

    let rig: HunterRig | null = null;
    const mountRig = () => {
      if (rig) scene.remove(rig.root);
      rig = buildHunterModel(characterRef.current, shadowTex);
      scene.add(rig.root);
    };
    mountRig();
    rebuildRef.current = mountRig;

    let yaw = 0.25;
    let dragging = false;
    let lastX = 0;

    const onDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.012;
      lastX = e.clientX;
    };
    const onUp = () => {
      dragging = false;
    };

    const canvas = renderer.domElement;
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    const onResize = () => {
      if (!el) return;
      const w = el.clientWidth || 380;
      const h = el.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const dt = Math.min(0.05, clock.getDelta());
      const elapsed = clock.elapsedTime;
      if (!dragging) yaw += dt * 0.35;
      if (rig) {
        rig.root.rotation.y = yaw;
        animateHunterRig(rig, {
          moveSpeed: 0,
          isSprinting: false,
          isGrounded: true,
          attackProgress: 0,
          dodgeProgress: 0,
          elapsed,
        });
      }
      renderer.render(scene, camera);
      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      canvas.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('resize', onResize);
      shadowTex.dispose();
      renderer.dispose();
      if (canvas.parentNode === el) el.removeChild(canvas);
    };
  }, []);

  useEffect(() => {
    rebuildRef.current?.();
  }, [character]);

  return (
    <div className="relative w-full h-full min-h-[340px] rounded-xl border border-white/10 bg-[#0B0F17] overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
      <div className="pointer-events-none absolute bottom-3 inset-x-0 text-center text-xs text-slate-400">
        Drag to rotate 3D Hunter model
      </div>
    </div>
  );
}
