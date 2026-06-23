"use client";

import { useCallback, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";

import type { GiftCratePhase } from "@/lib/gift-crate-sequence";

export type GiftCrateLandingTarget = {
  x: number;
  y: number;
};

type GiftCrateDropProps = {
  phase: GiftCratePhase;
  placement: "overlay" | "landed";
  landingTarget?: GiftCrateLandingTarget | null;
  fallDurationMs?: number;
};

const CRACK_FRAMES = [
  "/gift-crate/frame-02-small-cracks.png",
  "/gift-crate/frame-03-deep-cracks.png",
  "/gift-crate/frame-04-lid-splitting.png",
  "/gift-crate/frame-05-breaking-apart.png",
  "/gift-crate/frame-06-broken-pieces.png",
];

const SCRAPBOOK_CARDS = [
  { img: "/love/IMG-20260218-WA0056.jpg",      text: "You make every moment special.",  type: "img"   as const },
  { img: "/love/IMG-20260227-WA0412.jpg",      text: "Every moment with you is magic.", type: "img"   as const },
  { img: "/love/IMG-20260227-WA0503.jpg",      text: "To my favorite person.",           type: "img"   as const },
  { img: "/love/IMG_8556-1.jpg",               text: "You are my sunshine.",             type: "img"   as const },
  { img: "/love/IMG_8570.jpg",                 text: "Forever and always.",              type: "img"   as const },
  { img: "/love/Snapchat-1154266423.jpg",      text: "I love you unconditionally.",      type: "img"   as const },
  { video: "/love/VID-20260119-WA0000.mp4",    text: "Our beautiful journey.",           type: "video" as const },
];

const MAX_TAPS = 10;

// Scale used by the focus animation — smaller on narrow screens to stay on-screen
function getFocusTransform() {
  const scale = typeof window !== "undefined" && window.innerWidth < 600 ? 1.6 : 2;
  return `translate(-50%, -50%) scale(${scale}) rotate(0deg)`;
}

function getCrackFrame(taps: number) {
  if (taps < 1)  return CRACK_FRAMES[0];
  if (taps < 3)  return CRACK_FRAMES[1];
  if (taps < 6)  return CRACK_FRAMES[2];
  if (taps < 10) return CRACK_FRAMES[3];
  return CRACK_FRAMES[4];
}

/** Freeze a card element in-place so CSS `card-pop-N` can never restart on it. */
function freezeCard(el: HTMLElement, transform: string) {
  el.style.cssText = `animation: none; transform: ${transform}; opacity: 1;`;
}

export function GiftCrateDrop({ phase, placement, landingTarget, fallDurationMs }: GiftCrateDropProps) {
  const [tapCount, setTapCount]     = useState(0);
  const [tapAnimKey, setTapAnimKey] = useState(0);

  const scrapbookRef     = useRef<HTMLDivElement>(null);
  /** Per-card final transform captured after their CSS pop animation ends. */
  const frozenTransforms = useRef<Record<number, string>>({});
  /** Index of the currently focused card, or null. */
  const focusedIdx       = useRef<number | null>(null);
  /** The running Web Animation on the focused card (so we can cancel it). */
  const focusAnim        = useRef<Animation | null>(null);

  // ─── Pop animation end ───────────────────────────────────────────────────────
  // Once a card finishes its CSS pop-in, we freeze it via inline style so the
  // `card-pop-N` CSS rule can never restart the animation again (e.g. on re-render
  // or class toggling).
  const handleCardAnimationEnd = useCallback(
    (e: React.AnimationEvent<HTMLDivElement>, idx: number) => {
      if (!e.animationName.startsWith("card-pop")) return;
      const el        = e.currentTarget;
      const transform = window.getComputedStyle(el).transform;
      frozenTransforms.current[idx] = transform;
      freezeCard(el, transform);
    },
    []
  );

  // ─── Clear focus ─────────────────────────────────────────────────────────────
  const clearFocus = useCallback((withAnimation = true) => {
    const container = scrapbookRef.current;
    if (!container) return;

    const prevIdx = focusedIdx.current;
    focusedIdx.current = null;

    // Cancel any in-flight focus animation
    focusAnim.current?.cancel();
    focusAnim.current = null;

    if (prevIdx !== null) {
      const cards  = Array.from(container.querySelectorAll<HTMLElement>(".scrapbook-card"));
      const card   = cards[prevIdx];
      if (card) {
        card.classList.remove("focused");
        // Pause video if present
        card.querySelector<HTMLVideoElement>("video")?.pause();

        const frozen  = frozenTransforms.current[prevIdx];
        if (frozen) {
          if (withAnimation) {
            // Read the card's current visual position (where card-focus left it)
            const from = window.getComputedStyle(card).transform;

            // Momentarily lock to the current visual position (no jump)
            card.style.cssText = `animation: none; transform: ${from}; opacity: 1; transition: none;`;

            // Animate back to its scattered pop position
            const anim = card.animate(
              [
                { transform: from,   opacity: "1" },
                { transform: frozen, opacity: "1" },
              ],
              {
                duration: 400,
                easing:   "cubic-bezier(0.175, 0.885, 0.32, 1.1)",
                fill:     "forwards",
              }
            );
            anim.onfinish = () => freezeCard(card, frozen);
          } else {
            freezeCard(card, frozen);
          }
        }
      }
    }

    container.classList.remove("has-focus");
    container.querySelector(".scrapbook-backdrop")?.remove();
  }, []);

  // ─── Card click ──────────────────────────────────────────────────────────────
  const handleCardClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, idx: number) => {
      e.stopPropagation();
      const container = scrapbookRef.current;
      if (!container) return;

      // Toggle off if already focused
      if (focusedIdx.current === idx) {
        clearFocus(true);
        return;
      }

      // Clear any previously focused card
      clearFocus(false);

      // Mark new focused card
      const cards = Array.from(container.querySelectorAll<HTMLElement>(".scrapbook-card"));
      const card  = cards[idx];
      if (!card) return;

      focusedIdx.current = idx;
      card.classList.add("focused");
      container.classList.add("has-focus");

      // Animate from frozen pop position → center, using Web Animations API.
      // This is fully independent of CSS and will never conflict with card-pop-N.
      const from = frozenTransforms.current[idx] ?? window.getComputedStyle(card).transform;
      const to   = getFocusTransform();

      const anim = card.animate(
        [
          { transform: from, opacity: "1" },
          { transform: to,   opacity: "1" },
        ],
        {
          duration: 500,
          easing:   "cubic-bezier(0.175, 0.885, 0.32, 1.1)",
          fill:     "forwards",
        }
      );
      focusAnim.current = anim;

      // Backdrop — inserted before cards in DOM so z-index works correctly
      const backdrop = document.createElement("div");
      backdrop.className = "scrapbook-backdrop";
      backdrop.addEventListener("click", (be) => {
        be.stopPropagation();
        clearFocus(true);
      });
      container.insertBefore(backdrop, container.firstChild);
    },
    [clearFocus]
  );

  // ─── Crate tap ───────────────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (placement !== "landed") return;
    if (tapCount >= MAX_TAPS) return;

    setTapCount((prev) => prev + 1);
    setTapAnimKey((prev) => prev + 1);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([40]);
    }

    try {
      const audio = new Audio("/sounds/crate-impact.wav");
      audio.volume = 0.4;
      void audio.play().catch(() => {});
    } catch (_) {
      // ignore
    }
  }, [placement, tapCount]);

  // ─── Render ──────────────────────────────────────────────────────────────────
  if (phase === "idle") return null;

  const isInteractive = placement === "landed" && tapCount < MAX_TAPS;
  const isCrackedOpen = tapCount >= MAX_TAPS;

  const containerStyle = {
    "--crate-fall-duration": fallDurationMs ? `${fallDurationMs}ms` : undefined,
    "--crate-landing-x":     landingTarget  ? `${landingTarget.x}px` : undefined,
    "--crate-landing-y":     landingTarget  ? `${landingTarget.y}px` : undefined,
    cursor:        isInteractive ? "pointer"       : undefined,
    touchAction:   isInteractive ? "manipulation"  : undefined,
    pointerEvents: isInteractive ? "auto"          : undefined,
  } as CSSProperties;

  const crateClass    = ["gift-crate-drop", `gift-crate-drop-${placement}`, `gift-crate-drop-${phase}`].join(" ");
  const imageSource   = phase === "falling" ? "/gift-crate/frame-01-intact.png" : getCrackFrame(tapCount);
  const imageClass    = `gift-crate-image ${tapAnimKey > 0 ? "gift-crate-tap-anim" : ""}`;

  return (
    <div className={crateClass} style={containerStyle} aria-hidden="true" onPointerDown={handleTap}>
      <div className={`gift-crate-glow-expand ${isCrackedOpen ? "active" : ""}`} />
      <div className="gift-crate-shadow" />
      <div className="gift-crate-impact-ring" />
      <div className="gift-crate-dust">
        <span /><span /><span /><span />
      </div>

      <Image
        key={`crate-img-${tapAnimKey}`}
        className={imageClass}
        src={imageSource}
        alt="Gift Crate"
        width={724}
        height={724}
        priority
      />

      {isCrackedOpen && (
        /**
         * scrapbookRef is only ever mounted once (isCrackedOpen is one-way true→true),
         * so card-pop-N CSS animations play exactly once. After each pop animation ends,
         * handleCardAnimationEnd freezes the card via inline style, permanently
         * preventing any future CSS animation restart.
         */
        <div ref={scrapbookRef} className="scrapbook-cards-container active">
          {SCRAPBOOK_CARDS.map((card, idx) => (
            <div
              key={idx}
              className={`scrapbook-card ${card.type === "video" ? "video-card" : ""}`}
              onClick={(e) => handleCardClick(e, idx)}
              onAnimationEnd={(e) => handleCardAnimationEnd(e, idx)}
            >
              {card.type === "video" ? (
                // No autoPlay removed — video autoplays freely; we only pause on unfocus
                <video src={card.video} autoPlay loop muted playsInline />
              ) : (
                <Image src={card.img} alt="Memory" width={200} height={160} />
              )}
              <p>{card.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
