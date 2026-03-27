import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  testMatch: ["**/*.test.ts"],
  moduleFileExtensions: ["ts", "js", "json"],
  collectCoverageFrom: ["src/**/*.ts", "!src/types/**"],
  coverageDirectory: "coverage",
  // p-queue is ESM-only, needs transformation
  transformIgnorePatterns: ["/node_modules/(?!(p-queue|p-timeout|eventemitter3)/)"],
  transform: {
    "^.+\\.tsx?$": "ts-jest",
    "^.+\\.js$": [
      "ts-jest",
      { tsconfig: { allowJs: true } },
    ],
  },
  // Set required env vars for tests
  setupFiles: ["<rootDir>/tests/setup.ts"],
};

export default config;
