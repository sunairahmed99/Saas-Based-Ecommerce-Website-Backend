/** Silences console output in production only. */
const isProd = process.env.NODE_ENV === "production";

if (isProd) {
  const noop = () => {};

  const consoleMethods = [
    "log",
    "debug",
    "info",
    "warn",
    "error",
    "trace",
    "table",
    "group",
    "groupCollapsed",
    "groupEnd",
    "dir",
    "dirxml",
    "count",
    "countReset",
    "time",
    "timeEnd",
    "timeLog",
    "assert",
    "clear",
    "profile",
    "profileEnd",
  ];

  consoleMethods.forEach((method) => {
    try {
      console[method] = noop;
    } catch {
      /* ignore */
    }
  });
}

export function silenceConsole() {
  /* already applied on import in production */
}
