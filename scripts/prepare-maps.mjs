import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { setGlobalProxyFromEnv } from 'node:http';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';
import { format } from 'prettier';

// Honor the managed environment's proxy without exposing or replacing it.
setGlobalProxyFromEnv();

// Pinned public datasets only. This script never reads local travel history.
const outputDirectory = fileURLToPath(
  new URL('../public/maps/', import.meta.url),
);
const countriesSource = {
  url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson/ne_50m_admin_0_countries.geojson',
  sha256: '3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb',
};
const earthSource = {
  url: 'https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003615/earth_noClouds.0330.jpg',
  sha256: '1ed70af0494a92b69a40e12feffd7b47ad4c92b3d70ad0987fee77212b51635c',
};
const tolerance = 0.02;

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function download(source) {
  const response = await globalThis.fetch(source.url, {
    signal: globalThis.AbortSignal.timeout(60_000),
  });
  if (!response.ok)
    throw new Error(`No se pudo descargar el mapa: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (digest(bytes) !== source.sha256) {
    throw new Error(
      'La suma SHA-256 de la fuente ha cambiado; revisa su procedencia antes de actualizar.',
    );
  }
  return bytes;
}

function squaredSegmentDistance(point, start, end) {
  let x = start[0];
  let y = start[1];
  const dx = end[0] - x;
  const dy = end[1] - y;
  if (dx !== 0 || dy !== 0) {
    const fraction =
      ((point[0] - x) * dx + (point[1] - y) * dy) / (dx * dx + dy * dy);
    if (fraction > 1) {
      [x, y] = end;
    } else if (fraction > 0) {
      x += dx * fraction;
      y += dy * fraction;
    }
  }
  return (point[0] - x) ** 2 + (point[1] - y) ** 2;
}

// Iterative Douglas–Peucker: preserve arc endpoints without recursive stack limits.
function simplifyArc(points) {
  const keep = new Set([0, points.length - 1]);
  const pending = [[0, points.length - 1]];
  while (pending.length > 0) {
    const [first, last] = pending.pop();
    let maximum = tolerance ** 2;
    let selected = -1;
    for (let index = first + 1; index < last; index += 1) {
      const distance = squaredSegmentDistance(
        points[index],
        points[first],
        points[last],
      );
      if (distance > maximum) {
        maximum = distance;
        selected = index;
      }
    }
    if (selected !== -1) {
      keep.add(selected);
      pending.push([first, selected], [selected, last]);
    }
  }
  return points.filter((_, index) => keep.has(index));
}

function simplifyRing(ring) {
  // Split a closed ring into two open arcs so the duplicate endpoint does not
  // collapse its baseline. Retain tiny islands instead of dropping their rings.
  let split = 1;
  let farthest = 0;
  for (let index = 1; index < ring.length - 1; index += 1) {
    const distance =
      (ring[index][0] - ring[0][0]) ** 2 + (ring[index][1] - ring[0][1]) ** 2;
    if (distance > farthest) {
      farthest = distance;
      split = index;
    }
  }
  const simplified = [
    ...simplifyArc(ring.slice(0, split + 1)).slice(0, -1),
    ...simplifyArc(ring.slice(split)),
  ];
  const retained = simplified.length >= 4 ? simplified : ring;
  const rounded = retained
    .map(([longitude, latitude]) => [
      Number(longitude.toFixed(4)),
      Number(latitude.toFixed(4)),
    ])
    .filter(
      (point, index, points) =>
        index === 0 ||
        point.some((value, axis) => value !== points[index - 1][axis]),
    );
  return rounded.length >= 4 ? rounded : retained;
}

function displayCountries(source) {
  if (source.type !== 'FeatureCollection' || source.features.length !== 242) {
    throw new Error(
      'La colección Natural Earth no coincide con la versión fijada.',
    );
  }
  return {
    type: 'FeatureCollection',
    features: source.features.map((feature) => {
      const p = feature.properties;
      const coordinates =
        feature.geometry.type === 'Polygon'
          ? feature.geometry.coordinates.map(simplifyRing)
          : feature.geometry.coordinates.map((polygon) =>
              polygon.map(simplifyRing),
            );
      return {
        type: 'Feature',
        id: p.ADM0_A3,
        properties: {
          name: p.NAME_ES || p.NAME,
          nameEn: p.NAME,
          iso2: p.ISO_A2_EH === '-99' ? null : p.ISO_A2_EH,
          iso3: p.ISO_A3_EH === '-99' ? null : p.ISO_A3_EH,
          continent: p.CONTINENT,
        },
        geometry: { type: feature.geometry.type, coordinates },
      };
    }),
  };
}

const [countriesBytes, earthBytes] = await Promise.all([
  download(countriesSource),
  download(earthSource),
]);
const countries = displayCountries(JSON.parse(countriesBytes.toString('utf8')));
const countriesOutput = Buffer.from(`${JSON.stringify(countries)}\n`);
const metadata = {
  reviewedAt: '2026-11-15',
  generatedBy: 'node scripts/prepare-maps.mjs',
  countries: {
    file: 'countries.geojson',
    source: countriesSource,
    dataset: 'Natural Earth Admin 0 – Countries, 1:50m, v5.1.2',
    sourcePage:
      'https://www.naturalearthdata.com/downloads/50m-cultural-vectors/50m-admin-0-countries-2/',
    license: 'Public domain',
    licenseUrl: 'https://www.naturalearthdata.com/about/terms-of-use/',
    credit: 'Natural Earth',
    featureCount: countries.features.length,
    precisionDecimals: 4,
    simplificationToleranceDegrees: tolerance,
    displayOnly: true,
    sha256: digest(countriesOutput),
  },
  earth: {
    file: 'earth.jpg',
    source: earthSource,
    dataset: 'Blue Marble Next Generation, 2004, without clouds',
    sourcePage: 'https://svs.gsfc.nasa.gov/3615/',
    license:
      'Public domain, NASA SVS policy; no specific restriction on this asset',
    licenseUrl: 'https://svs.gsfc.nasa.gov/help/',
    credit:
      'NASA/Goddard Scientific Visualization Studio; Reto Stockli (NASA/GSFC), Blue Marble Next Generation / Earth Observatory',
    width: 2048,
    height: 1024,
    bytes: earthBytes.byteLength,
    sha256: digest(earthBytes),
  },
};
const metadataOutput = await format(JSON.stringify(metadata), {
  parser: 'json',
});

await mkdir(outputDirectory, { recursive: true });
await Promise.all([
  writeFile(`${outputDirectory}/countries.geojson`, countriesOutput),
  writeFile(`${outputDirectory}/earth.jpg`, earthBytes),
  writeFile(`${outputDirectory}/sources.json`, metadataOutput),
]);
process.stdout.write(
  `Natural Earth: ${countries.features.length} entidades, ${countriesOutput.byteLength} bytes, SHA-256 ${digest(countriesOutput)}\n`,
);
process.stdout.write(
  `NASA: 2048 × 1024, ${earthBytes.byteLength} bytes, SHA-256 ${digest(earthBytes)}\n`,
);
