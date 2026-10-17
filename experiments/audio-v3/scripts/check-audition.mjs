import { measurePcm } from "../src/audition.mjs";

const report = measurePcm();
for (const item of report.checks) {
  console.log(`${item.pass ? "PASS" : "FAIL"}  ${item.name}: ${item.detail}`);
}
if (!report.pass) {
  console.error("Deterministic audition checks failed.");
  process.exit(1);
}
console.log("Deterministic PCM checks passed. This is not an Android result.");
