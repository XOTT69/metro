# Metro Kyiv public release checklist

Use this checklist after the Cloudflare Pages production deployment and before tagging `v1.0.0`.

## Automated gates

- [ ] TypeScript typecheck passes.
- [ ] All 52 stations and 5,304 route variants pass data validation.
- [ ] Production PWA build succeeds.
- [ ] Required files, manifest, service worker and bundle budgets pass.
- [ ] Lighthouse CI passes route, map, places and station deep-link screens.
- [ ] Accessibility score is at least 90 on every audited screen.
- [ ] Best Practices score is at least 85 and SEO score is at least 90.

## Production smoke test

- [ ] The Cloudflare Pages deployment is marked successful for `main`.
- [ ] The root URL opens without a console error or blank screen.
- [ ] Direct links with `?tab=map`, `?tab=tourist` and `?tab=stations&station=vokzalna` open the correct screen.
- [ ] A route can be built in both optimization modes.
- [ ] The selected route survives a refresh through URL parameters.
- [ ] The station catalog searches Ukrainian and English names.
- [ ] The service status panel loads official notices or clearly shows cached/unavailable status.
- [ ] The train board shows the current headway and two estimated arrivals in both directions.
- [ ] Train countdowns visibly state that they are estimates, not live tracking.
- [ ] Ukrainian and English switch without reloading and persist after restart.

## PWA and offline

- [ ] Android/Chromium installation prompt works.
- [ ] iPhone “Add to Home Screen” opens the standalone PWA.
- [ ] App icon, name, theme color and shortcuts display correctly.
- [ ] After one online visit, route planning, map, stations and places reopen offline.
- [ ] A new deployment produces the in-app update prompt and reloads cleanly.

## Accessibility and input

- [ ] The skip link becomes visible on keyboard focus and moves focus to main content.
- [ ] All interactive controls have a visible focus indicator.
- [ ] Bottom navigation works with Tab and Left/Right/Home/End keys.
- [ ] Every modal traps focus, closes with Escape and restores focus to its opener.
- [ ] Text remains usable at 200% browser zoom.
- [ ] Touch controls remain usable on a 320 px-wide screen.
- [ ] Reduced-motion system preference removes non-essential animation.
- [ ] Light and dark themes preserve readable contrast.

## Privacy and trust

- [ ] `/privacy.html` and `/sources.html` are publicly accessible.
- [ ] Geolocation is requested only after a user action.
- [ ] No third-party analytics or advertising requests appear in the network log.
- [ ] Official source links open correctly.
- [ ] The app is clearly described as an independent unofficial service.

## Release

- [ ] Critical production defects are fixed or documented.
- [ ] `package.json` is updated to `1.0.0`.
- [ ] Final PR is squash-merged to `main` after all checks pass.
- [ ] Git tag and GitHub release `v1.0.0` are created.
