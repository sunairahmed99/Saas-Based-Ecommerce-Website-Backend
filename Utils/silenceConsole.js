/** Silences all console output when this module is imported. */
const noop = () => {};

console.log = noop;
console.error = noop;
console.debug = noop;
console.warn = noop;
console.info = noop;
console.trace = noop;
console.table = noop;
console.group = noop;
console.groupCollapsed = noop;
console.groupEnd = noop;

export function silenceConsole() {
  /* already applied on import */
}
