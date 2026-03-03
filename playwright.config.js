const { defineConfig } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: "list",
  use: {
    headless: true,
    acceptDownloads: true,
    viewport: { width: 1688, height: 1000 },
  },
});
