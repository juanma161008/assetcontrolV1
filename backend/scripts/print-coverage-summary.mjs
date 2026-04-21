import fs from "node:fs";
import path from "node:path";

const summaryPath = path.join(process.cwd(), "coverage", "coverage-summary.json");

if (!fs.existsSync(summaryPath)) {
  console.error("No se encontro coverage/coverage-summary.json");
  process.exit(1);
}

const summary = JSON.parse(fs.readFileSync(summaryPath, "utf8"));
const total = summary.total;

const formatMetric = (metric) => `${metric.pct}% (${metric.covered}/${metric.total})`;

console.log("\n=== COVERAGE GLOBAL ===");
console.log(`Statements: ${formatMetric(total.statements)}`);
console.log(`Branches:   ${formatMetric(total.branches)}`);
console.log(`Functions:  ${formatMetric(total.functions)}`);
console.log(`Lines:      ${formatMetric(total.lines)}`);

const normalize = (filePath) => filePath.replaceAll("\\", "/");
const authControllerPath = Object.keys(summary).find((filePath) =>
  normalize(filePath).endsWith("src/interfaces/controllers/auth.controller.js")
);

if (authControllerPath) {
  const authMetrics = summary[authControllerPath];
  console.log(`auth.controller.js Branches: ${formatMetric(authMetrics.branches)}`);
}
