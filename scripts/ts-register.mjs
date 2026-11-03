// Minimal TS loader for CLI scripts (no new packages): `@/` alias, extensionless imports,
// .ts transpiled with the project's own `typescript` devDependency.
import { createRequire, registerHooks } from 'node:module';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ts = createRequire(path.join(ROOT, 'package.json'))('typescript');

function tryFile(base) {
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

registerHooks({
  resolve(specifier, context, next) {
    let base = null;
    if (specifier.startsWith('@/')) base = path.join(ROOT, specifier.slice(2));
    else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      base = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
    }
    const file = base && tryFile(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
    return next(specifier, context);
  },
  load(url, context, next) {
    if (url.startsWith('file:') && /\.tsx?$/.test(url)) {
      const file = fileURLToPath(url);
      const out = ts.transpileModule(readFileSync(file, 'utf8'), {
        fileName: file,
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      return { format: 'module', source: out.outputText, shortCircuit: true };
    }
    return next(url, context);
  },
});
