import { Mic } from "lucide-react";

interface BlowMeterPanelProps {
  meter: number; // 0–1
  micStatus: string;
}

export function BlowMeterPanel({ meter, micStatus }: BlowMeterPanelProps) {
  const isBlowing = micStatus === "blowing";
  const isCompleted = micStatus === "completed";

  // Arc path: starts at bottom-left (140 deg), ends at bottom-right (40 deg)
  // Center is (120, 100), radius is 80.
  const arcPath = "M 58.7 151.4 A 80 80 0 1 1 181.3 151.4";

  return (
    <div className="blow-meter-panel">
      {/* Waveform rings */}
      <div className={`blow-ring-container ${isBlowing || isCompleted ? "active" : ""}`}>
        <div className="blow-ring ring-1" />
        <div className="blow-ring ring-2" />
        <div className="blow-ring ring-3" />
        {/* Waveform graphic matching mockup */}
        <svg className="waveform-ring" viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r="54" stroke="rgba(168, 85, 247, 0.4)" strokeWidth="2" fill="none" />
          <path 
            d="M 120 54 
               C 130 50, 135 60, 145 57 
               C 155 54, 160 65, 170 63 
               C 180 61, 185 75, 192 74 
               C 199 73, 202 88, 206 90 
               C 210 92, 208 108, 209 112 
               C 210 116, 204 130, 202 135 
               C 200 140, 190 152, 185 155 
               C 180 158, 168 168, 162 170 
               C 156 172, 142 178, 135 180 
               C 128 182, 115 182, 108 180 
               C 101 178, 88 172, 82 170 
               C 76 168, 64 158, 59 155 
               C 54 152, 44 140, 42 135 
               C 40 130, 34 116, 35 112 
               C 36 108, 34 92, 38 90 
               C 42 88, 45 73, 52 74 
               C 59 75, 64 61, 74 63 
               C 84 65, 89 54, 99 57 
               C 109 60, 110 50, 120 54 Z" 
            stroke="rgba(168, 85, 247, 0.5)" 
            strokeWidth="1.5" 
            fill="none" 
          />
        </svg>
      </div>

      {/* SVG Arc Meter */}
      <svg className="blow-arc-svg" width="240" height="200" viewBox="0 0 240 200" aria-hidden="true">
        <defs>
          <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>

        {/* Track */}
        <path
          d={arcPath}
          className="blow-track"
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
        />
        {/* Fill */}
        <path
          d={arcPath}
          className={`blow-arc ${isCompleted ? "success" : isBlowing ? "blowing" : "idle"}`}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - meter * 100}
          stroke="url(#arcGradient)"
        />
      </svg>

      <div className="meter-labels">
        <span className="meter-label-left">0%</span>
        <span className="meter-label-right">100%</span>
      </div>

      {/* Center Mic Icon */}
      <div className={`mic-icon-wrap ${isBlowing || isCompleted ? "pulsing" : ""}`}>
        <Mic className="mic-icon" size={36} strokeWidth={2.3} aria-hidden="true" />
      </div>

      {/* Horizontal Wind/Stardust Particles */}
      <div className={`wind-particles ${isBlowing ? "active" : ""}`}>
        {Array.from({ length: 16 }).map((_, i) => {
          // Generate pseudo-random positions for stardust
          const startY = 60 + (i * 23) % 160; 
          const delay = (i * 0.17) % 2;
          const duration = 0.8 + (i * 0.07) % 0.6;
          const style = {
            "--start-y": `${startY}px`,
            "--anim-delay": `${delay}s`,
            "--anim-dur": `${duration}s`,
            "--particle-size": `${2 + (i % 3)}px`
          } as React.CSSProperties;

          return <span key={i} className="wind-particle" style={style} />;
        })}
      </div>

      <div className="meter-status-text">
        {micStatus === "blowing" ? "Keep blowing..." : 
         micStatus === "completed" ? "Wish granted!" : 
         "Blow into the microphone"}
      </div>
    </div>
  );
}
