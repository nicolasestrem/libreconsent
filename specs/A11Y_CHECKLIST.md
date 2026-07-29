# A11Y — manual accessibility checklist

Required by **UI-3** (03 §6): axe-core runs in CI, and this checklist covers what
automated scanning cannot judge. Run it against `examples/basic-site`, and the
opt-out rows against `examples/us-only-site`, whenever `packages/ui` changes
materially, and record the date and result in the pull request description.

Automated coverage already enforced in CI (`pnpm a11y`, gate "Accessibility tests"):
zero critical/serious axe violations on the banner, the preferences modal (with a
cookie table disclosed), the opt-out dialog, and the persistent settings button,
in both light and dark themes.

## Keyboard

- [ ] The banner is reachable and fully operable with the keyboard alone; no
      control requires a pointer.
- [ ] Tab order inside each layer follows visual order.
- [ ] Accept all, Reject all and Customize all activate with both Enter and Space.
- [ ] Preferences: Tab from the last control wraps to the first, Shift+Tab from
      the first wraps to the last, and focus never escapes to the page behind.
- [ ] Escape closes preferences and returns focus to the control that opened it.
- [ ] Closing preferences without deciding restores the banner — the visitor is
      never left with no way to consent.
- [ ] Cookie disclosure buttons toggle with the keyboard and move focus nowhere
      unexpected.
- [ ] The "Do Not Sell or Share" link opens the opt-out dialog with Enter, and
      the dialog is fully operable from the keyboard (US-2).
- [ ] Escape closes the opt-out dialog and returns focus to the link that opened
      it; Tab wraps within the dialog as it does in preferences.

## Screen readers

Test with at least one of NVDA + Firefox, VoiceOver + Safari, or Narrator + Edge.

- [ ] The banner is announced as a dialog with its title and description.
- [ ] Preferences is announced as a modal dialog; content behind it is not
      reachable by the virtual cursor while it is open.
- [ ] Every checkbox announces its category or service name and its checked state.
- [ ] A partially selected category announces its mixed state.
- [ ] `necessary` is announced as "always on" and exposes no control.
- [ ] Cookie tables announce column headers when navigating cells.
- [ ] The disclosure button announces its expanded/collapsed state.
- [ ] The page language is announced correctly for the mounted locale.
- [ ] The opt-out dialog is announced as a modal dialog with its title and its
      explanation, and its state message is announced when the opt-out is
      already in force.

## Visual

- [ ] Every focused control shows a visible focus indicator against both themes.
- [ ] Accept all and Reject all are equally prominent: same size, weight, colour
      and grouping. Neither is visually demoted.
- [ ] Text contrast meets WCAG 2.1 AA (4.5:1 body, 3:1 large) in light and dark,
      including the default theme tokens and any documented theme override.
- [ ] Layout holds at 200% browser zoom and at a 320 px viewport width without
      horizontal scrolling or clipped controls.
- [ ] With `prefers-reduced-motion: reduce`, no transition or animation runs.
- [ ] Nothing is conveyed by colour alone.
- [ ] Under `forced-colors: active` every state that carries meaning stays
      distinguishable. Forced colours override `background` and `border-color`,
      so a distinction drawn with theme tokens alone collapses; system colours
      such as `Canvas` and `CanvasText` are honoured instead.
- [ ] In a right-to-left document the layout mirrors and remains usable.

## Integration

- [ ] The banner does not shift page content when it appears (NFR-2).
- [ ] Host page CSS cannot alter the relative prominence of Accept and Reject
      (verify with the shadow-DOM default and note any light-DOM caveat).
