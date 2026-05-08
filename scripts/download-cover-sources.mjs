import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'data', 'raw', 'source');
const refDir = path.join(root, 'data', 'raw', 'ref');

const downloads = [
  {
    label: 'Latest quarterly GP supplementary COVER data, October to December 2025',
    url: 'https://assets.publishing.service.gov.uk/media/69c26c66d588c92c483e4c43/supplementary-vaccine-coverage-GP-data-October-to-December-2025.ods',
    out: path.join(sourceDir, 'supplementary-vaccine-coverage-GP-data-October-to-December-2025.ods')
  },
  {
    label: 'Latest annual GP supplementary COVER data, April 2024 to March 2025',
    url: 'https://assets.publishing.service.gov.uk/media/68de84adef1c2f72bc1e4d49/supplementary-GP-annual-cover-data-2024-to-2025.ods',
    out: path.join(sourceDir, 'supplementary-GP-annual-cover-data-2024-to-2025.ods')
  },
  {
    label: 'Annual COVER main data tables, 2024 to 2025',
    url: 'https://assets.publishing.service.gov.uk/media/68d52841e65dc716bfb1ddb0/cover-anual-data-tables-2024-to-2025.ods',
    out: path.join(sourceDir, 'cover-anual-data-tables-2024-to-2025.ods')
  },
  {
    label: 'Historic annual GP supplementary COVER data, 2023 to 2024',
    url: 'https://assets.publishing.service.gov.uk/media/67fe4630ed87b816085466d4/supplementary-GP-annual-data-cover-programme-2023-2024.ods',
    out: path.join(sourceDir, 'supplementary-GP-annual-data-cover-programme-2023-2024.ods')
  },
  {
    label: 'Historic annual GP supplementary COVER data, 2022 to 2023',
    url: 'https://assets.publishing.service.gov.uk/media/65eedd2062ff48488387b254/cover-gp-annual-2022-to-2023.ods',
    out: path.join(sourceDir, 'cover-gp-annual-2022-to-2023.ods')
  },
  {
    label: 'Historic annual GP supplementary COVER data, 2021 to 2022',
    url: 'https://assets.publishing.service.gov.uk/media/63d8ec97d3bf7f2523990e26/cover-gp-annual-2021-to-2022.ods',
    out: path.join(sourceDir, 'cover-gp-annual-2021-to-2022.ods')
  },
  {
    label: 'Historic annual GP supplementary COVER data, 2020 to 2021',
    url: 'https://assets.publishing.service.gov.uk/media/6447fda3529eda000c3b043d/cover-gp-annual-2020-to-2021v2.ods',
    out: path.join(sourceDir, 'cover-gp-annual-2020-to-2021v2.ods')
  },
  {
    label: 'NHS England 2023 to 2024 childhood vaccination CSV zip',
    url: 'https://files.digital.nhs.uk/49/D6F2CE/child-vaccination-stats-csvs-2023-24.zip',
    out: path.join(sourceDir, 'child-vaccination-stats-csvs-2023-24.zip')
  },
  {
    label: 'ODS GP practice reference data, epraccur',
    url: 'https://www.odsdatasearchandexport.nhs.uk/api/getReport?report=epraccur',
    out: path.join(refDir, 'epraccur.csv')
  }
];

fs.mkdirSync(sourceDir, { recursive: true });
fs.mkdirSync(refDir, { recursive: true });

for (const item of downloads) {
  await download(item);
}

console.log(`Downloaded ${downloads.length} official/source files.`);
console.log('Next: python scripts/build-cover-areas.py');

async function download(item) {
  console.log(`Downloading: ${item.label}`);
  const response = await fetch(item.url, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed ${response.status} ${response.statusText}: ${item.url}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(item.out, buffer);
  console.log(`  -> ${path.relative(root, item.out)} (${buffer.length.toLocaleString()} bytes)`);
}
