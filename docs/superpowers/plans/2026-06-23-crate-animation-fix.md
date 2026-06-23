# Fix Crate Drop Animation

The user reported that the crate is appearing instantly instead of slowly falling from the top of the screen over 5 seconds.

## Root Cause Analysis

There are two primary reasons this can happen:

1. **CSS Shorthand Parsing Issue:** The CSS class `.gift-crate-drop-falling` uses a CSS variable `var(--crate-fall-duration)` inside the `animation` shorthand property:
   ```css
   animation: gift-crate-fall var(--crate-fall-duration) cubic-bezier(0.22, 0.78, 0.18, 1) forwards;
   ```
   Some browsers fail to parse the `animation` shorthand when a CSS variable is used for time values (duration or delay) because they cannot determine the variable's type at parse time. If the animation property is deemed invalid, the crate falls back to its base `.gift-crate-drop-overlay` styles, which statically positions it at its final landing target instantly.

2. **Prefers Reduced Motion:** If the user has "Reduce Motion" enabled in their operating system accessibility settings, the application is explicitly programmed to skip the falling animation. The `prefersReducedMotion()` check in `startCrateSequence` instantly sets the phase to `"cracked"`, and the CSS `@media (prefers-reduced-motion: reduce)` block forces all animations to `1ms`.

## Proposed Changes

### 1. Fix CSS Animation Shorthand (`src/app/globals.css`)
Convert the `animation` shorthand to explicit longhand properties in `.gift-crate-drop-falling` and `.gift-crate-drop-falling .gift-crate-shadow` to ensure cross-browser compatibility:
```css
.gift-crate-drop-falling {
  animation-name: gift-crate-fall;
  animation-duration: var(--crate-fall-duration);
  animation-timing-function: cubic-bezier(0.22, 0.78, 0.18, 1);
  animation-fill-mode: forwards;
}

.gift-crate-drop-falling .gift-crate-shadow {
  animation-name: gift-crate-shadow;
  animation-duration: var(--crate-fall-duration);
  animation-timing-function: ease-out;
  animation-fill-mode: forwards;
}
```

### 2. Bypass Reduced Motion for Crate (Optional based on user preference)
If you want the crate to *always* animate even if "Reduce Motion" is enabled on the device, we can remove the `prefersReducedMotion()` check in `src/components/birthday-wish-app.tsx` and exempt the `.gift-crate-drop` elements from the global `1ms` animation override in `src/app/globals.css`. 

## User Review Required
Please review the plan. Let me know if you also want me to disable the `prefers-reduced-motion` accessibility check so the animation ALWAYS plays regardless of OS settings, or if applying the CSS shorthand fix is sufficient!
