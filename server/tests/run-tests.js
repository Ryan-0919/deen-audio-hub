import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "node:test";
import { spec } from "node:test/reporters";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const files = ["request.test.js", "security.test.js", "device-limit.test.js"].map((fileName) => path.join(__dirname, fileName));

const stream = run({
  files,
  isolation: "none",
  concurrency: 1,
});

stream.compose(spec()).pipe(process.stdout);

let failed = 0;
stream.on("test:fail", () => {
  failed += 1;
});
stream.on("end", () => {
  process.exitCode = failed > 0 ? 1 : 0;
});
