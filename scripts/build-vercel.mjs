// Produces a Vercel Build Output API v3 bundle in .vercel/output:
//   static/            -> compiled Vite client (dist/public)
//   functions/api.func -> Express backend bundled as a single Node.js function
// See https://vercel.com/docs/build-output-api/v3
import { build } from "esbuild";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const clientDir = path.join(root, "dist", "public");
const outputDir = path.join(root, ".vercel", "output");
const staticDir = path.join(outputDir, "static");
const functionDir = path.join(outputDir, "functions", "api.func");

if (!fs.existsSync(path.join(clientDir, "index.html"))) {
  throw new Error(`Missing ${clientDir}/index.html. Run "vite build" first.`);
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(functionDir, { recursive: true });
fs.cpSync(clientDir, staticDir, { recursive: true });

await build({
  entryPoints: [path.join(root, "server", "_core", "vercel.ts")],
  outfile: path.join(functionDir, "index.mjs"),
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  legalComments: "none",
  tsconfig: path.join(root, "tsconfig.json"),
  // CommonJS dependencies (express, etc.) call require() for Node built-ins.
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
  },
  logLevel: "warning",
});

fs.writeFileSync(
  path.join(functionDir, ".vc-config.json"),
  JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      shouldAddHelpers: false,
      supportsResponseStreaming: true,
      maxDuration: 60,
    },
    null,
    2
  )
);
fs.writeFileSync(path.join(functionDir, "package.json"), JSON.stringify({ type: "module" }));

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=63072000",
  "X-Frame-Options": "SAMEORIGIN",
};

const config = {
  version: 3,
  routes: [
    { src: "^/(.*)$", headers: securityHeaders, continue: true },
    {
      src: "^/assets/(.*)$",
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
      continue: true,
    },
    { handle: "filesystem" },
    { src: "^/api(?:/.*)?$", dest: "/api" },
    { src: "^/manus-storage/.*$", dest: "/api" },
    { src: "^/assets/.*$", status: 404 },
    { src: "^/.*$", dest: "/index.html" },
  ],
};
fs.writeFileSync(path.join(outputDir, "config.json"), JSON.stringify(config, null, 2));

console.log("Vercel build output written to .vercel/output");
