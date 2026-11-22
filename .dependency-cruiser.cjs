/** Workspace packages resolve either to packages/<name>/ or through node_modules/@agentcontrol/<name>/. */
const pkg = (names) => `^(packages/|node_modules/@agentcontrol/)(${names.join("|")})(/|$)`;
const layer = (name, from, forbidden, comment) => ({
  name,
  comment,
  severity: "error",
  from: { path: `^packages/${from}/` },
  to: { path: pkg(forbidden) },
});

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    layer(
      "protocol-imports-nothing",
      "protocol",
      ["relay", "app", "sdk", "ui-template", "mac"],
      "protocol imports no other package",
    ),
    layer(
      "relay-no-upward-imports",
      "relay",
      ["app", "sdk", "ui-template"],
      "relay never imports app, sdk or ui-template",
    ),
    layer(
      "sdk-no-relay",
      "sdk",
      ["relay", "app", "ui-template", "mac"],
      "sdk reaches the app over HTTP, never by import",
    ),
    layer(
      "ui-template-only-sdk-and-protocol",
      "ui-template",
      ["relay", "app", "mac"],
      "ui-template may only import sdk and protocol",
    ),
    {
      name: "no-circular",
      comment: "no import cycles",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "feature-internals-from-feature",
      comment: "a feature folder is imported from outside only through its index.ts",
      severity: "error",
      from: { path: "^packages/([^/]+)/src/([^/]+)/" },
      to: {
        path: "^packages/$1/src/[^/]+/(?!index\\.tsx?$)",
        pathNot: "^packages/$1/src/$2/",
      },
    },
    {
      name: "feature-internals-from-elsewhere",
      comment: "a feature folder is imported from outside only through its index.ts",
      severity: "error",
      from: { path: "^(packages/[^/]+/src/[^/]+\\.tsx?$|e2e/|spike/|scripts/)" },
      to: { path: "^packages/[^/]+/src/[^/]+/(?!index\\.tsx?$)" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
    },
    exclude: { path: "(^|/)(node_modules|dist)/" },
  },
};
