# Birthday Wish Design Spec

## Goal

Build a polished Next.js birthday web app that opens into an immersive celebration scene. The experience should play birthday background music after the user's first interaction, request microphone access, show a correct cake with a candle, and let the user blow out the candle through a real blow gesture.

## Stack

- Next.js App Router with TypeScript.
- Tailwind CSS for layout, responsive styling, and animation primitives.
- Web Audio API for microphone input and blow detection.
- Lucide React for interface icons.
- React Confetti or a similarly lightweight client-side confetti package for celebration effects.
- Optional lightweight audio synthesis or local public audio assets for BGM and success sounds.

## Experience

The first screen shows an inviting birthday-room entry state with one clear action: enter the celebration. This is required because browsers do not allow background music playback or microphone access before user interaction.

After entry:

- The app requests microphone permission.
- Happy birthday background music starts if the browser allows playback.
- A responsive birthday scene appears with a stylized but recognizable frosted cake, plate, candle, wick, animated flame, and warm room lighting.
- The user sees a concise microphone status and a live "blow meter" that reacts to breath intensity.
- The candle remains lit until the blow detector accepts a sustained real-blow pattern.
- When accepted, the flame extinguishes, smoke rises, confetti fires, the scene brightens, and a birthday message appears.

## Blow Detection

The detector should be stricter than a simple loudness trigger. It will use the Web Audio API analyser node and evaluate:

- Ambient calibration during the first short listening window.
- RMS volume above the calibrated noise floor.
- Sustained airflow duration rather than a single spike.
- Low-to-mid frequency energy patterns typical of breath noise.
- Rejection of short claps, taps, speech-like spikes, and constant background noise.
- A cooldown so repeated spikes cannot rapidly retrigger the candle state.

The detector exposes a small, testable API that can be unit tested with synthetic audio frames before wiring into React.

## UI Direction

The visual system is playful, tactile, and mobile-first, with a warm birthday palette: icing pinks, candle amber, soft cream, berry red, and a contrasting blue accent for controls. The cake is the first-viewport focus. Controls stay minimal and functional, using icons where appropriate, visible focus states, and touch targets of at least 44px.

The design must avoid generic greeting-card layouts. The scene should feel like an interactive birthday ritual: candle flame movement, wax detail, frosting, confetti, soft shadows, and celebration state transitions.

## Accessibility And Fallbacks

- Provide a clear microphone permission error state.
- Provide a manual "blow candle" fallback only after permission is denied or unavailable.
- Respect `prefers-reduced-motion` by reducing flame, confetti, and smoke motion.
- Keep text readable at mobile widths and avoid layout overlap.
- Use semantic buttons and `aria-live` for permission and success state updates.
- Do not autoplay audio before the first user gesture.

## Test Plan

- Unit test the blow detection logic with fake frame streams:
  - rejects a single loud spike,
  - rejects quiet ambient noise,
  - rejects constant high noise without breath-like variance,
  - accepts sustained breath-like energy above calibrated baseline.
- Run lint and type checks.
- Verify the app manually in a browser at desktop and mobile viewport widths.
- Verify microphone denied and microphone unavailable states.

