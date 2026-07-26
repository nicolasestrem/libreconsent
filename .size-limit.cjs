module.exports = [
  {
    path: "packages/core/dist/index.global.js",
    limit: "8 kB",
    gzip: true,
  },
  {
    path: [
      "packages/core/dist/index.global.js",
      "packages/ui/dist/index.global.js",
    ],
    limit: "15 kB",
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
