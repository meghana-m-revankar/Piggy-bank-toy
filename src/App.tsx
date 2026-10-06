import { useEffect, useRef } from "react";
import { unlockAudio, sfxTick, sfxClink, sfxWhoosh, sfxSmash, sfxBounce } from "./audio";

const MAX = 20;
const GRAVITY = 2400;

type Coin = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; landed: boolean };
type Shard = { pts: [number, number][]; cx: number; cy: number; x: number; y: number; vx: number; vy: number; rot: number; vr: number };

const ease = {
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  in: (t: number) => t * t * t,
};

// crack polylines in pig units (R), revealed as the pig fills
const CRACKS: [number, number][][] = [
  [[-0.2, -2.0], [-0.35, -1.7], [-0.15, -1.45], [-0.4, -1.15]],
  [[0.5, -1.95], [0.65, -1.65], [0.45, -1.4], [0.7, -1.1], [0.55, -0.75]],
  [[-0.9, -1.55], [-0.7, -1.3], [-0.95, -1.05], [-0.75, -0.7]],
];

function capsule(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, w: number, fill: string, edge: string) {
  ctx.lineCap = "round";
  ctx.strokeStyle = edge; ctx.lineWidth = w + 4;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.strokeStyle = fill; ctx.lineWidth = w;
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

// Cartoon pig, facing right: round body, big snout, big eye looking up at the hand
function drawPig(ctx: CanvasRenderingContext2D, R: number) {
  const OUT = "#d4607f";
  ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.lineWidth = 3; ctx.strokeStyle = OUT;

  // curly tail
  ctx.strokeStyle = "#e2688c"; ctx.lineWidth = R * 0.08;
  ctx.beginPath();
  ctx.moveTo(-R * 1.22, -R * 1.2);
  ctx.bezierCurveTo(-R * 1.7, -R * 1.35, -R * 1.65, -R * 0.8, -R * 1.42, -R * 0.95);
  ctx.bezierCurveTo(-R * 1.3, -R * 1.02, -R * 1.4, -R * 1.2, -R * 1.5, -R * 1.12);
  ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = 3;

  // legs: back pair darker, front pair lighter
  const leg = (x: number, c: string) => {
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.roundRect(x - R * 0.19, -R * 0.6, R * 0.38, R * 0.6, R * 0.14); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#c9506f";
    ctx.beginPath(); ctx.ellipse(x, -R * 0.04, R * 0.16, R * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  };
  leg(-R * 0.85, "#e9799a"); leg(-R * 0.3, "#e9799a");
  leg(R * 0.45, "#f292ae"); leg(R * 0.95, "#f292ae");

  const roundTri = (p: [number, number][], r: number) => {
    const mid = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(p[0], p[1]);
    ctx.beginPath();
    ctx.moveTo(m0[0], m0[1]);
    ctx.arcTo(p[1][0], p[1][1], p[2][0], p[2][1], r);
    ctx.arcTo(p[2][0], p[2][1], p[0][0], p[0][1], r);
    ctx.arcTo(p[0][0], p[0][1], p[1][0], p[1][1], r);
    ctx.closePath();
  };
  ctx.fillStyle = "#f58fae";
  roundTri([[R * 0.3, -R * 1.95], [R * 0.78, -R * 2.5], [R * 1.05, -R * 1.5]], R * 0.14);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#FDD7E4";
  roundTri([[R * 0.5, -R * 2.0], [R * 0.78, -R * 2.3], [R * 0.93, -R * 1.85]], R * 0.07);
  ctx.fill();

  // body with soft shading
  const bg = ctx.createRadialGradient(-R * 0.4, -R * 1.7, R * 0.1, 0, -R * 1.1, R * 1.45);
  bg.addColorStop(0, "#ffc4d2"); bg.addColorStop(0.55, "#f58fae"); bg.addColorStop(1, "#e2688c");
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(0, -R * 1.1, R * 1.3, R * 0.95, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // snout
  ctx.fillStyle = "#f9a3bb";
  ctx.beginPath(); ctx.ellipse(R * 1.32, -R * 1.05, R * 0.34, R * 0.46, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#b8446a";
  ctx.beginPath(); ctx.ellipse(R * 1.22, -R * 1.05, R * 0.06, R * 0.14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(R * 1.42, -R * 1.05, R * 0.06, R * 0.14, 0, 0, Math.PI * 2); ctx.fill();

  // eye (pupil looks up-left toward the hand)
  ctx.fillStyle = "#fff"; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(R * 0.8, -R * 1.45, R * 0.17, R * 0.21, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#1d1218";
  ctx.beginPath(); ctx.arc(R * 0.76, -R * 1.52, R * 0.085, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.arc(R * 0.73, -R * 1.55, R * 0.03, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#a8405f"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(R * 0.8, -R * 1.45, R * 0.24, Math.PI * 1.15, Math.PI * 1.75); ctx.stroke();

  // coin slot on the back
  ctx.fillStyle = "#8c3550";
  ctx.beginPath(); ctx.roundRect(-R * 0.4, -R * 2.07, R * 0.8, R * 0.11, R * 0.05); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fillRect(-R * 0.36, -R * 1.94, R * 0.72, 2);
}

// Hand pinching a coin. Origin = coin centre. gap: 0 = holding, 1 = open.
function drawHand(ctx: CanvasRenderingContext2D, R: number, gap: number, coinIn: number) {
  const c = R * 0.32;
  const SKIN = "#f6c3a1", EDGE = "#c98768";
  if (coinIn > 0.01) {
    ctx.save();
    ctx.globalAlpha *= coinIn; ctx.scale(coinIn, coinIn);
    drawCoin(ctx, c, 0.3, 1.27);
    ctx.restore();
  }
  const tipY = -c * 0.8;
  const g = R * 0.04 + gap * R * 0.2;
  const A = { x: -R * 2.6, y: -R * 3.4 };
  const P = { x: -R * 0.4, y: -R * 0.85 };
  const at = (t: number) => ({ x: A.x + (P.x - A.x) * t, y: A.y + (P.y - A.y) * t });

  capsule(ctx, A.x, A.y, P.x, P.y, R * 0.46, SKIN, EDGE); // forearm
  // sleeve + lime cuff
  const s1 = at(0.62), s2 = at(0.68);
  ctx.lineCap = "butt";
  ctx.strokeStyle = "#223012"; ctx.lineWidth = R * 0.68;
  ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(s1.x, s1.y); ctx.stroke();
  ctx.strokeStyle = "#c6f432"; ctx.lineWidth = R * 0.7;
  ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.stroke();
  // palm
  ctx.fillStyle = SKIN; ctx.strokeStyle = EDGE; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(P.x, P.y, R * 0.3, R * 0.24, 0.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  // index finger + thumb meet at the coin's top rim
  capsule(ctx, P.x + R * 0.06, P.y - R * 0.04, -g, tipY, R * 0.17, SKIN, EDGE);
  capsule(ctx, P.x + R * 0.12, P.y + R * 0.12, g, tipY + R * 0.02, R * 0.17, SKIN, EDGE);
}

function drawCoin(ctx: CanvasRenderingContext2D, r: number, sx: number, rot: number) {
  ctx.save();
  ctx.scale(Math.max(0.12, sx), 1);
  const g = ctx.createLinearGradient(-r, -r, r, r);
  g.addColorStop(0, "#fff3b0");
  g.addColorStop(0.45, "#f5c542");
  g.addColorStop(1, "#b8860b");
  ctx.fillStyle = g;
  ctx.strokeStyle = "#8a6508";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "rgba(138,101,8,0.55)"; // inner ring
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.72, 0, Math.PI * 2);
  ctx.stroke();
  // sweeping specular band: moves as the coin spins
  const gl = Math.sin(rot * 1.3);
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2);
  ctx.clip();
  ctx.rotate(-0.6);
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(gl * r - r * 0.12, -r, r * 0.24, r * 2);
  ctx.restore();
  ctx.restore();
}

export default function App() {
  const ref = useRef<HTMLCanvasElement>(null);
  const countRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const howRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = 0, h = 0, dpr = 1, R = 100;
    let sprite: HTMLCanvasElement | null = null;
    let spriteW = 0, spriteH = 0;

    const buildSprite = () => {
      spriteW = R * 3.6;
      spriteH = R * 2.5;
      sprite = document.createElement("canvas");
      sprite.width = spriteW * dpr;
      sprite.height = spriteH * dpr;
      const sctx = sprite.getContext("2d", { willReadFrequently: true })!;
      sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sctx.translate(R * 1.8, spriteH);
      drawPig(sctx, R);
    };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      R = Math.min(w, h) * 0.2;
      buildSprite();
    };
    resize();
    window.addEventListener("resize", resize);

    const st = {
      mode: "fill" as "fill" | "smash" | "done",
      fill: 0, squash: 0, vsq: 0, appear: 1,
      t: 0, // time since smash started
      shake: 0, flash: 0, freeze: 0, impacted: false, whooshed: false,
    };
    let falling: { y: number; vy: number; rot: number }[] = [];
    let coins: Coin[] = [];
    let shards: Shard[] = [];
    let lastBounce = 0;

    const geo = () => {
      const cx = w / 2;
      const floorY = h / 2 + R * 1.1;
      return { cx, floorY, slotY: floorY - R * 2.0 };
    };

    const makeShards = (cx: number, floorY: number, hitX: number, hitY: number) => {
      const cols = 7, rows = 5;
      const cw = spriteW / cols, ch = spriteH / rows;
      const grid: [number, number][][] = [];
      for (let r = 0; r <= rows; r++) {
        grid[r] = [];
        for (let c = 0; c <= cols; c++) {
          const edge = r === 0 || c === 0 || r === rows || c === cols;
          grid[r][c] = [c * cw + (edge ? 0 : (Math.random() - 0.5) * cw * 0.7), r * ch + (edge ? 0 : (Math.random() - 0.5) * ch * 0.7)];
        }
      }
      const sctx = sprite!.getContext("2d", { willReadFrequently: true })!;
      const out: Shard[] = [];
      const ox = cx - R * 1.8, oy = floorY - spriteH;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const a = grid[r][c], b = grid[r][c + 1], d = grid[r + 1][c], e = grid[r + 1][c + 1];
          for (const tri of [[a, b, d], [b, e, d]] as [number, number][][]) {
            const mx = (tri[0][0] + tri[1][0] + tri[2][0]) / 3;
            const my = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
            if (sctx.getImageData(Math.floor(mx * dpr), Math.floor(my * dpr), 1, 1).data[3] < 10) continue;
            const wx = ox + mx, wy = oy + my;
            const dx = wx - hitX, dy = wy - hitY;
            const len = Math.hypot(dx, dy) || 1;
            const sp = 250 + Math.random() * 450;
            out.push({
              pts: tri, cx: mx, cy: my, x: wx, y: wy,
              vx: (dx / len) * sp, vy: (dy / len) * sp * 0.6 - 250 - Math.random() * 300,
              rot: 0, vr: (Math.random() - 0.5) * 12,
            });
          }
        }
      }
      return out;
    };

    const hand = { phase: "ready" as "ready" | "release" | "reload", t: 0, pending: false, out: 0, coinIn: 1 };

    const drop = () => {
      unlockAudio();
      if (st.mode === "fill") {
        if (st.fill + falling.length >= MAX) return;
        if (hand.phase === "ready") { hand.phase = "release"; hand.t = 0; }
        else if (hand.phase === "reload") hand.pending = true;
      } else if (st.mode === "done" && st.t > 2.2) {
        st.mode = "fill"; st.fill = 0; st.appear = 0; st.vsq = 0; st.squash = 0;
        st.impacted = false; st.whooshed = false;
        hand.phase = "ready"; hand.pending = false; hand.coinIn = 1;
        coins = []; shards = [];
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat) { e.preventDefault(); drop(); }
    };
    canvas.addEventListener("pointerdown", drop);
    window.addEventListener("keydown", onKey);

    const setText = (el: HTMLElement | null, t: string) => { if (el && el.textContent !== t) el.textContent = t; };

    let last = performance.now();
    let raf = 0;

    const frame = (now: number) => {
      let dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      if (st.freeze > 0) { st.freeze -= dt; dt = 0; } // hit-stop

      const { cx, floorY, slotY } = geo();
      const coinR = R * 0.32;

      // pig spring + appear
      st.vsq += (-220 * st.squash - 12 * st.vsq) * dt;
      st.squash += st.vsq * dt;
      if (st.appear < 1) st.appear = Math.min(1, st.appear + dt * 2.5);

      // hand: holds a coin, lets go on tap, reloads
      let dip = 0, gap = 0;
      const bob = Math.sin(now * 0.004) * R * 0.03;
      hand.out = Math.min(1, Math.max(0, hand.out + (st.mode !== "fill" ? dt * 3 : -dt * 2.5)));
      if (hand.phase === "release") {
        hand.t += dt;
        const k = Math.min(hand.t / 0.1, 1);
        dip = R * 0.12 * k; gap = k;
        if (hand.t >= 0.1) {
          if (st.fill + falling.length < MAX) { falling.push({ y: slotY - R * 1.1 + dip + bob, vy: 0, rot: 1.27 }); sfxTick(); }
          hand.phase = "reload"; hand.t = 0; hand.coinIn = 0;
        }
      } else if (hand.phase === "reload") {
        hand.t += dt;
        const k = Math.min(hand.t / 0.18, 1);
        dip = R * 0.12 * (1 - ease.out(k)); gap = 1 - ease.out(k);
        hand.coinIn = ease.out(Math.max(0, (k - 0.4) / 0.6));
        if (hand.t >= 0.18) {
          hand.phase = "ready"; hand.coinIn = 1;
          if (hand.pending) { hand.pending = false; if (st.mode === "fill") { hand.phase = "release"; hand.t = 0; } }
        }
      }

      // coins falling into the slot
      for (let i = falling.length - 1; i >= 0; i--) {
        const co = falling[i];
        co.vy += GRAVITY * dt; co.y += co.vy * dt; co.rot += dt * 9;
        if (co.y > slotY + coinR * 1.2) {
          falling.splice(i, 1);
          st.fill++;
          st.vsq += 3.2;
          sfxClink(st.fill);
          if (st.fill >= MAX && st.mode === "fill") { st.mode = "smash"; st.t = 0; }
        }
      }

      // smash timeline: wind-up -> strike -> impact
      const hitX = cx + R * 0.1, hitY = floorY - R * 1.85;
      const L = R * 2.6;
      const px = hitX + L * 0.8, py = hitY - L * 0.6; // hammer pivot
      let hammerA = 5.0, hammerAlpha = 0;
      if (st.mode !== "fill") {
        st.t += dt;
        const t = st.t;
        if (t < 0.5) {
          if (!st.whooshed && t > 0.35) { st.whooshed = true; sfxWhoosh(); }
          hammerA = 5.0 + 0.5 * ease.out(Math.min(t / 0.5, 1));
          hammerAlpha = Math.min(t / 0.2, 1);
        } else if (t < 0.66) {
          hammerA = 5.5 - 3.0 * ease.in((t - 0.5) / 0.16);
          hammerAlpha = 1;
        } else {
          hammerA = 2.5; hammerAlpha = 1;
          if (!st.impacted) {
            st.impacted = true;
            st.freeze = 0.08; st.shake = 22; st.flash = 0.7;
            sfxSmash();
            shards = makeShards(cx, floorY, hitX, hitY);
            for (let i = 0; i < MAX; i++) {
              const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
              const sp = 350 + Math.random() * 650;
              coins.push({ x: cx + (Math.random() - 0.5) * R, y: floorY - R * 1.4, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, rot: Math.random() * 6, vr: 8 + Math.random() * 10, landed: false });
            }
          }
          if (t > 1.3) hammerAlpha = Math.max(0, 1 - (t - 1.3) / 0.4);
          if (t > 1.7) st.mode = "done";
        }
      }

      // debris physics (shards + coins)
      for (const s of shards) {
        s.vy += GRAVITY * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.rot += s.vr * dt;
        if (s.y > floorY - 6) { s.y = floorY - 6; s.vy *= -0.3; s.vx *= 0.6; s.vr *= 0.5; }
      }
      for (const c of coins) {
        c.vy += GRAVITY * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.rot += c.vr * dt;
        const groundY = floorY + R * 0.1 - coinR + Math.sin(c.x) * 6;
        if (c.y > groundY) {
          if (c.vy > 250 && now - lastBounce > 40) { sfxBounce(); lastBounce = now; }
          c.y = groundY; c.vy *= -0.45; c.vx *= 0.75; c.vr *= 0.6;
          if (Math.abs(c.vy) < 80) { c.vy = 0; c.landed = true; }
        }
        if (c.x < coinR) { c.x = coinR; c.vx *= -0.5; }
        if (c.x > w - coinR) { c.x = w - coinR; c.vx *= -0.5; }
      }

      st.shake *= Math.exp(-9 * dt);
      st.flash *= Math.exp(-7 * dt);

      // ---------- draw ----------
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      if (st.shake > 0.3) ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);

      // shadow
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.beginPath();
      ctx.ellipse(cx, floorY + 6, R * 1.35, R * 0.16, 0, 0, Math.PI * 2);
      ctx.fill();

      // pig (hidden once smashed)
      if (!(st.mode !== "fill" && st.impacted)) {
        const p = st.fill / MAX;
        const tremble = p > 0.7 ? Math.sin(now * 0.06) * (p - 0.7) * 22 : 0;
        const pop = 0.6 + 0.4 * (1 - Math.pow(1 - st.appear, 3));
        ctx.save();
        ctx.translate(cx + tremble, floorY);
        ctx.scale((1 + st.squash * 0.5) * pop, (1 - st.squash) * pop);
        drawPig(ctx, R);
        // cracks
        if (p > 0.25) {
          const reveal = (p - 0.25) / 0.75;
          ctx.lineCap = "round"; ctx.lineJoin = "round";
          for (const cr of CRACKS) {
            const n = Math.max(2, Math.ceil(reveal * cr.length));
            ctx.beginPath();
            cr.slice(0, n).forEach(([x, y], i) => (i ? ctx.lineTo(x * R, y * R) : ctx.moveTo(x * R, y * R)));
            ctx.strokeStyle = "#6b2b3b"; ctx.lineWidth = 2.5; ctx.stroke();
            if (p > 0.7) {
              ctx.shadowColor = "#ffd166"; ctx.shadowBlur = 14;
              ctx.strokeStyle = "rgba(255,226,140,0.9)"; ctx.lineWidth = 1; ctx.stroke();
              ctx.shadowBlur = 0;
            }
          }
        }
        ctx.restore();
      }

      // shards
      for (const s of shards) {
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.beginPath();
        s.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - s.cx, y - s.cy) : ctx.moveTo(x - s.cx, y - s.cy)));
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(sprite!, -s.cx, -s.cy, spriteW, spriteH);
        ctx.strokeStyle = "rgba(110,40,60,0.45)"; ctx.lineWidth = 2; ctx.stroke();
        ctx.restore();
      }

      // falling coins (clipped at the slot so they slide in)
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, w, slotY); ctx.clip();
      for (const co of falling) {
        const near = Math.min(Math.max((co.y - (slotY - R * 1.3)) / (R * 1.3), 0), 1);
        const sx = Math.abs(Math.cos(co.rot)) * (1 - near) + 0.12 * near; // turns edge-on at the slot
        ctx.save(); ctx.translate(cx, co.y); drawCoin(ctx, coinR, sx, co.rot); ctx.restore();
      }
      ctx.restore();

      // hand
      if (hand.out < 0.98) {
        ctx.save();
        ctx.globalAlpha = 1 - hand.out;
        ctx.translate(cx, slotY - R * 1.1 + dip + bob - hand.out * R * 1.5);
        drawHand(ctx, R, gap, hand.coinIn);
        ctx.restore();
      }

      // spilled coins
      for (const c of coins) {
        const sx = c.landed ? 1 : Math.abs(Math.cos(c.rot));
        ctx.save(); ctx.translate(c.x, c.y); drawCoin(ctx, coinR, sx, c.rot); ctx.restore();
      }

      // hammer
      if (hammerAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = hammerAlpha;
        ctx.translate(px, py);
        ctx.rotate(hammerA);
        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(0, -R * 0.07, L - R * 0.1, R * 0.14);
        const hg = ctx.createLinearGradient(0, -R * 0.4, 0, R * 0.4);
        hg.addColorStop(0, "#d9dde2"); hg.addColorStop(0.5, "#8c939c"); hg.addColorStop(1, "#4b5159");
        ctx.fillStyle = hg;
        ctx.fillRect(L - R * 0.25, -R * 0.4, R * 0.5, R * 0.8);
        ctx.restore();
      }
      ctx.restore();

      if (st.flash > 0.01) { ctx.fillStyle = `rgba(255,255,255,${st.flash})`; ctx.fillRect(0, 0, w, h); }

      // HUD (DOM, so typography stays crisp)
      setText(countRef.current, `${String(Math.min(st.fill, MAX)).padStart(2, "0")} / ${MAX}`);
      let hint = "";
      if (st.mode === "fill") hint = st.fill === 0 ? "Tap to drop a coin" : st.fill >= MAX - 4 ? "Almost there…" : `${MAX - st.fill} more`;
      else if (st.mode === "done" && st.t > 2.2) hint = "Tap to fill a new one";
      setText(hintRef.current, hint);
      if (howRef.current) howRef.current.style.opacity = st.fill > 0 || st.mode !== "fill" ? "0" : "0.7";

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", drop);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
   
      <canvas
        ref={ref}
        style={{ position: "fixed", inset: 0, width: "100%", height: "100%", zIndex: 1, touchAction: "none" }}
      />
      <div style={{ position: "fixed", inset: 0, zIndex: 2, pointerEvents: "none", color: "#fff", userSelect: "none", fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <div style={{ position: "absolute", top: 24, left: 24 }}>
          <div ref={countRef} style={{ fontFamily: "ui-monospace, Consolas, monospace", fontSize: 28, letterSpacing: 1 }}>00 / {MAX}</div>
          <div style={{ opacity: 0.5, fontSize: 12, marginTop: 4, letterSpacing: 1.5, textTransform: "uppercase" }}>coins</div>
        </div>
        <div ref={howRef} style={{ position: "absolute", top: 24, right: 24, maxWidth: 240, textAlign: "right", fontSize: 13, lineHeight: 1.55, opacity: 0.7, transition: "opacity 0.6s ease" }}>
          <div style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", opacity: 0.7, marginBottom: 4 }}>How to play</div>
          Tap anywhere (or press Space) to drop a coin. Fill the pig with {MAX} coins and see what happens.
        </div>
        <div ref={hintRef} style={{ position: "absolute", bottom: 36, left: 0, right: 0, textAlign: "center", fontSize: 15, letterSpacing: 0.4, opacity: 0.85 }} />
      </div>
    </>
  );
}
