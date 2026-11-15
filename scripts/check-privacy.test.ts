import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { inspectFile, scanRepository } from './check-privacy';

const bytes = (value: string) => new TextEncoder().encode(value);
const directories: string[] = [];

function repository(): { root: string; git: (...args: string[]) => void } {
  const root = mkdtempSync(join(tmpdir(), 'atlas-privacy-'));
  directories.push(root);
  const git = (...args: string[]) => {
    execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  };
  git('init', '--quiet');
  return { root, git };
}

afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe('inspección de contenido', () => {
  it.each([
    'semanticSegments',
    'timelineObjects',
    'latitudeE7',
    'rawSignals',
    'timelinePath',
  ])('bloquea la clave %s anidada y con cualquier extensión', (key) => {
    expect(
      inspectFile(
        'public/sitios.txt',
        bytes(JSON.stringify({ nested: [{ [key]: [] }] })),
      ),
    ).toBeDefined();
  });

  it('decodifica claves JSON escapadas antes de inspeccionarlas', () => {
    expect(
      inspectFile('datos.bin', bytes('{"semantic\\u0053egments":[]}')),
    ).toBeDefined();
  });

  it('detecta una exportación serializada dentro de otra propiedad JSON', () => {
    const text = JSON.stringify({ backup: JSON.stringify({ rawSignals: [] }) });
    expect(inspectFile('copia.json', bytes(text))).toBeDefined();
  });

  it('detecta el formato iOS sin depender del nombre del fichero', () => {
    expect(
      inspectFile(
        'copia.json',
        bytes('[{"startTime":"2026","endTime":"2026","visit":{}}]'),
      ),
    ).toBeDefined();
  });

  it.each([
    ['respaldo.json', 'visit'],
    ['respaldo.txt', 'visit'],
    ['respaldo.json', 'activity'],
    ['respaldo.txt', 'activity'],
  ])('bloquea iOS incompleto en %s con %s', (path, field) => {
    const text = `[{"startTime":"2026","endTime":"2026","${field}":{`;
    expect(inspectFile(path, bytes(text))).toBeDefined();
  });

  it('bloquea iOS incompleto serializado dentro de otro JSON válido', () => {
    const text = JSON.stringify({
      backup: '[{"startTime":"2026","endTime":"2026","visit":{',
    });
    expect(inspectFile('respaldo.json', bytes(text))).toBeDefined();
  });

  it('rechaza JSON inválido aunque no se puedan reconocer sus claves', () => {
    expect(
      inspectFile('respaldo.json', bytes('{"desconocido":[')),
    ).toBeDefined();
    expect(inspectFile('respaldo.JSON', bytes(''))).toBeDefined();
  });

  it('permite un package.json válido con metadatos normales', () => {
    const text = JSON.stringify({
      name: 'atlas',
      version: '0.0.0',
      scripts: { test: 'vitest run' },
      description: 'Soporte para visit, activity, startTime y endTime',
    });
    expect(inspectFile('package.json', bytes(text))).toBeUndefined();
  });

  it('detecta JSON incompleto y una extensión de código usada para disfrazarlo', () => {
    expect(
      inspectFile('datos.json', bytes('{"timelineObjects":[')),
    ).toBeDefined();
    expect(inspectFile('datos.ts', bytes('{"rawSignals":['))).toBeDefined();
  });

  it('permite código, documentación y JSON saneado que solo mencionan formatos', () => {
    expect(
      inspectFile('parser.ts', bytes('export const keys = ["latitudeE7"];')),
    ).toBeUndefined();
    expect(
      inspectFile(
        'README.md',
        bytes('# Formato\nEjemplo: {"semanticSegments": []}'),
      ),
    ).toBeUndefined();
    expect(
      inspectFile(
        'public/data/atlas.json',
        bytes('{"schemaVersion":1,"cities":[]}'),
      ),
    ).toBeUndefined();
    expect(
      inspectFile('metadata.json', bytes('{"description":"semanticSegments"}')),
    ).toBeUndefined();
  });

  it('lee exportaciones UTF-16 con BOM', () => {
    const text = Buffer.from('{"rawSignals":[]}', 'utf16le');
    expect(
      inspectFile(
        'copia.txt',
        Buffer.concat([Buffer.from([0xff, 0xfe]), text]),
      ),
    ).toBeDefined();
  });

  it.each([
    'data/raw/mis-datos.json',
    'Timeline.json',
    'respaldo.Movil.Timeline.json',
    'location-history.json',
    'Records.json',
    'Takeout/copia.txt',
    'Semantic Location History/2022/enero.txt',
    'atlas.config.json',
    'data/archivo.zip',
  ])(
    'bloquea la ruta privada %s aunque el contenido parezca inocuo',
    (path) => {
      expect(inspectFile(path, bytes('{}'))).toBeDefined();
    },
  );

  it('bloquea archivos comprimidos disfrazados y no imprime el contenido privado', () => {
    expect(
      inspectFile('respaldo.dat', Buffer.from([0x50, 0x4b, 0x03, 0x04])),
    ).toBeDefined();
    const issue = inspectFile('copia.json', bytes('{"latitudeE7":123456789}'));
    expect(JSON.stringify(issue)).not.toContain('123456789');
  });
});

describe('Git e índice', () => {
  it('incluye ficheros nuevos no ignorados, con espacios o saltos de línea', () => {
    const { root } = repository();
    const path = 'copia con espacios\ny salto.json';
    writeFileSync(join(root, path), '{"rawSignals":[]}');
    expect(scanRepository(root).map((issue) => issue.path)).toEqual([path]);
  });

  it('respeta los ignorados, pero bloquea un dato privado añadido con fuerza', () => {
    const { root, git } = repository();
    writeFileSync(join(root, '.gitignore'), 'data/raw/\n');
    mkdirSync(join(root, 'data/raw'), { recursive: true });
    writeFileSync(join(root, 'data/raw/copia.json'), '{}');
    expect(scanRepository(root)).toEqual([]);
    git('add', '-f', 'data/raw/copia.json');
    expect(scanRepository(root, true).map((issue) => issue.path)).toEqual([
      'data/raw/copia.json',
    ]);
  });

  it('revisa el blob preparado aunque el working tree se haya saneado después', () => {
    const { root, git } = repository();
    const path = join(root, 'copia.json');
    writeFileSync(path, '{"semanticSegments":[]}');
    git('add', 'copia.json');
    writeFileSync(path, '{"cities":[]}');
    expect(scanRepository(root)).toEqual([]);
    expect(scanRepository(root, true)).toHaveLength(1);
  });

  it('permite preparar contenido saneado aunque la copia de trabajo sea privada', () => {
    const { root, git } = repository();
    const path = join(root, 'copia.json');
    writeFileSync(path, '{"cities":[]}');
    git('add', 'copia.json');
    writeFileSync(path, '{"timelineObjects":[]}');
    expect(scanRepository(root, true)).toEqual([]);
    expect(scanRepository(root)).toHaveLength(1);
  });

  it('ignora eliminaciones y también revisa blobs indexados sin cambios', () => {
    const { root, git } = repository();
    writeFileSync(join(root, 'copia.json'), '{"rawSignals":[]}');
    git('add', 'copia.json');
    rmSync(join(root, 'copia.json'));
    expect(scanRepository(root)).toEqual([]);
    expect(scanRepository(root, true)).toHaveLength(1);
    git('rm', '--cached', 'copia.json');
    expect(scanRepository(root, true)).toEqual([]);
  });

  it('bloquea enlaces sin leer su destino privado', () => {
    const { root, git } = repository();
    symlinkSync('/private/no-leer', join(root, 'enlace.json'));
    expect(scanRepository(root)).toHaveLength(1);
    git('add', 'enlace.json');
    expect(scanRepository(root, true)).toHaveLength(1);
  });
});
