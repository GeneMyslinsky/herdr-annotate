#!/usr/bin/env bun
import { notify, runHerdr } from "./herdr";

const opened = runHerdr([
  "plugin",
  "pane",
  "open",
  "--plugin",
  "annotate",
  "--entrypoint",
  "manager",
  "--placement",
  "popup",
  "--width",
  "100",
  "--height",
  "30",
  "--focus",
]);

if (!opened.ok) {
  notify("Unable to open annotations", opened.message);
  console.error(opened.message);
  process.exit(1);
}
