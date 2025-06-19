import { buildApplication, buildRouteMap } from "@stricli/core";
import { name, version, description } from "../package.json";
import { authRoutes } from "./commands/auth/commands";
import { runCommand } from "./commands/run/commands";

const routes = buildRouteMap({
  defaultCommand: "run",
  routes: {
    auth: authRoutes,
    run: runCommand
  },
  docs: {
    brief: description,
    hideRoute: {
    },
  },
});

export const app = buildApplication(routes, {
  name,
  versionInfo: {
    currentVersion: version,
  },
});
