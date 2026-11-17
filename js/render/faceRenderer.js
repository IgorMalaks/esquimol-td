// Renderização procedural de rostos, esquimós e itens (ADR-009).
// Um único "rosto" serve para esquimós e inimigos — o admin usa o mesmo criador.
import { RARITIES } from '../data/defaults.js';

const TAU = Math.PI * 2;

function shapePath(ctx, shape, r) {
  ctx.beginPath();
  switch (shape) {
    case 'oval': ctx.ellipse(0, 0, r * 0.82, r, 0, 0, TAU); break;
    case 'quadrado': ctx.roundRect(-r, -r, r * 2, r * 2, r * 0.35); break;
    case 'coracao':
      ctx.moveTo(0, r);
      ctx.bezierCurveTo(-r * 1.35, r * 0.1, -r * 0.95, -r * 1.15, 0, -r * 0.55);
      ctx.bezierCurveTo(r * 0.95, -r * 1.15, r * 1.35, r * 0.1, 0, r);
      break;
    case 'gota':
      ctx.moveTo(0, -r * 1.05);
      ctx.bezierCurveTo(r * 0.95, -r * 0.2, r * 1.05, r * 0.95, 0, r);
      ctx.bezierCurveTo(-r * 1.05, r * 0.95, -r * 0.95, -r * 0.2, 0, -r * 1.05);
      break;
    default: ctx.arc(0, 0, r, 0, TAU);
  }
  ctx.closePath();
}

function circle(ctx, x, y, r, fill, stroke) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) ctx.stroke();
}

function star(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

function headwearBack(ctx, f, r) {
  if (f.headwear === 'capuz') {
    circle(ctx, 0, 0, r * 1.3, f.headwearColor, true);
    circle(ctx, 0, 0, r * 1.12, '#fbfdff', true);
  } else if (f.headwear === 'orelhas') {
    for (const s of [-1, 1]) {
      circle(ctx, s * r * 0.9, -r * 0.55, r * 0.32, f.skin, true);
      circle(ctx, s * r * 0.9, -r * 0.55, r * 0.16, '#ff9fb3');
    }
  }
}

function headwearFront(ctx, f, r) {
  ctx.fillStyle = f.headwearColor;
  switch (f.headwear) {
    case 'gorro':
      ctx.beginPath();
      ctx.moveTo(-r * 0.95, -r * 0.4);
      ctx.quadraticCurveTo(-r * 0.9, -r * 1.35, 0, -r * 1.35);
      ctx.quadraticCurveTo(r * 0.9, -r * 1.35, r * 0.95, -r * 0.4);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(-r * 1.02, -r * 0.62, r * 2.04, r * 0.3, r * 0.12);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
      circle(ctx, 0, -r * 1.42, r * 0.2, '#ffffff', true);
      break;
    case 'chifres':
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * r * 0.5, -r * 0.7);
        ctx.quadraticCurveTo(s * r * 1.15, -r * 1.05, s * r * 0.95, -r * 1.6);
        ctx.quadraticCurveTo(s * r * 0.72, -r * 1.05, s * r * 0.18, -r * 0.88);
        ctx.closePath(); ctx.fillStyle = f.headwearColor; ctx.fill(); ctx.stroke();
      }
      break;
    case 'coroa':
      ctx.beginPath();
      [[-0.6, -0.72], [-0.68, -1.38], [-0.3, -1.02], [0, -1.48], [0.3, -1.02], [0.68, -1.38], [0.6, -0.72]]
        .forEach(([x, y]) => ctx.lineTo(x * r, y * r));
      ctx.closePath(); ctx.fill(); ctx.stroke();
      circle(ctx, 0, -r * 0.92, r * 0.1, '#e84393', true);
      break;
    case 'cabelo': {
      ctx.beginPath();
      ctx.moveTo(-r * 0.9, -r * 0.35);
      const n = 7;
      for (let i = 0; i <= n; i++) {
        const x = -r * 0.9 + (r * 1.8 * i) / n;
        ctx.lineTo(x, i % 2 ? -r * 1.3 : -r * 0.8);
      }
      ctx.lineTo(r * 0.9, -r * 0.35);
      ctx.quadraticCurveTo(0, -r * 0.75, -r * 0.9, -r * 0.35);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      break;
    }
    default: break;
  }
}

function eyes(ctx, f, r, lw) {
  const ey = -r * 0.12;
  const er = r * 0.14;
  const xs = [-r * 0.36, r * 0.36];
  ctx.fillStyle = f.eyeColor;
  switch (f.eyes) {
    case 'bravos':
      for (const [i, x] of xs.entries()) {
        circle(ctx, x, ey, er * 1.3, '#ffffff', true);
        circle(ctx, x, ey + er * 0.15, er * 0.7, f.eyeColor);
        const s = i ? 1 : -1;
        ctx.save(); ctx.lineWidth = lw * 1.5;
        ctx.beginPath(); ctx.moveTo(s * r * 0.62, ey - r * 0.32); ctx.lineTo(s * r * 0.12, ey - r * 0.16); ctx.stroke();
        ctx.restore();
      }
      break;
    case 'felizes':
      ctx.save(); ctx.strokeStyle = f.eyeColor; ctx.lineWidth = lw * 1.3;
      for (const x of xs) { ctx.beginPath(); ctx.arc(x, ey + er * 0.5, er, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
      ctx.restore();
      break;
    case 'sonolentos':
      for (const x of xs) {
        circle(ctx, x, ey, er * 1.2, '#ffffff', true);
        circle(ctx, x, ey + er * 0.4, er * 0.6, f.eyeColor);
        ctx.beginPath(); ctx.arc(x, ey, er * 1.25, Math.PI, TAU); ctx.closePath();
        ctx.fillStyle = f.skin; ctx.fill(); ctx.stroke();
      }
      break;
    case 'ciclope':
      circle(ctx, 0, ey, r * 0.34, '#ffffff', true);
      circle(ctx, 0, ey, r * 0.18, f.eyeColor);
      circle(ctx, 0, ey, r * 0.08, '#111111');
      circle(ctx, r * 0.07, ey - r * 0.07, r * 0.04, '#ffffff');
      break;
    case 'estrelas':
      for (const x of xs) { star(ctx, x, ey, er * 1.45); ctx.fillStyle = f.eyeColor; ctx.fill(); ctx.stroke(); }
      break;
    default:
      for (const x of xs) {
        circle(ctx, x, ey, er, f.eyeColor);
        circle(ctx, x + er * 0.3, ey - er * 0.3, er * 0.35, '#ffffff');
      }
  }
}

function mouth(ctx, f, r) {
  const my = r * 0.38;
  switch (f.mouth) {
    case 'triste':
      ctx.beginPath(); ctx.arc(0, my + r * 0.2, r * 0.28, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      break;
    case 'aberta':
      ctx.beginPath(); ctx.ellipse(0, my, r * 0.22, r * 0.18, 0, 0, TAU);
      ctx.fillStyle = '#5a1a1a'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, my + r * 0.08, r * 0.12, r * 0.06, 0, 0, TAU);
      ctx.fillStyle = '#ff6b81'; ctx.fill();
      break;
    case 'dentes':
      ctx.beginPath(); ctx.roundRect(-r * 0.3, my - r * 0.1, r * 0.6, r * 0.24, r * 0.06);
      ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.stroke();
      ctx.beginPath();
      for (const x of [-0.1, 0.1]) { ctx.moveTo(x * r, my - r * 0.1); ctx.lineTo(x * r, my + r * 0.14); }
      ctx.moveTo(-r * 0.3, my + r * 0.02); ctx.lineTo(r * 0.3, my + r * 0.02);
      ctx.save(); ctx.lineWidth /= 2; ctx.stroke(); ctx.restore();
      break;
    case 'reta':
      ctx.beginPath(); ctx.moveTo(-r * 0.25, my); ctx.lineTo(r * 0.25, my); ctx.stroke();
      break;
    case 'lingua':
      ctx.beginPath(); ctx.ellipse(r * 0.08, my + r * 0.12, r * 0.09, r * 0.12, 0, 0, TAU);
      ctx.fillStyle = '#ff6b81'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, my - r * 0.15, r * 0.32, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, my - r * 0.15, r * 0.32, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
  }
}

function accessoryUnder(ctx, f, r) {
  if (f.accessory !== 'bochechas') return;
  ctx.save(); ctx.globalAlpha = 0.55;
  for (const s of [-1, 1]) circle(ctx, s * r * 0.55, r * 0.18, r * 0.14, f.accessoryColor);
  ctx.restore();
}

function accessoryOver(ctx, f, r, lw) {
  const c = f.accessoryColor;
  switch (f.accessory) {
    case 'cachecol':
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.roundRect(-r * 0.85, r * 0.72, r * 1.7, r * 0.3, r * 0.12); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.roundRect(r * 0.3, r * 0.85, r * 0.26, r * 0.55, r * 0.08); ctx.fill(); ctx.stroke();
      break;
    case 'oculos':
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw * 1.2;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.arc(s * r * 0.36, -r * 0.12, r * 0.26, 0, TAU);
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fill(); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(-r * 0.1, -r * 0.14); ctx.lineTo(r * 0.1, -r * 0.14); ctx.stroke();
      ctx.restore();
      break;
    case 'bigode':
      ctx.fillStyle = c;
      for (const s of [-1, 1]) {
        ctx.beginPath(); ctx.ellipse(s * r * 0.18, r * 0.2, r * 0.2, r * 0.08, s * -0.3, 0, TAU); ctx.fill();
      }
      break;
    case 'cicatriz':
      ctx.save(); ctx.strokeStyle = c; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(r * 0.15, -r * 0.48); ctx.lineTo(r * 0.58, r * 0.15); ctx.stroke();
      ctx.lineWidth = lw * 0.6;
      for (const t of [0.25, 0.5, 0.75]) {
        const x = r * (0.15 + 0.43 * t);
        const y = r * (-0.48 + 0.63 * t);
        ctx.beginPath(); ctx.moveTo(x - r * 0.08, y + r * 0.05); ctx.lineTo(x + r * 0.08, y - r * 0.05); ctx.stroke();
      }
      ctx.restore();
      break;
    default: break;
  }
}

export function drawFace(ctx, f, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  const lw = Math.max(1.2, r * 0.09);
  ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = f.outline || '#1b1b1b';
  headwearBack(ctx, f, r);
  shapePath(ctx, f.shape, r);
  ctx.fillStyle = f.skin; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  ctx.beginPath(); ctx.ellipse(-r * 0.35, -r * 0.45, r * 0.45, r * 0.28, -0.5, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.beginPath(); ctx.ellipse(0, r * 0.95, r * 1.1, r * 0.5, 0, 0, TAU); ctx.fill();
  ctx.restore();
  shapePath(ctx, f.shape, r); ctx.stroke();
  accessoryUnder(ctx, f, r);
  eyes(ctx, f, r, lw);
  mouth(ctx, f, r);
  accessoryOver(ctx, f, r, lw);
  headwearFront(ctx, f, r);
  ctx.restore();
}

// Cache de sprites: rosto rasterizado uma vez por (design, tamanho em px reais).
const faceCache = new Map();
const CACHE_MAX = 300;

export function drawFaceCached(ctx, f, x, y, r, pxScale = 1) {
  const pr = Math.max(4, Math.round(r * pxScale));
  const key = `${JSON.stringify(f)}|${pr}`;
  let c = faceCache.get(key);
  if (!c) {
    const size = Math.ceil(pr * 3.4);
    c = document.createElement('canvas');
    c.width = c.height = size;
    drawFace(c.getContext('2d'), f, size / 2, size / 2, pr);
    if (faceCache.size >= CACHE_MAX) faceCache.delete(faceCache.keys().next().value);
    faceCache.set(key, c);
  }
  const w = c.width * (r / pr);
  ctx.drawImage(c, x - w / 2, y - w / 2, w, w);
}

function weapon(ctx, classId, r) {
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  switch (classId) {
    case 'arqueiro':
      ctx.strokeStyle = '#8e5a2b';
      ctx.beginPath(); ctx.arc(r * 0.75, 0, r * 0.75, -Math.PI / 2.2, Math.PI / 2.2); ctx.stroke();
      ctx.strokeStyle = '#eeeeee'; ctx.lineWidth /= 2.5;
      ctx.beginPath(); ctx.moveTo(r * 0.92, -r * 0.73); ctx.lineTo(r * 0.92, r * 0.73); ctx.stroke();
      break;
    case 'bolanev':
      ctx.strokeStyle = '#1b1b1b';
      circle(ctx, r * 1.0, r * 0.4, r * 0.34, '#ffffff', true);
      break;
    case 'arpoador':
      ctx.strokeStyle = '#7f8c8d';
      ctx.beginPath(); ctx.moveTo(-r * 0.3, r * 0.45); ctx.lineTo(r * 1.65, r * 0.45); ctx.stroke();
      ctx.fillStyle = '#dfe6e9'; ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth /= 2;
      ctx.beginPath(); ctx.moveTo(r * 1.95, r * 0.45); ctx.lineTo(r * 1.6, r * 0.25); ctx.lineTo(r * 1.6, r * 0.65); ctx.closePath();
      ctx.fill(); ctx.stroke();
      break;
    case 'mago':
      ctx.strokeStyle = '#6d4c41';
      ctx.beginPath(); ctx.moveTo(r * 0.1, r * 0.6); ctx.lineTo(r * 1.25, r * 0.6); ctx.stroke();
      ctx.save(); ctx.shadowColor = '#7efcff'; ctx.shadowBlur = r * 0.6;
      ctx.strokeStyle = '#1b1b1b'; ctx.lineWidth /= 2;
      circle(ctx, r * 1.4, r * 0.6, r * 0.24, '#48dbfb', true);
      ctx.restore();
      break;
    default: break;
  }
}

export function drawEskimo(ctx, def, x, y, r, angle = -Math.PI / 2, pxScale = 1) {
  ctx.save();
  ctx.fillStyle = 'rgba(0,40,80,0.18)';
  ctx.beginPath(); ctx.ellipse(x, y, r * 0.95, r * 0.35, 0, 0, TAU); ctx.fill();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.strokeStyle = '#1b1b1b';
  ctx.fillStyle = '#59453d';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(side * r * 0.36, -r * 0.12, r * 0.28, r * 0.19, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = def.bodyColor;
  ctx.beginPath();
  ctx.moveTo(-r * 0.78, -r * 0.36);
  ctx.quadraticCurveTo(-r * 0.82, -r * 1.55, 0, -r * 1.55);
  ctx.quadraticCurveTo(r * 0.82, -r * 1.55, r * 0.78, -r * 0.36);
  ctx.quadraticCurveTo(0, -r * 0.02, -r * 0.78, -r * 0.36);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fbfdff';
  ctx.fillRect(-r * 0.07, -r * 1.14, r * 0.14, r * 0.81);
  ctx.translate(Math.cos(angle) * r * 0.3, -r * 0.8);
  ctx.rotate(angle);
  weapon(ctx, def.classId, r * 0.75);
  circle(ctx, r * 0.48, 0, r * 0.24, '#fbfdff', true);
  ctx.restore();
  drawFaceCached(ctx, def.face, x, y - r * 1.53, r * 0.7, pxScale);
}

export function drawItemIcon(ctx, item, x, y, r) {
  const color = RARITIES[item.rarity]?.color || '#9aa5ab';
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.2, r * 0.12); ctx.strokeStyle = '#1b1b1b'; ctx.lineJoin = 'round';
  circle(ctx, 0, 0, r, color, true);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (item.type === 'arma') {
    ctx.moveTo(-r * 0.5, r * 0.5); ctx.lineTo(r * 0.35, -r * 0.35); ctx.lineTo(r * 0.55, -r * 0.55);
    ctx.lineTo(r * 0.45, -r * 0.2); ctx.lineTo(-r * 0.35, r * 0.6); ctx.closePath();
  } else if (item.type === 'armadura') {
    ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.5, -r * 0.4); ctx.lineTo(r * 0.4, r * 0.2);
    ctx.lineTo(0, r * 0.6); ctx.lineTo(-r * 0.4, r * 0.2); ctx.lineTo(-r * 0.5, -r * 0.4); ctx.closePath();
  } else {
    ctx.moveTo(0, -r * 0.6); ctx.lineTo(r * 0.45, 0); ctx.lineTo(0, r * 0.6); ctx.lineTo(-r * 0.45, 0); ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

export function drawChest(ctx, x, y, r) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineWidth = Math.max(1.2, r * 0.1); ctx.strokeStyle = '#1b1b1b';
  ctx.fillStyle = '#a0522d';
  ctx.beginPath(); ctx.roundRect(-r, -r * 0.55, r * 2, r * 1.3, r * 0.2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c47a3a';
  ctx.beginPath(); ctx.roundRect(-r, -r * 0.85, r * 2, r * 0.55, r * 0.25); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#f1c40f';
  ctx.fillRect(-r * 0.15, -r * 0.85, r * 0.3, r * 1.6); ctx.strokeRect(-r * 0.15, -r * 0.85, r * 0.3, r * 1.6);
  ctx.restore();
}

// ---------- Helpers de DOM: canvas pequenos para menus ----------
function hiDpiCanvas(size, cls) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = `${size}px`;
  if (cls) c.className = cls;
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  return [c, ctx];
}

export function faceCanvas(face, size = 64, cls = 'face-canvas') {
  const [c, ctx] = hiDpiCanvas(size, cls);
  drawFace(ctx, face, size / 2, size / 2 + size * 0.06, size * 0.3);
  return c;
}

export function eskimoCanvas(def, size = 64, cls = 'face-canvas') {
  const [c, ctx] = hiDpiCanvas(size, cls);
  drawEskimo(ctx, def, size * 0.45, size * 0.85, size * 0.28, 0, Math.min(window.devicePixelRatio || 1, 2));
  return c;
}

export function itemCanvas(item, size = 36, cls = 'item-canvas') {
  const [c, ctx] = hiDpiCanvas(size, cls);
  drawItemIcon(ctx, item, size / 2, size / 2, size * 0.42);
  return c;
}
