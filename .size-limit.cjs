module.exports = [
  {
    path: "packages/core/dist/index.global.js",
    limit: "12 kB",
    gzip: true,
  },
  {
    // Moves with the core limit above, and must: the UI adds ~6.7 kB, so a
    // combined cap of 15 kB would hold core to ~8.3 kB on any site that renders
    // a banner — making the core limit non-binding and this one the real gate.
    path: [
      "packages/core/dist/index.global.js",
      "packages/ui/dist/index.global.js",
    ],
    limit: "19 kB",
    gzip: true,
  },
  {
    path: "packages/bridge/dist/index.global.js",
    limit: "4 kB",
    gzip: true,
  },
  {
    path: "packages/core/dist/head-snippet.global.js",
    limit: "1.5 kB",
    gzip: true,
  },
];
