import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertDemoRequestSchema, type InsertDemoRequest } from "@shared/schema";

import LogoWhiteSvgUrl from "@assets/Logo-White-Text.svg";
import DashboardImg from "@assets/Dashboard1.jpg";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Activity,
  Eye,
  Zap,
  TrendingDown,
  Gauge,
  Boxes,
  Linkedin,
  Mail,
  CheckCircle2,
} from "lucide-react";

/* ----------------------------- Helpers ------------------------------ */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            setShown(true);
            obs.disconnect();
          }
        });
      },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, shown };
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

/* ---------------------- Browser-frame mockup ----------------------- */

function BrowserFrame({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={`relative rounded-xl overflow-hidden border border-white/10 bg-[#0a1322] shadow-2xl ${className}`}
      data-testid="img-dashboard-frame"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-[#0c1729]">
        <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <span className="w-3 h-3 rounded-full bg-[#28c840]" />
        <div className="flex-1 mx-4 px-3 py-1 rounded-md bg-[#0a1322] border border-white/5 text-[11px] text-white/40 font-mono truncate">
          app.flowstateanalytics.com / Plant_1 / Line_1
        </div>
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 fs-pulse" />
          Live
        </div>
      </div>
      <img
        src={src}
        alt={alt}
        className="w-full h-auto block"
        loading="lazy"
      />
    </div>
  );
}

/* ----------------- Animated production line visual ------------------ */
/* Discrete-event simulation. 7 stations (L01–L07) with uniform invisible
   slot grid: ~3 input + 4 between every station pair + ~3 output.
   Dots advance one slot per tick if the next slot is empty AND has been
   empty for at least RELEASE_DELAY ticks (the 0.1s pallet release delay,
   so dots cascade instead of moving as a solid block).
   Stations gate their dot by cycle time (healthy / slow / down).

   Event timeline (loops):
     t=0    -> STA 05 SLOW CYCLE  (yellow)        for ~10s
     t=10s  -> STA 07 DOWN        (red)           for ~8s
     t=18s  -> healthy gap                        for ~4s
     t=22s  -> repeat
   The CONSTRAINT label always renders red, sitting above the active station. */

type StationKind = "healthy" | "slow" | "down";
type Phase = "sta05_slow" | "sta07_down" | "gap";

// Slot kinds describe each position on the line.
type SlotKind =
  | { type: "input" }
  | { type: "buffer" }
  | { type: "station"; id: number; label: string }
  | { type: "output" };

// Build the slot grid programmatically: uniform 4-slot gap between stations,
// 3-slot input runway at the start, 3-slot output runway at the end.
function buildSlots(): SlotKind[] {
  const out: SlotKind[] = [];
  // Beginning invisible stops
  for (let i = 0; i < 3; i++) out.push({ type: "input" });
  // 7 stations with 4 buffers between each pair
  for (let s = 1; s <= 7; s++) {
    out.push({ type: "station", id: s, label: s.toString().padStart(2, "0") });
    if (s < 7) {
      for (let b = 0; b < 4; b++) out.push({ type: "buffer" });
    }
  }
  // End invisible stops
  for (let i = 0; i < 3; i++) out.push({ type: "output" });
  return out;
}

const SLOTS: SlotKind[] = buildSlots();

// Tick = 100ms. Cycle times are in ticks.
const TICK_MS = 100;
const HEALTHY_CYCLE = 12;     // 1.2s — stations release this often when healthy
const SLOW_CYCLE = 35;        // 3.5s — slow cycle
const INPUT_PERIOD = 12;      // spawn a new dot at slot 0 every 12 ticks
const RELEASE_DELAY = 1;      // 0.1s — a slot can't be re-occupied the same tick it was vacated
const PHASE_TICKS = {
  sta05_slow: 100,            // 10s
  sta07_down: 80,             // 8s
  gap: 40,                    // 4s
};

function FlowVisual({ className = "" }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(false);
  const [reduced, setReduced] = useState(false);

  // Tick counter and simulation state — kept in refs to avoid re-render storms.
  const tickRef = useRef(0);
  const phaseRef = useRef<Phase>("sta05_slow");
  const phaseStartRef = useRef(0);
  // Slots store dot IDs (number) or null if empty.
  const slotsRef = useRef<(number | null)[]>(Array(SLOTS.length).fill(null));
  // Per-station last-release tick — gates cycle time.
  const lastReleaseRef = useRef<Record<number, number>>({});
  // Per-slot tick when the slot was last vacated. Enforces the 0.1s pallet
  // release delay so dots cascade instead of all moving on the same tick.
  // Initialized to -RELEASE_DELAY so empty slots are immediately available.
  const lastVacatedRef = useRef<number[]>(
    Array(SLOTS.length).fill(-RELEASE_DELAY)
  );
  const lastSpawnRef = useRef(-INPUT_PERIOD);
  const nextIdRef = useRef(1);

  // Render-state mirrors of the simulation state. We update these every tick
  // so React can paint the new positions.
  const [slots, setSlots] = useState<(number | null)[]>(() => Array(SLOTS.length).fill(null));
  const [phase, setPhase] = useState<Phase>("sta05_slow");

  // Detect reduced motion preference once.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Pause when offscreen — saves battery and avoids drift.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => setRunning(e.isIntersecting));
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Simulation tick loop.
  useEffect(() => {
    if (!running || reduced) return;
    let intervalId: number | null = null;

    const step = () => {
      const t = tickRef.current;

      // 1. Phase transitions
      const phaseElapsed = t - phaseStartRef.current;
      const currentPhase = phaseRef.current;
      if (
        (currentPhase === "sta05_slow" && phaseElapsed >= PHASE_TICKS.sta05_slow) ||
        (currentPhase === "sta07_down" && phaseElapsed >= PHASE_TICKS.sta07_down) ||
        (currentPhase === "gap" && phaseElapsed >= PHASE_TICKS.gap)
      ) {
        const next: Phase =
          currentPhase === "sta05_slow"
            ? "sta07_down"
            : currentPhase === "sta07_down"
            ? "gap"
            : "sta05_slow";
        phaseRef.current = next;
        phaseStartRef.current = t;
        setPhase(next);
      }

      // 2. Move dots — iterate from output side back to input so we don't double-move.
      //    A dot at slot i can move to i+1 only if i+1 is empty AND has been
      //    empty for at least RELEASE_DELAY ticks (cascade behavior).
      const sl = slotsRef.current.slice();
      const vac = lastVacatedRef.current;
      for (let i = sl.length - 1; i >= 0; i--) {
        const dot = sl[i];
        if (dot === null) continue;
        const slotKind = SLOTS[i];

        // Output — dots disappear once they reach the final slot and tick once.
        if (slotKind.type === "output" && i === sl.length - 1) {
          sl[i] = null;
          vac[i] = t;
          continue;
        }

        const nextIdx = i + 1;
        if (nextIdx >= sl.length) continue;
        if (sl[nextIdx] !== null) continue; // blocked
        // Pallet release delay: even if next slot is empty, wait until at
        // least RELEASE_DELAY ticks after it was vacated. This is what makes
        // a queue cascade forward instead of jumping in lockstep.
        if (t - vac[nextIdx] < RELEASE_DELAY) continue;

        // If this slot is a station, it gates by cycle time.
        if (slotKind.type === "station") {
          const stationKind = stationStateAt(slotKind.id, phaseRef.current);
          if (stationKind === "down") continue; // never release
          const cycle = stationKind === "slow" ? SLOW_CYCLE : HEALTHY_CYCLE;
          const last = lastReleaseRef.current[slotKind.id] ?? -cycle;
          if (t - last < cycle) continue;
          lastReleaseRef.current[slotKind.id] = t;
        }

        // Move
        sl[nextIdx] = dot;
        sl[i] = null;
        vac[i] = t;
      }

      // 3. Spawn new dots at slot 0 if it's empty (and respects release delay)
      //    and enough ticks have passed since the last spawn.
      if (
        sl[0] === null &&
        t - vac[0] >= RELEASE_DELAY &&
        t - lastSpawnRef.current >= INPUT_PERIOD
      ) {
        sl[0] = nextIdRef.current++;
        lastSpawnRef.current = t;
      }

      slotsRef.current = sl;
      lastVacatedRef.current = vac;
      setSlots(sl);
      tickRef.current = t + 1;
    };

    intervalId = window.setInterval(step, TICK_MS);
    return () => {
      if (intervalId !== null) window.clearInterval(intervalId);
    };
  }, [running, reduced]);

  // Layout geometry — viewBox sized to fit 34 slots cleanly.
  const SLOT_PITCH = 24;
  const X0 = 30;
  const Y_LINE = 170;
  const VB_W = X0 * 2 + SLOTS.length * SLOT_PITCH; // 30 + 34*24 + 30 = 876
  const VB_H = 320;
  const SLOT_CELL_H = 18; // height of the slot-cell box around the conveyor
  const slotX = (i: number) => X0 + i * SLOT_PITCH + SLOT_PITCH / 2;

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      data-testid="img-flow-visual"
      aria-label="Animated production line simulation showing dots flowing through stations with a constraint event"
    >
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="w-full h-auto block"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <defs>
          <linearGradient id="flowConveyor" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#294D9C" stopOpacity="0.0" />
            <stop offset="12%" stopColor="#294D9C" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#3A88B6" stopOpacity="0.65" />
            <stop offset="88%" stopColor="#4BE1E2" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4BE1E2" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="flowBuild" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4BE1E2" />
            <stop offset="100%" stopColor="#3A88B6" />
          </linearGradient>
          <radialGradient id="flowGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#4BE1E2" stopOpacity="0.30" />
            <stop offset="100%" stopColor="#4BE1E2" stopOpacity="0" />
          </radialGradient>
          <filter id="flowSoftBlur">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Soft background glow */}
        <ellipse cx={VB_W / 2} cy={Y_LINE} rx={VB_W * 0.45} ry="80" fill="url(#flowGlow)" />

        {/* Slot grid — a row of subtle outlined cells along the conveyor.
            Makes the discrete "invisible stops" between stations visible. */}
        <g>
          {/* Outer continuous frame around the whole slot row */}
          <rect
            x={X0}
            y={Y_LINE - SLOT_CELL_H / 2}
            width={SLOTS.length * SLOT_PITCH}
            height={SLOT_CELL_H}
            fill="rgba(255,255,255,0.02)"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth="1"
          />
          {/* Vertical separators between every slot */}
          {Array.from({ length: SLOTS.length - 1 }, (_, i) => i + 1).map((i) => (
            <line
              key={`grid-${i}`}
              x1={X0 + i * SLOT_PITCH}
              y1={Y_LINE - SLOT_CELL_H / 2}
              x2={X0 + i * SLOT_PITCH}
              y2={Y_LINE + SLOT_CELL_H / 2}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth="1"
            />
          ))}
        </g>

        {/* Conveyor path glow underneath the grid */}
        <line
          x1={X0}
          y1={Y_LINE}
          x2={X0 + SLOTS.length * SLOT_PITCH}
          y2={Y_LINE}
          stroke="rgba(75, 225, 226, 0.10)"
          strokeWidth="6"
          filter="url(#flowSoftBlur)"
        />

        {/* Stations — the station's slot in the grid is highlighted, and a
            machine "box" hangs below the conveyor. Label below the box. */}
        {SLOTS.map((slot, i) => {
          if (slot.type !== "station") return null;
          const cx = slotX(i);
          const kind = stationStateAt(slot.id, phase);
          const boxW = 38;
          const boxH = 50;
          const boxX = cx - boxW / 2;
          // Box hangs below the conveyor with a small gap.
          const boxY = Y_LINE + SLOT_CELL_H / 2 + 8;

          // Base healthy treatment
          let stroke = "rgba(255,255,255,0.20)";
          let fill = "rgba(255,255,255,0.03)";
          let cellStroke: string | null = null;
          let cellFill: string | null = null;
          let textInside: string | null = null;
          let textColor = "#fff";
          let strokeWidth = 1;
          let twoLine = false;
          if (kind === "slow") {
            stroke = "#F5C518";
            fill = "rgba(245, 197, 24, 0.18)";
            cellStroke = "#F5C518";
            cellFill = "rgba(245, 197, 24, 0.18)";
            textInside = "SLOW CYCLE";
            textColor = "#F5C518";
            strokeWidth = 2;
            twoLine = true;
          } else if (kind === "down") {
            stroke = "#E54B4B";
            fill = "rgba(229, 75, 75, 0.22)";
            cellStroke = "#E54B4B";
            cellFill = "rgba(229, 75, 75, 0.22)";
            textInside = "DOWN";
            textColor = "#E54B4B";
            strokeWidth = 2;
          }

          return (
            <g key={`sta-${slot.id}`}>
              {/* When constrained, recolor the conveyor slot-cell itself */}
              {cellStroke && cellFill && (
                <rect
                  x={cx - SLOT_PITCH / 2}
                  y={Y_LINE - SLOT_CELL_H / 2}
                  width={SLOT_PITCH}
                  height={SLOT_CELL_H}
                  fill={cellFill}
                  stroke={cellStroke}
                  strokeWidth="1.5"
                />
              )}
              {/* CONSTRAINT label — only on the active constrained station,
                  positioned above the conveyor cell */}
              {kind !== "healthy" && (
                <text
                  x={cx}
                  y={Y_LINE - SLOT_CELL_H / 2 - 8}
                  fill="#E54B4B"
                  fontSize="8"
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                  letterSpacing="1.4"
                  fontWeight="700"
                >
                  CONSTRAINT
                </text>
              )}
              {/* Machine box below conveyor */}
              <rect
                x={boxX}
                y={boxY}
                width={boxW}
                height={boxH}
                rx="4"
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {/* Inside text — single label per box (DOWN or SLOW CYCLE) */}
              {textInside && !twoLine && (
                <text
                  x={cx}
                  y={boxY + boxH / 2 + 3}
                  fill={textColor}
                  fontSize="8"
                  fontFamily="ui-monospace, monospace"
                  textAnchor="middle"
                  letterSpacing="1"
                  fontWeight="700"
                >
                  {textInside}
                </text>
              )}
              {textInside && twoLine && (
                <>
                  <text
                    x={cx}
                    y={boxY + boxH / 2 - 2}
                    fill={textColor}
                    fontSize="7.5"
                    fontFamily="ui-monospace, monospace"
                    textAnchor="middle"
                    letterSpacing="0.5"
                    fontWeight="700"
                  >
                    SLOW
                  </text>
                  <text
                    x={cx}
                    y={boxY + boxH / 2 + 8}
                    fill={textColor}
                    fontSize="7.5"
                    fontFamily="ui-monospace, monospace"
                    textAnchor="middle"
                    letterSpacing="0.5"
                    fontWeight="700"
                  >
                    CYCLE
                  </text>
                </>
              )}
              {/* Station label below box: just "L05" — matches reference image */}
              <text
                x={cx}
                y={boxY + boxH + 14}
                fill="rgba(255,255,255,0.55)"
                fontSize="9"
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
                letterSpacing="1.5"
                fontWeight="500"
              >
                L{slot.label}
              </text>
            </g>
          );
        })}

        {/* Dots — one per occupied slot. */}
        {slots.map((dot, i) => {
          if (dot === null) return null;
          const slotKind = SLOTS[i];
          // Don't render dots inside station boxes that are DOWN — visually they sit
          // inside the box but the colored fill makes them hard to see; show a slightly
          // dimmed version.
          let opacity = 0.95;
          if (slotKind.type === "station") {
            const k = stationStateAt(slotKind.id, phase);
            if (k === "down") opacity = 0.5;
            if (k === "slow") opacity = 0.85;
          }
          return (
            <g
              key={`dot-${dot}`}
              transform={`translate(${slotX(i)} ${Y_LINE})`}
              style={{ transition: `transform ${TICK_MS}ms linear, opacity 200ms ease` }}
              opacity={opacity}
            >
              <circle cx="0" cy="0" r="3.5" fill="url(#flowBuild)" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Returns the visual state of a station given the current phase.
function stationStateAt(stationId: number, phase: Phase): StationKind {
  if (phase === "sta05_slow" && stationId === 5) return "slow";
  if (phase === "sta07_down" && stationId === 7) return "down";
  return "healthy";
}

/* -------------------------- Nav bar --------------------------------- */

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { id: "product", label: "Product" },
    { id: "why", label: "Why FlowState" },
    { id: "story", label: "Story" },
  ];

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-md bg-[hsl(220_38%_8%/0.75)] border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center"
          aria-label="FlowState Analytics — home"
          data-testid="link-home"
        >
          <img
            src={LogoWhiteSvgUrl}
            alt="FlowState Analytics"
            className="h-9 w-auto"
          />
        </button>

        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <button
              key={l.id}
              onClick={() => scrollToId(l.id)}
              className="text-sm text-white/70 hover:text-white transition-colors"
              data-testid={`link-${l.id}`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            onClick={() => scrollToId("demo")}
            size="sm"
            className="bg-white text-[hsl(220_38%_8%)] hover:bg-white/90 font-semibold rounded-full px-5"
            data-testid="button-nav-demo"
          >
            Request a demo
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}

/* -------------------------- Hero ------------------------------------ */

function Hero() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section className="relative pt-32 lg:pt-40 pb-20 overflow-hidden">
      {/* atmospheric background */}
      <div className="absolute inset-0 fs-radial-glow pointer-events-none" />
      <div className="absolute inset-0 fs-grid-bg pointer-events-none opacity-50" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1200px] h-[600px] bg-[radial-gradient(ellipse_at_center,rgba(75,225,226,0.12),transparent_70%)] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8" ref={ref}>
        <div className={`text-center max-w-4xl mx-auto ${shown ? "fs-fade-up" : "opacity-0"}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/70 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 fs-pulse" />
            Built for discrete manufacturing
          </div>

          <h1 className="text-[2.5rem] leading-[1.1] sm:text-5xl sm:leading-[1.05] lg:text-7xl lg:leading-[1.02] font-semibold tracking-tight text-white">
            See where your line is{" "}
            <span className="fs-gradient-text">losing builds.</span>
            {" "}
            <span className="text-white/60 block sm:inline">Then act on it.</span>
          </h1>

          <p className="mt-6 text-lg lg:text-xl text-white/65 max-w-2xl mx-auto leading-relaxed">
            FlowState reveals inter-station bottlenecks, lost builds, and
            throughput gaps in real time — without the dashboards you'll never open.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              onClick={() => scrollToId("demo")}
              size="lg"
              className="bg-white text-[hsl(220_38%_8%)] hover:bg-white/90 font-semibold rounded-full h-12 px-7 text-base"
              data-testid="button-hero-demo"
            >
              Request a demo
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>
            <Button
              onClick={() => scrollToId("product")}
              variant="ghost"
              size="lg"
              className="text-white hover:text-white hover:bg-white/5 rounded-full h-12 px-6 text-base"
              data-testid="button-hero-product"
            >
              See the product
            </Button>
          </div>
        </div>

        {/* Hero dashboard */}
        <div
          className={`mt-16 lg:mt-20 max-w-6xl mx-auto ${
            shown ? "fs-fade-up" : "opacity-0"
          }`}
          style={{ animationDelay: "200ms" }}
        >
          <div className="relative">
            <div className="absolute -inset-4 fs-gradient-bg opacity-20 blur-2xl rounded-3xl pointer-events-none" />
            <BrowserFrame
              src={DashboardImg}
              alt="FlowState dashboard showing line flow diagram, real-time throughput report, jobs per hour trend, and lost builds by operation"
              className="relative fs-float"
            />
          </div>

          {/* trust strip — 2x2 on mobile, single row on desktop */}
          <div className="mt-10 lg:mt-14 text-xs uppercase tracking-[0.18em] text-white/40">
            {/* Mobile: 2x2 grid */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 max-w-[18rem] mx-auto sm:hidden">
              <span className="text-center">Real-time</span>
              <span className="text-center">SCADA-ready</span>
              <span className="text-center">Days to deploy</span>
              <span className="text-center">No bloat</span>
            </div>
            {/* Tablet+ : inline row with dot separators */}
            <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
              <span>Real-time</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>SCADA-ready</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>Days to deploy</span>
              <span className="w-1 h-1 rounded-full bg-white/20" />
              <span>No bloat</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ Problem section --------------------------- */

function Problem() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section
      id="why"
      className="relative py-24 lg:py-32 border-t border-white/5"
      ref={ref}
    >
      <div className="max-w-6xl mx-auto px-6 lg:px-8">
        <div
          className={`grid lg:grid-cols-12 gap-10 lg:gap-16 items-start ${
            shown ? "fs-fade-up" : "opacity-0"
          }`}
        >
          <div className="lg:col-span-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[hsl(192_53%_60%)] font-semibold mb-4">
              The problem
            </p>
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
              Most plants already have the data.
              <br />
              <span className="text-white/50">
                What they don't have is clarity.
              </span>
            </h2>
          </div>

          <div className="lg:col-span-7 space-y-6 text-[17px] leading-relaxed text-white/70">
            <p>
              You can pull cycle times, downtime codes, and OEE from your SCADA
              today. But by the time it lands in a 40-tab spreadsheet or a
              dashboard nobody opens, the shift is over and the bottleneck moved.
            </p>
            <p>
              The hard question — <span className="text-white">which stations are
              actually starving the line right now?</span> — gets buried in noise.
              Engineers chase ghosts. Operators get blamed for variation they
              didn't cause. Continuous improvement stalls.
            </p>
            <p className="text-white/85">
              FlowState was built to answer one question, well: where is your
              flow being held back, and what's it costing you?
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ Features ---------------------------------- */

function Features() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const items = [
    {
      icon: Activity,
      title: "Real-time line flow",
      copy: "Watch every station's state live — starved, blocked, or running. Catch the bottleneck while it's happening, not at the end-of-shift report.",
    },
    {
      icon: TrendingDown,
      title: "Lost builds, attributed",
      copy: "See exactly which operations cost you throughput and how much. Bottleneck vs. non-bottleneck stations are separated, so you fix what actually moves jobs-per-hour.",
    },
    {
      icon: Gauge,
      title: "Throughput trend that matters",
      copy: "Jobs per hour at the paypoint, by line and by shift. The number leadership cares about, surfaced where it can drive action.",
    },
    {
      icon: Boxes,
      title: "Inter-station impact",
      copy: "When STP145 hiccups, what does it actually do to L02? FlowState quantifies the ripple, so improvement projects target the constraint — not the symptom.",
    },
    {
      icon: Zap,
      title: "Days to deploy",
      copy: "Connect to existing SCADA / historian. No rip-and-replace, no 9-month consulting engagement. Insights in days, value in weeks.",
    },
    {
      icon: Eye,
      title: "Built to be opened",
      copy: "Operators, engineers, and leadership each see what they need — at a glance. No more dashboards that exist only to satisfy an audit.",
    },
  ];

  return (
    <section
      id="product"
      className="relative py-24 lg:py-32 border-t border-white/5"
      ref={ref}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div
          className={`max-w-2xl ${shown ? "fs-fade-up" : "opacity-0"}`}
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[hsl(192_53%_60%)] font-semibold mb-4">
            What it does
          </p>
          <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
            One question, answered six ways.
          </h2>
          <p className="mt-5 text-lg text-white/65 leading-relaxed">
            Each module is purpose-built for the people who'll use it on the floor — not for an analytics demo reel.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {items.map((it, i) => {
            const Icon = it.icon;
            return (
              <div
                key={it.title}
                className={`group bg-[hsl(220_38%_8%)] hover:bg-[hsl(217_35%_11%)] transition-colors p-7 lg:p-9 ${
                  shown ? "fs-fade-up" : "opacity-0"
                }`}
                style={{ animationDelay: `${i * 80}ms` }}
                data-testid={`card-feature-${i}`}
              >
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#294D9C]/20 to-[#4BE1E2]/20 border border-white/10 flex items-center justify-center mb-5 group-hover:from-[#294D9C]/40 group-hover:to-[#4BE1E2]/40 transition-colors">
                  <Icon className="h-5 w-5 text-[hsl(192_53%_70%)]" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2 tracking-tight">
                  {it.title}
                </h3>
                <p className="text-[15px] text-white/60 leading-relaxed">
                  {it.copy}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ------------------------ Credibility / built by -------------------- */

function BuiltBy() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section
      className="relative py-24 lg:py-32 border-t border-white/5 overflow-hidden"
      ref={ref}
    >
      <div className="absolute inset-0 fs-radial-glow opacity-60 pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <div className={`min-w-0 ${shown ? "fs-fade-up" : "opacity-0"}`}>
            <p className="text-xs uppercase tracking-[0.2em] text-[hsl(192_53%_60%)] font-semibold mb-4">
              Why us
            </p>
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
              Built by engineers
              <br />
              <span className="text-white/50">who lived this problem.</span>
            </h2>
            <div className="mt-6 space-y-5 text-[17px] leading-relaxed text-white/70">
              <p>
                FlowState was born on a real factory floor — not a Silicon Valley
                whiteboard. Our team ran OEE at scale inside a Tier-1 OEM,
                chased phantom downtime through SCADA exports, and built the
                workaround spreadsheets every CI engineer knows.
              </p>
              <p>
                We started FlowState because the gap between "the data exists"
                and "the team can act on it" wasn't getting closed by another
                $400k analytics platform. It needed a different tool, designed
                for the floor.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-md">
              {[
                { v: "10+", l: "Years on the plant floor" },
                { v: "Days", l: "From kickoff to insight" },
                { v: "0", l: "Rip-and-replace required" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-3xl font-semibold fs-gradient-text">
                    {s.v}
                  </div>
                  <div className="text-xs uppercase tracking-wider text-white/45 mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`relative min-w-0 ${shown ? "fs-fade-up" : "opacity-0"}`}
            style={{ animationDelay: "180ms" }}
          >
            <div className="relative">
              <div className="absolute -inset-8 bg-gradient-to-br from-[#294D9C]/20 to-[#4BE1E2]/20 blur-3xl rounded-3xl pointer-events-none" />
              <div className="relative rounded-2xl border border-white/10 bg-[#0a1322]/60 p-6 lg:p-8 backdrop-blur-sm">
                <FlowVisual />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ Story / About ----------------------------- */

function Story() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  const pillars = [
    {
      title: "Our story",
      copy: "Born on the factory floor. Built by engineers who knew the pain of chasing production issues without the right data — and decided to fix it.",
    },
    {
      title: "Our vision",
      copy: "A future where continuous improvement isn't buried in spreadsheets. It's visible, accessible, and actionable for every operator, engineer, and leader on the floor.",
    },
    {
      title: "Our purpose",
      copy: "Most analytics tools try to be everything for everyone — and overcomplicate the very problems they're meant to solve. FlowState does one thing exceptionally well.",
    },
  ];

  return (
    <section
      id="story"
      className="relative py-24 lg:py-32 border-t border-white/5"
      ref={ref}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className={`max-w-2xl mb-16 ${shown ? "fs-fade-up" : "opacity-0"}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-[hsl(192_53%_60%)] font-semibold mb-4">
            The company
          </p>
          <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
            About FlowState.
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
          {pillars.map((p, i) => (
            <div
              key={p.title}
              className={`bg-[hsl(220_38%_8%)] p-8 lg:p-10 ${
                shown ? "fs-fade-up" : "opacity-0"
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <h3 className="text-xl font-semibold text-white mb-3 tracking-tight">
                {p.title}
              </h3>
              <p className="text-[15px] text-white/65 leading-relaxed">
                {p.copy}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------ Demo form --------------------------------- */

function DemoSection() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<InsertDemoRequest>({
    resolver: zodResolver(insertDemoRequestSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      jobTitle: "",
      message: "",
    },
  });

  const mut = useMutation({
    mutationFn: async (values: InsertDemoRequest) => {
      const res = await apiRequest("POST", "/api/demo-requests", values);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      form.reset();
      toast({
        title: "Demo request received",
        description: "We'll be in touch within one business day.",
      });
    },
    onError: () => {
      toast({
        title: "Something went wrong",
        description: "Please try again, or email marcus@flowstateanalytics.com.",
        variant: "destructive",
      });
    },
  });

  function onSubmit(values: InsertDemoRequest) {
    mut.mutate(values);
  }

  return (
    <section
      id="demo"
      className="relative py-24 lg:py-32 border-t border-white/5 overflow-hidden"
    >
      <div className="absolute inset-0 fs-radial-glow opacity-50 pointer-events-none" />
      <div className="relative max-w-5xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-start">
          <div className="lg:col-span-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[hsl(192_53%_60%)] font-semibold mb-4">
              Get in touch
            </p>
            <h2 className="text-3xl lg:text-5xl font-semibold tracking-tight text-white leading-tight">
              See it on your line.
            </h2>
            <p className="mt-5 text-lg text-white/65 leading-relaxed">
              30 minutes. We'll walk through how FlowState would surface your line's biggest constraint — using your actual line data if you have it.
            </p>
            <ul className="mt-8 space-y-3">
              {[
                "No procurement gauntlet to schedule",
                "Engineering-led — not a sales pitch",
                "We'll send a recap with action items",
              ].map((b) => (
                <li
                  key={b}
                  className="flex items-start gap-3 text-[15px] text-white/75"
                >
                  <CheckCircle2 className="h-4 w-4 mt-1 flex-shrink-0 text-[hsl(192_53%_60%)]" />
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <div className="relative rounded-2xl border border-white/10 bg-[hsl(217_35%_11%)] p-6 lg:p-8 shadow-2xl">
              {submitted ? (
                <div className="py-12 text-center" data-testid="demo-success">
                  <div className="w-14 h-14 mx-auto rounded-full bg-[hsl(192_53%_50%/0.15)] border border-[hsl(192_53%_50%/0.3)] flex items-center justify-center mb-4">
                    <CheckCircle2 className="h-7 w-7 text-[hsl(192_53%_60%)]" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Got it. We'll be in touch.
                  </h3>
                  <p className="text-white/65 text-[15px]">
                    Expect a note from the team within one business day.
                  </p>
                  <Button
                    onClick={() => setSubmitted(false)}
                    variant="ghost"
                    className="mt-6 text-white/60 hover:text-white"
                    data-testid="button-submit-another"
                  >
                    Submit another
                  </Button>
                </div>
              ) : (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit)}
                    className="space-y-5"
                    data-testid="form-demo"
                  >
                    <div className="grid sm:grid-cols-2 gap-5">
                      <FormField
                        control={form.control}
                        name="firstName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80 text-sm">
                              First name
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Marcus"
                                className="bg-[hsl(220_38%_8%)] border-white/10 h-11 text-white placeholder:text-white/30"
                                data-testid="input-firstName"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80 text-sm">
                              Last name
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Carter"
                                className="bg-[hsl(220_38%_8%)] border-white/10 h-11 text-white placeholder:text-white/30"
                                data-testid="input-lastName"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80 text-sm">
                            Work email
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="email"
                              placeholder="marcus@yourcompany.com"
                              className="bg-[hsl(220_38%_8%)] border-white/10 h-11 text-white placeholder:text-white/30"
                              data-testid="input-email"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid sm:grid-cols-2 gap-5">
                      <FormField
                        control={form.control}
                        name="company"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80 text-sm">
                              Company
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Acme Manufacturing"
                                className="bg-[hsl(220_38%_8%)] border-white/10 h-11 text-white placeholder:text-white/30"
                                data-testid="input-company"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="jobTitle"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-white/80 text-sm">
                              Job title
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Plant Manager"
                                className="bg-[hsl(220_38%_8%)] border-white/10 h-11 text-white placeholder:text-white/30"
                                data-testid="input-jobTitle"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80 text-sm">
                            Phone <span className="text-white/40 font-normal">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              type="tel"
                              placeholder="+1 (555) 123-4567"
                              className="bg-[hsl(220_38%_8%)] border-white/10 h-11 text-white placeholder:text-white/30"
                              data-testid="input-phone"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="message"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-white/80 text-sm">
                            Tell us about your line <span className="text-white/40 font-normal">(optional)</span>
                          </FormLabel>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={3}
                              placeholder="Industry, line type, biggest pain point..."
                              className="bg-[hsl(220_38%_8%)] border-white/10 text-white placeholder:text-white/30 resize-none"
                              data-testid="input-message"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="submit"
                      disabled={mut.isPending}
                      size="lg"
                      className="w-full bg-white text-[hsl(220_38%_8%)] hover:bg-white/90 font-semibold rounded-full h-12 text-base"
                      data-testid="button-submit-demo"
                    >
                      {mut.isPending ? "Sending..." : "Request a demo"}
                      {!mut.isPending && <ArrowRight className="ml-2 h-4 w-4" />}
                    </Button>

                    <p className="text-xs text-white/40 text-center pt-1">
                      We'll only use this to contact you about FlowState. No spam, ever.
                    </p>
                  </form>
                </Form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------ Footer ------------------------------------ */

function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-12 lg:py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-12 gap-10">
          <div className="md:col-span-6">
            <img src={LogoWhiteSvgUrl} alt="FlowState Analytics" className="h-12 w-auto mb-5" />
            <p className="text-sm text-white/50 max-w-sm leading-relaxed">
              Production flow analytics, purpose-built for discrete manufacturing.
              Made in Indiana.
            </p>
          </div>

          <div className="md:col-span-3">
            <h4 className="text-xs uppercase tracking-[0.18em] text-white/40 mb-4 font-semibold">
              Company
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => scrollToId("product")} className="text-white/70 hover:text-white" data-testid="footer-link-product">
                  Product
                </button>
              </li>
              <li>
                <button onClick={() => scrollToId("story")} className="text-white/70 hover:text-white" data-testid="footer-link-story">
                  Our story
                </button>
              </li>
              <li>
                <button onClick={() => scrollToId("demo")} className="text-white/70 hover:text-white" data-testid="footer-link-demo">
                  Request a demo
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-3">
            <h4 className="text-xs uppercase tracking-[0.18em] text-white/40 mb-4 font-semibold">
              Connect
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a
                  href="mailto:marcus@flowstateanalytics.com"
                  className="inline-flex items-center gap-2 text-white/70 hover:text-white"
                  data-testid="footer-link-email"
                >
                  <Mail className="h-3.5 w-3.5" />
                  marcus@flowstateanalytics.com
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/flowstate-analytics"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-white/70 hover:text-white"
                  data-testid="footer-link-linkedin"
                >
                  <Linkedin className="h-3.5 w-3.5" />
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-white/40">
          <p>© {new Date().getFullYear()} FlowState Analytics LLC. All rights reserved.</p>
          <p>Noblesville, Indiana · Boilermaker-built</p>
        </div>
      </div>
    </footer>
  );
}

/* ------------------------ Page -------------------------------------- */

export default function Home() {
  // Smooth, native scroll behaviour
  useEffect(() => {
    document.title = "FlowState Analytics — Production flow, made visible";
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(220_38%_8%)] text-white selection:bg-[hsl(192_53%_50%/0.3)]">
      <Nav />
      <Hero />
      <Problem />
      <Features />
      <BuiltBy />
      <Story />
      <DemoSection />
      <Footer />
    </div>
  );
}
