import { execFileSync } from 'node:child_process';
import { lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type PrivacyIssue = { path: string; reason: string };

const rawKeys = new Set([
  'semanticSegments',
  'timelineObjects',
  'latitudeE7',
  'rawSignals',
  'timelinePath',
]);
const rawProperty =
  /["'](?:semanticSegments|timelineObjects|latitudeE7|rawSignals|timelinePath)["']\s*:/;
const sourceOrDocumentation =
  /\.(?:[cm]?[jt]sx?|md|mdx|css|html|ya?ml|toml|svg)$/i;

function hasRawSignatures(text: string): boolean {
  return (
    rawProperty.test(text) ||
    (/["']startTime["']\s*:/.test(text) &&
      /["']endTime["']\s*:/.test(text) &&
      /["'](?:visit|activity)["']\s*:/.test(text))
  );
}

function forbiddenPath(path: string): boolean {
  const normalized = path.replaceAll('\\', '/').toLowerCase();
  const segments = normalized.split('/');
  return (
    /(^|\/)data\/raw(?:\/|$)/.test(normalized) ||
    segments.some((segment) =>
      ['takeout', 'semantic location history', 'atlas.config.json'].includes(
        segment,
      ),
    ) ||
    /(?:^|\/)(?:.*\.timeline|timeline|location-history|records)\.json$/.test(
      normalized,
    )
  );
}

function isArchive(path: string, bytes: Uint8Array): boolean {
  return (
    /\.(?:zip|gz|tgz|tar|bz2|xz|7z|rar)$/i.test(path) ||
    (bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      [3, 5, 7].includes(bytes[2] ?? -1)) ||
    (bytes[0] === 0x1f && bytes[1] === 0x8b)
  );
}

function containsRawKeys(value: unknown): boolean {
  const pending: unknown[] = [value];
  while (pending.length > 0) {
    const current = pending.pop();
    if (
      typeof current === 'string' &&
      (current.trimStart().startsWith('{') ||
        current.trimStart().startsWith('['))
    ) {
      try {
        pending.push(JSON.parse(current) as unknown);
      } catch {
        if (hasRawSignatures(current)) return true;
      }
      continue;
    }
    if (typeof current !== 'object' || current === null) continue;
    if (Array.isArray(current)) {
      for (const item of current) pending.push(item);
      continue;
    }
    const record = current as Record<string, unknown>;
    if (Object.keys(record).some((key) => rawKeys.has(key))) return true;
    // The iOS export has no required top-level key from rawKeys.
    if (
      'startTime' in record &&
      'endTime' in record &&
      ('visit' in record || 'activity' in record)
    ) {
      return true;
    }
    for (const item of Object.values(record)) pending.push(item);
  }
  return false;
}

function decodeText(bytes: Uint8Array): string {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(bytes);
  }
  return new TextDecoder().decode(bytes);
}

/** Inspects bytes without ever including their contents in a diagnostic. */
export function inspectFile(
  path: string,
  bytes: Uint8Array,
): PrivacyIssue | undefined {
  if (forbiddenPath(path))
    return { path, reason: 'Ruta reservada para datos locales privados.' };
  if (isArchive(path, bytes)) {
    return {
      path,
      reason:
        'Archivo comprimido no inspeccionable: mantenlo fuera del repositorio.',
    };
  }

  const text = decodeText(bytes).trimStart();
  try {
    const value: unknown = JSON.parse(text);
    if (containsRawKeys(value))
      return { path, reason: 'Se detectó un formato de ubicación crudo.' };
  } catch {
    if (/\.json$/i.test(path)) {
      return {
        path,
        reason:
          'Documento JSON no válido: no se puede verificar su privacidad.',
      };
    }
    // Code and documentation may discuss the formats. Data with another extension
    // is still checked, as is a JSON-shaped document disguised as source code.
    if (
      (!sourceOrDocumentation.test(path) ||
        text.startsWith('{') ||
        text.startsWith('[')) &&
      hasRawSignatures(text)
    ) {
      return {
        path,
        reason:
          'Se detectaron claves de ubicación cruda en un documento no válido.',
      };
    }
  }
  return undefined;
}

function git(cwd: string, args: string[]): Buffer {
  return execFileSync('git', args, {
    cwd,
    maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function entries(bytes: Buffer): string[] {
  return bytes.toString('utf8').split('\0').filter(Boolean);
}

/** The staged mode checks every indexed blob, not its potentially edited worktree copy. */
export function scanRepository(cwd: string, staged = false): PrivacyIssue[] {
  const root = git(cwd, ['rev-parse', '--show-toplevel'])
    .toString('utf8')
    .trim();
  const issues: PrivacyIssue[] = [];
  if (staged) {
    for (const entry of entries(git(root, ['ls-files', '--stage', '-z']))) {
      const separator = entry.indexOf('\t');
      const header = entry.slice(0, separator).split(' ');
      const path = entry.slice(separator + 1);
      const [mode, objectId, stage] = header;
      if (
        stage !== '0' ||
        !objectId ||
        !['100644', '100755'].includes(mode ?? '')
      ) {
        issues.push({
          path,
          reason: 'Enlace, submódulo o entrada sin resolver no inspeccionable.',
        });
        continue;
      }
      const issue = inspectFile(
        path,
        git(root, ['cat-file', 'blob', objectId]),
      );
      if (issue) issues.push(issue);
    }
    return issues;
  }

  const paths = new Set(
    entries(
      git(root, [
        'ls-files',
        '--cached',
        '--others',
        '--exclude-standard',
        '-z',
      ]),
    ),
  );
  for (const path of paths) {
    const absolutePath = resolve(root, path);
    let stats;
    try {
      stats = lstatSync(absolutePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue; // Deletion.
      throw new Error('No se pudo inspeccionar un fichero del repositorio.', {
        cause: error,
      });
    }
    if (!stats.isFile()) {
      issues.push({
        path,
        reason: 'Enlace, submódulo o fichero especial no inspeccionable.',
      });
      continue;
    }
    const issue = inspectFile(path, readFileSync(absolutePath));
    if (issue) issues.push(issue);
  }
  return issues;
}

function main(): void {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--staged')) {
    process.stderr.write('Uso: npm run check:privacy -- [--staged]\n');
    process.exitCode = 1;
    return;
  }
  try {
    const issues = scanRepository(process.cwd(), args.includes('--staged'));
    if (issues.length > 0) {
      process.stderr.write(
        'Privacidad: se bloqueó la publicación de estos ficheros:\n',
      );
      for (const issue of issues) {
        process.stderr.write(
          `- ${JSON.stringify(issue.path)}: ${issue.reason}\n`,
        );
      }
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      'Privacidad: no se detectaron exportaciones crudas ni rutas privadas.\n',
    );
  } catch {
    process.stderr.write(
      'Privacidad: no se pudo completar la inspección; operación bloqueada.\n',
    );
    process.exitCode = 1;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main();
