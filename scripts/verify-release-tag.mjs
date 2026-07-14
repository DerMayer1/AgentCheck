import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const tag = process.argv[2];
if (tag !== `v${packageJson.version}`) {
  throw new Error(`Release tag ${tag ?? "<missing>"} does not match package version v${packageJson.version}.`);
}
console.log(`Release tag ${tag} matches package version ${packageJson.version}.`);
