import * as THREE from 'three';

function makeCanvas(size = 512): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeColorTexture(
  canvas: HTMLCanvasElement,
  repeatX: number,
  repeatY: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = Math.min(8, maxAnisotropy);
  tex.needsUpdate = true;
  return tex;
}

export function createCobblestoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512);
  ctx.fillStyle = '#181c24';
  ctx.fillRect(0, 0, 512, 512);

  const rows = 12;
  const cols = 8;
  const cellW = 512 / cols;
  const cellH = 512 / rows;

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : cellW * 0.5;
    for (let c = -1; c <= cols; c++) {
      const x = c * cellW + offset + 3;
      const y = r * cellH + 3;
      const w = cellW - 6;
      const h = cellH - 6;
      const shade = 26 + Math.floor(Math.random() * 20);
      ctx.fillStyle = `rgb(${shade}, ${shade + 4}, ${shade + 12})`;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 5);
      ctx.fill();

      // Wet rain sheen highlight
      ctx.fillStyle = `rgba(120, 160, 210, ${0.04 + Math.random() * 0.08})`;
      ctx.fillRect(x + 4, y + 3, w - 8, 4);
    }
  }
  return finalizeColorTexture(canvas, 18, 18, maxAnisotropy);
}

export function createHospitalTileTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512);
  ctx.fillStyle = '#1e2124';
  ctx.fillRect(0, 0, 512, 512);

  const grid = 8;
  const step = 512 / grid;
  for (let r = 0; r < grid; r++) {
    for (let c = 0; c < grid; c++) {
      const base = (r + c) % 2 === 0 ? 44 : 36;
      const grime = Math.floor(Math.random() * 10);
      ctx.fillStyle = `rgb(${base + grime}, ${base + grime + 2}, ${base + grime - 2})`;
      ctx.fillRect(c * step + 2, r * step + 2, step - 4, step - 4);
    }
  }
  // Water puddles & wear smudges
  for (let i = 0; i < 18; i++) {
    const gx = Math.random() * 512;
    const gy = Math.random() * 512;
    const rad = 18 + Math.random() * 44;
    const grad = ctx.createRadialGradient(gx, gy, 2, gx, gy, rad);
    grad.addColorStop(0, 'rgba(12, 16, 14, 0.45)');
    grad.addColorStop(1, 'rgba(12, 16, 14, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(gx, gy, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeColorTexture(canvas, 14, 14, maxAnisotropy);
}

export function createForestGroundTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512);
  ctx.fillStyle = '#141a15';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 650; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const r = 3 + Math.random() * 14;
    const g = 24 + Math.floor(Math.random() * 24);
    ctx.fillStyle = `rgba(${Math.floor(g * 0.7)}, ${g}, ${Math.floor(g * 0.65)}, 0.4)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalizeColorTexture(canvas, 20, 20, maxAnisotropy);
}

export function createLabFloorTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512);
  ctx.fillStyle = '#111920';
  ctx.fillRect(0, 0, 512, 512);

  const step = 64;
  ctx.strokeStyle = '#1e303b';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 512; i += step) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(512, i);
    ctx.stroke();
  }
  // Subtle hazard stripe border inside panels
  ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 4 === 0) {
        ctx.fillRect(c * step + 8, r * step + 8, step - 16, step - 16);
      }
    }
  }
  return finalizeColorTexture(canvas, 16, 16, maxAnisotropy);
}

export function createCitadelStoneTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512);
  ctx.fillStyle = '#191318';
  ctx.fillRect(0, 0, 512, 512);

  const step = 128;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const shade = 26 + Math.floor(Math.random() * 14);
      ctx.fillStyle = `rgb(${shade + 6}, ${shade}, ${shade + 5})`;
      ctx.fillRect(c * step + 3, r * step + 3, step - 6, step - 6);
    }
  }
  // Faint crimson ritual fractures
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.22)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 12; i++) {
    ctx.beginPath();
    let x = Math.random() * 512;
    let y = Math.random() * 512;
    ctx.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      x += (Math.random() - 0.5) * 90;
      y += (Math.random() - 0.5) * 90;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return finalizeColorTexture(canvas, 16, 16, maxAnisotropy);
}

export function createBuildingFacadeTexture(maxAnisotropy: number, litWindows = true): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(512);
  ctx.fillStyle = '#161a22';
  ctx.fillRect(0, 0, 512, 512);

  // Masonry bands
  ctx.fillStyle = '#1c212b';
  for (let y = 0; y < 512; y += 32) {
    ctx.fillRect(0, y, 512, 2);
  }

  // Tall gothic/abandoned windows
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      const wx = 32 + col * 120;
      const wy = 32 + row * 120;
      const isLit = litWindows && Math.random() < 0.22;
      ctx.fillStyle = isLit ? '#9a6827' : '#0b0e14';
      ctx.fillRect(wx, wy, 56, 82);
      ctx.strokeStyle = '#29303d';
      ctx.lineWidth = 4;
      ctx.strokeRect(wx, wy, 56, 82);
    }
  }

  return finalizeColorTexture(canvas, 2, 2, maxAnisotropy);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const [canvas, ctx] = makeCanvas(128);
  const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.34)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
