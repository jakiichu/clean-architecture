import {useEffect, useRef} from 'react';
import type {ReactNode} from 'react';
import styles from './styles.module.css';

const COLORS = ['#818cf8', '#60a5fa', '#22d3ee'] as const;
const ZONE_Y = [0.22, 0.52, 0.82] as const;

const NODE_COUNT = 46;
const MAX_DIST = 150;   // edge drawing threshold
const MIN_SEP = 72;     // repulsion distance between nodes
const MAX_SPEED = 0.55;
const MIN_SPEED = 0.1;
const PACKET_EVERY = 32;

interface Dot {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    ci: 0 | 1 | 2;
}

interface Packet {
    ai: number;
    bi: number;
    t: number;
    spd: number;
}

function parseRgb(hex: string): [number, number, number] {
    return [
        parseInt(hex.slice(1, 3), 16),
        parseInt(hex.slice(3, 5), 16),
        parseInt(hex.slice(5, 7), 16),
    ];
}

/** Clamp speed to [min, max] without changing direction */
function clampSpeed(vx: number, vy: number, min: number, max: number): [number, number] {
    const spd = Math.hypot(vx, vy);
    if (spd === 0) {
        const a = Math.random() * Math.PI * 2;
        return [Math.cos(a) * min, Math.sin(a) * min];
    }
    const target = Math.max(min, Math.min(max, spd));
    return [vx / spd * target, vy / spd * target];
}

export const ArchBackground = (): ReactNode => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let rafId: number;
        let frame = 0;
        const dots: Dot[] = [];
        const packets: Packet[] = [];

        const fit = () => {
            canvas.width = canvas.offsetWidth;
            canvas.height = canvas.offsetHeight;
        };
        fit();
        window.addEventListener('resize', fit);

        const W = () => canvas.width;
        const H = () => canvas.height;

        // ── Initialise dots with distributed x-positions ──
        // Split canvas into columns so nodes start well spread out
        const cols = Math.ceil(NODE_COUNT / 3); // nodes per layer
        for (let i = 0; i < NODE_COUNT; i++) {
            const ci = (i % 3) as 0 | 1 | 2;
            const col = Math.floor(i / 3);               // which column slot
            const slotW = W() / cols;
            const x = slotW * col + slotW * 0.1 + Math.random() * slotW * 0.8;
            const zoneBand = H() * 0.22;
            const y = ZONE_Y[ci] * H() + (Math.random() - 0.5) * zoneBand;
            const angle = Math.random() * Math.PI * 2;
            const spd = MIN_SPEED + Math.random() * 0.2;
            dots.push({
                x: Math.max(10, Math.min(W() - 10, x)),
                y: Math.max(10, Math.min(H() - 10, y)),
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                r: Math.random() * 1.4 + 1.1,
                ci,
            });
        }

        const tick = () => {
            frame++;
            const w = W();
            const h = H();
            ctx.clearRect(0, 0, w, h);

            // ── 1. Compute pairwise repulsion forces ──
            // (Same O(n²) pass we'll reuse for edge drawing)
            const fx = new Float32Array(dots.length);
            const fy = new Float32Array(dots.length);

            for (let i = 0; i < dots.length; i++) {
                for (let j = i + 1; j < dots.length; j++) {
                    const a = dots[i];
                    const b = dots[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.hypot(dx, dy) || 0.01;

                    if (dist < MIN_SEP) {
                        // Repulsion: push apart proportionally to overlap
                        const strength = ((MIN_SEP - dist) / MIN_SEP) * 0.045;
                        const nx = dx / dist;
                        const ny = dy / dist;
                        fx[i] += nx * strength;
                        fy[i] += ny * strength;
                        fx[j] -= nx * strength;
                        fy[j] -= ny * strength;
                    }
                }
            }

            // ── 2. Update positions ──
            for (let i = 0; i < dots.length; i++) {
                const d = dots[i];

                // Apply repulsion
                d.vx += fx[i];
                d.vy += fy[i];

                // Soft zone boundary: nudge back if too far from own band
                const zoneCenter = ZONE_Y[d.ci] * h;
                const bandHalf = h * 0.23;
                if (d.y < zoneCenter - bandHalf) d.vy += 0.025;
                if (d.y > zoneCenter + bandHalf) d.vy -= 0.025;

                // Soft left/right boundary: nudge back from edges
                const margin = w * 0.04;
                if (d.x < margin)     d.vx += 0.03;
                if (d.x > w - margin) d.vx -= 0.03;

                // Random walk nudge every ~5 sec to prevent stagnation
                if (frame % 90 === (i % 90)) {
                    d.vx += (Math.random() - 0.5) * 0.12;
                    d.vy += (Math.random() - 0.5) * 0.12;
                }

                // Clamp speed
                [d.vx, d.vy] = clampSpeed(d.vx, d.vy, MIN_SPEED, MAX_SPEED);

                d.x += d.vx;
                d.y += d.vy;

                // Hard bounce off canvas walls
                if (d.x < 0)  { d.x = 0;  d.vx = Math.abs(d.vx); }
                if (d.x > w)  { d.x = w;  d.vx = -Math.abs(d.vx); }
                if (d.y < 0)  { d.y = 0;  d.vy = Math.abs(d.vy); }
                if (d.y > h)  { d.y = h;  d.vy = -Math.abs(d.vy); }
            }

            // ── 3. Draw edges + collect active pairs ──
            const activePairs: [number, number][] = [];

            for (let i = 0; i < dots.length; i++) {
                for (let j = i + 1; j < dots.length; j++) {
                    const a = dots[i];
                    const b = dots[j];
                    const dist = Math.hypot(a.x - b.x, a.y - b.y);
                    if (dist >= MAX_DIST) continue;

                    activePairs.push([i, j]);

                    const op = (1 - dist / MAX_DIST) * 0.22;
                    const [r1, g1, b1] = parseRgb(COLORS[a.ci]);
                    const [r2, g2, b2] = parseRgb(COLORS[b.ci]);
                    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
                    grad.addColorStop(0, `rgba(${r1},${g1},${b1},${op})`);
                    grad.addColorStop(1, `rgba(${r2},${g2},${b2},${op})`);
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = grad;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            }

            // ── 4. Spawn packet ──
            if (frame % PACKET_EVERY === 0 && activePairs.length > 0) {
                const [ai, bi] = activePairs[Math.floor(Math.random() * activePairs.length)];
                packets.push({ai, bi, t: 0, spd: 0.006 + Math.random() * 0.009});
            }

            // ── 5. Draw packets ──
            for (let k = packets.length - 1; k >= 0; k--) {
                const pk = packets[k];
                pk.t += pk.spd;
                if (pk.t >= 1) { packets.splice(k, 1); continue; }

                const a = dots[pk.ai];
                const b = dots[pk.bi];
                const px = a.x + (b.x - a.x) * pk.t;
                const py = a.y + (b.y - a.y) * pk.t;
                const [r, g, bl] = parseRgb(COLORS[a.ci]);

                const glow = ctx.createRadialGradient(px, py, 0, px, py, 7);
                glow.addColorStop(0, `rgba(${r},${g},${bl},0.65)`);
                glow.addColorStop(1, `rgba(${r},${g},${bl},0)`);
                ctx.beginPath();
                ctx.arc(px, py, 7, 0, Math.PI * 2);
                ctx.fillStyle = glow;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(px, py, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.95)';
                ctx.fill();
            }

            // ── 6. Draw dots ──
            for (const d of dots) {
                const [r, g, b] = parseRgb(COLORS[d.ci]);

                const halo = ctx.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 4.5);
                halo.addColorStop(0, `rgba(${r},${g},${b},0.3)`);
                halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r * 4.5, 0, Math.PI * 2);
                ctx.fillStyle = halo;
                ctx.fill();

                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(${r},${g},${b},0.88)`;
                ctx.fill();
            }

            rafId = requestAnimationFrame(tick);
        };

        tick();

        return () => {
            window.removeEventListener('resize', fit);
            cancelAnimationFrame(rafId);
        };
    }, []);

    return <canvas ref={canvasRef} className={styles.canvas}/>;
};
