module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      url: [
        'http://127.0.0.1:4173/?tab=route&from=vokzalna&to=maidan-nezalezhnosti',
        'http://127.0.0.1:4173/?tab=map&from=vokzalna&to=maidan-nezalezhnosti',
        'http://127.0.0.1:4173/?tab=tourist',
        'http://127.0.0.1:4173/?tab=stations&station=vokzalna',
      ],
      settings: {
        preset: 'desktop',
        onlyCategories: ['accessibility', 'best-practices', 'seo'],
        maxWaitForLoad: 45000,
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
