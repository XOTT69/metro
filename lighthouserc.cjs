module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      isSinglePageApplication: true,
      numberOfRuns: 1,
      url: [
        'http://localhost/?tab=route&from=vokzalna&to=maidan-nezalezhnosti',
        'http://localhost/?tab=map&from=vokzalna&to=maidan-nezalezhnosti',
        'http://localhost/?tab=tourist',
        'http://localhost/?tab=stations&station=vokzalna',
      ],
      settings: {
        preset: 'desktop',
        onlyCategories: ['accessibility', 'best-practices', 'seo'],
        maxWaitForLoad: 45000,
        chromeFlags: '--headless=new --no-sandbox --disable-gpu',
      },
    },
    assert: {
      assertions: {
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.85 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'button-name': 'error',
        'color-contrast': 'error',
        'html-has-lang': 'error',
        'link-name': 'error',
        'meta-description': 'error',
        'viewport': 'error',
        'heading-order': 'warn',
      },
    },
    upload: {
      target: 'filesystem',
      outputDir: './lighthouse-reports',
    },
  },
}
