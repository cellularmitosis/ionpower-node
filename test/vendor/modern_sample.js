// A vendored "modern" module that requires transpilation to run on
// SpiderMonkey 45. Exists to exercise the transpile-on-require fallback.
//
// Uses:
//   - optional chaining (?.)         ES2020
//   - nullish coalescing (??)        ES2020
//   - object spread                  ES2018
//   - exponent operator (**)         ES2016 (parses on SM45 anyway)
//   - arrow functions, template strings, const (all ES2015 — fine raw)

const base = { a: { b: { c: 'deep' } } };
const addin = { y: 2, z: 3 };

const deep = base?.a?.b?.c ?? 'fallback';
const spread = { ...addin, a: base.a };

const squared = [1, 2, 3].map(x => x ** 2);
const total = squared.reduce((a, b) => a + b, 0);

module.exports = {
  deep: () => deep,
  spread: () => spread,
  total: () => total,
  label: (opts) => `${opts?.prefix ?? '>'} ${opts?.name ?? 'anon'}`,
};
