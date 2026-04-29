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
/* Calm, hypnotic SVG. 8 stations connected by a flow path. Build units
   stream left-to-right; one station occasionally pulses amber to suggest
   a bottleneck moment, and FlowState resolves the flow back to teal.    */

function FlowVisual({ className = "" }: { className?: string }) {
  // Stations along the line. Coordinates are within a 600x360 viewBox.
  const stations = [
    { x: 60, y: 180 },
    { x: 130, y: 180 },
    { x: 200, y: 180 },
    { x: 270, y: 180 },
    { x: 340, y: 180 }, // bottleneck index 4
    { x: 410, y: 180 },
    { x: 480, y: 180 },
    { x: 550, y: 180 },
  ];
  const bottleneckIndex = 4;

  // 7 build units; staggered animation delays to create a continuous stream.
  const builds = Array.from({ length: 7 }, (_, i) => i);

  return (
    <div
      className={`relative w-full ${className}`}
      data-testid="img-flow-visual"
      aria-label="Animated production line showing build units flowing through stations"
    >
      <svg
        viewBox="0 0 600 360"
        className="w-full h-auto block"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
      >
        <defs>
          {/* Brand gradient for the conveyor path */}
          <linearGradient id="flowConveyor" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#294D9C" stopOpacity="0.0" />
            <stop offset="15%" stopColor="#294D9C" stopOpacity="0.55" />
            <stop offset="50%" stopColor="#3A88B6" stopOpacity="0.7" />
            <stop offset="85%" stopColor="#4BE1E2" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#4BE1E2" stopOpacity="0.0" />
          </linearGradient>
          <linearGradient id="flowBuild" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#4BE1E2" />
            <stop offset="100%" stopColor="#3A88B6" />
          </linearGradient>
          <radialGradient id="flowGlow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0%" stopColor="#4BE1E2" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#4BE1E2" stopOpacity="0" />
          </radialGradient>
          <filter id="flowSoftBlur">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Soft background glow */}
        <ellipse cx="300" cy="180" rx="280" ry="90" fill="url(#flowGlow)" />

        {/* Subtle grid lines for the floor plane */}
        <g stroke="rgba(255,255,255,0.04)" strokeWidth="1">
          <line x1="0" y1="260" x2="600" y2="260" />
          <line x1="0" y1="290" x2="600" y2="290" />
          <line x1="0" y1="320" x2="600" y2="320" />
        </g>

        {/* Conveyor path — the flow line */}
        <line
          x1="30"
          y1="180"
          x2="580"
          y2="180"
          stroke="url(#flowConveyor)"
          strokeWidth="2"
        />
        <line
          x1="30"
          y1="180"
          x2="580"
          y2="180"
          stroke="rgba(75, 225, 226, 0.15)"
          strokeWidth="6"
          filter="url(#flowSoftBlur)"
        />

        {/* Stations */}
        {stations.map((s, i) => {
          const isBottleneck = i === bottleneckIndex;
          return (
            <g key={i}>
              {/* Station base — small rectangle below the line */}
              <rect
                x={s.x - 14}
                y={s.y + 10}
                width="28"
                height="38"
                rx="4"
                fill="rgba(255,255,255,0.03)"
                stroke="rgba(255,255,255,0.10)"
                strokeWidth="1"
              />
              <text
                x={s.x}
                y={s.y + 64}
                fill="rgba(255,255,255,0.30)"
                fontSize="8"
                fontFamily="ui-monospace, monospace"
                textAnchor="middle"
                letterSpacing="1"
              >
                {`L${(i + 1).toString().padStart(2, "0")}`}
              </text>
              {/* Station node — pulses if bottleneck */}
              <circle
                cx={s.x}
                cy={s.y}
                r={isBottleneck ? 6 : 4}
                fill={isBottleneck ? "#3A88B6" : "#4BE1E2"}
                opacity={isBottleneck ? 1 : 0.85}
                className={isBottleneck ? "flow-station-bottleneck" : "flow-station"}
                style={{ animationDelay: `${i * 0.35}s` }}
              />
              {/* Outer ring on bottleneck */}
              {isBottleneck && (
                <circle
                  cx={s.x}
                  cy={s.y}
                  r="6"
                  fill="none"
                  stroke="#3A88B6"
                  strokeWidth="1.5"
                  className="flow-bottleneck-ring"
                />
              )}
            </g>
          );
        })}

        {/* Build units flowing along the line */}
        {builds.map((i) => (
          <circle
            key={i}
            cx="30"
            cy="180"
            r="2.5"
            fill="url(#flowBuild)"
            className="flow-build"
            style={{ animationDelay: `${i * 1.4}s` }}
          />
        ))}

        {/* Subtle quiet labels above the line */}
        <text
          x="30"
          y="110"
          fill="rgba(255,255,255,0.30)"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          letterSpacing="2"
        >
          INPUT
        </text>
        <text
          x="570"
          y="110"
          fill="rgba(255,255,255,0.30)"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          textAnchor="end"
          letterSpacing="2"
        >
          OUTPUT
        </text>
        <text
          x="340"
          y="140"
          fill="rgba(75, 225, 226, 0.55)"
          fontSize="8"
          fontFamily="ui-monospace, monospace"
          textAnchor="middle"
          letterSpacing="1.5"
          className="flow-label-pulse"
        >
          CONSTRAINT
        </text>
      </svg>
    </div>
  );
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
