#!/usr/bin/env python3
r"""
Fix HerdWatch route/content issues.

What this changes:
1. Adds a real /wakefield/ React route in src/App.tsx.
2. Replaces the thin myths page with a fuller myths/explainer page.
3. Ensures the post-build static route script creates wakefield/index.html.
4. Ensures package.json build runs the static route entrypoint script.
5. Ensures public/_redirects includes Wakefield, towns, methodology and SPA fallbacks.

Run:
    py fix_herdwatch_pages.py
or:
    python fix_herdwatch_pages.py C:\Users\campe\herdWatch
"""

from __future__ import annotations

import json
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path


DEFAULT_ROOT = Path(r"C:\Users\campe\herdWatch")


def backup(path: Path) -> None:
    if path.exists():
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = path.with_suffix(path.suffix + f".bak_{stamp}")
        shutil.copy2(path, backup_path)
        print(f"Backed up {path} -> {backup_path}")


def replace_get_page_from_path(text: str) -> str:
    new_func = """function getPageFromPath(pathname: string): 'home' | 'towns' | 'town' | 'map' | 'myths' | 'wakefield' | 'methodology' | 'not-found' {
  if (pathname === '/' || pathname === '') return 'home';
  if (pathname.startsWith('/town/')) return 'town';
  if (pathname.startsWith('/towns')) return 'towns';
  if (pathname.startsWith('/map')) return 'map';
  if (pathname.startsWith('/myths')) return 'myths';
  if (pathname.startsWith('/wakefield')) return 'wakefield';
  if (pathname.startsWith('/methodology')) return 'methodology';
  return 'not-found';
}"""

    pattern = r"function getPageFromPath\(pathname: string\): .*?\n\}"
    text, count = re.subn(pattern, new_func, text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError("Could not replace getPageFromPath(). App.tsx structure may have changed.")
    return text


MYTHS_PAGE = r"""function MythsPage() {
  return (
    <main className="main-content page-shell readable">
      <PageTitle
        eyebrow="The myth"
        title="Herd immunity is not magic"
        description="It is a threshold effect: when enough people are immune, infections have fewer routes through a community."
      />

      <section className="card prose-card">
        <h2>Why the 95% line matters</h2>
        <p>
          Measles is unusually infectious. When MMR coverage drops below the herd-immunity target,
          outbreaks become easier to start and harder to contain.
        </p>
        <p>
          The 95% figure is not a moral judgement on individual families. It is a practical warning
          line for communities, schools, nurseries and health systems.
        </p>
      </section>

      <section className="card prose-card">
        <h2>The common mistake</h2>
        <p>
          The mistake is thinking herd immunity means everyone is perfectly protected. It does not.
          It means infection has fewer paths through the population, so outbreaks are less likely to
          accelerate.
        </p>
        <p>
          When coverage is patchy, even a national average can hide local vulnerability. That is why
          HerdWatch focuses on postcode-district level signals instead of only headline national figures.
        </p>
      </section>

      <section className="card prose-card">
        <h2>Who low coverage puts at risk</h2>
        <p>
          Falling MMR coverage matters most for people who cannot rely on vaccination themselves:
          babies too young for MMR, people with weakened immune systems, and people whose protection
          did not fully develop after vaccination.
        </p>
        <p>
          The point of the site is not to shame families. The useful civic question is simpler:
          where are the weak spots, and how visible are they?
        </p>
      </section>

      <section className="card prose-card">
        <h2>What HerdWatch is measuring</h2>
        <p>
          HerdWatch uses generated NHS COVER area data aggregated into postcode districts. The figures
          are local coverage indicators, not household-level records and not individual vaccination records.
        </p>
        <p>
          A red area means coverage is below the safer threshold. It does not prove an outbreak is happening.
          It means the area may be more vulnerable if measles is introduced.
        </p>
      </section>

      <section className="card prose-card">
        <h2>Useful next step</h2>
        <p>
          If you are unsure about your own or your child's vaccination status, use official NHS guidance
          or contact your GP practice. HerdWatch is a public-interest dashboard, not medical advice.
        </p>
        <p>
          <a className="btn btn-red" href="https://www.nhs.uk/vaccinations/mmr-vaccine/" target="_blank" rel="noreferrer">
            Read NHS MMR guidance
          </a>
        </p>
      </section>
    </main>
  );
}"""


WAKEFIELD_PAGE = r"""function WakefieldPage() {
  return (
    <main className="main-content page-shell readable">
      <PageTitle
        eyebrow="Wakefield"
        title="The long shadow of one bad claim"
        description="Why one discredited MMR scare still matters for public health, local trust and outbreak vulnerability."
      />

      <section className="card prose-card">
        <h2>Why this page exists</h2>
        <p>
          MMR hesitancy did not appear from nowhere. One of the biggest shocks to public confidence
          came from a now-discredited claim linking MMR to autism.
        </p>
        <p>
          The claim spread faster than the correction. That is why a local coverage tracker needs a
          page explaining the history, not just a chart showing the numbers.
        </p>
      </section>

      <section className="card prose-card">
        <h2>The basic story</h2>
        <p>
          A small 1998 paper helped fuel public fear about the MMR vaccine. The central claim did not
          hold up, the paper was later retracted, and the scare became a case study in how weak evidence
          can damage public trust for decades.
        </p>
        <p>
          HerdWatch does not treat that story as gossip. It treats it as infrastructure damage:
          when trust falls, vaccination coverage can fall with it.
        </p>
      </section>

      <section className="card prose-card">
        <h2>What the data question becomes</h2>
        <p>
          The useful question is not whether one parent is to blame. The useful question is whether
          whole areas have slipped below safer coverage levels.
        </p>
        <p>
          That is why HerdWatch tracks postcode-district coverage and flags places below the 95% target
          or below 90%, where vulnerability becomes harder to ignore.
        </p>
      </section>

      <section className="card prose-card">
        <h2>What this page is not saying</h2>
        <p>
          This page is not medical advice. It is not a substitute for a GP, NHS guidance or official
          public health advice.
        </p>
        <p>
          It is a plain-English explanation of why misinformation can have a measurable civic cost:
          fewer protected people, weaker herd immunity and more outbreak risk.
        </p>
      </section>

      <section className="card prose-card">
        <h2>Where to go next</h2>
        <p>
          Use the explorer to look at local coverage, or read NHS guidance if you need practical
          information about the MMR vaccine.
        </p>
        <p>
          <a className="btn btn-red" href="/map/">Open the coverage explorer</a>
          {' '}
          <a className="btn btn-outline" href="https://www.nhs.uk/vaccinations/mmr-vaccine/" target="_blank" rel="noreferrer">
            NHS MMR guidance
          </a>
        </p>
      </section>
    </main>
  );
}"""


def replace_or_insert_pages(text: str) -> str:
    pattern = r"function MythsPage\(\) \{.*?\n\}\n\n(?=function (?:WakefieldPage|MethodologyPage)\(\))"
    text, count = re.subn(pattern, MYTHS_PAGE + "\n\n", text, count=1, flags=re.DOTALL)
    if count != 1:
        raise RuntimeError("Could not replace MythsPage(). App.tsx structure may have changed.")

    if "function WakefieldPage()" not in text:
        marker = "function MethodologyPage() {"
        if marker not in text:
            raise RuntimeError("Could not find MethodologyPage() insertion point.")
        text = text.replace(marker, WAKEFIELD_PAGE + "\n\n" + marker, 1)

    return text


def add_wakefield_render(text: str) -> str:
    if "{page === 'wakefield' ? <WakefieldPage /> : null}" in text:
        return text

    old = "      {page === 'myths' ? <MythsPage /> : null}\n      {page === 'methodology' ? <MethodologyPage /> : null}"
    new = "      {page === 'myths' ? <MythsPage /> : null}\n      {page === 'wakefield' ? <WakefieldPage /> : null}\n      {page === 'methodology' ? <MethodologyPage /> : null}"

    if old not in text:
        raise RuntimeError("Could not find render insertion point for WakefieldPage.")
    return text.replace(old, new, 1)


def patch_app_tsx(root: Path) -> None:
    app_path = root / "src" / "App.tsx"
    if not app_path.exists():
        raise FileNotFoundError(f"Missing {app_path}")

    backup(app_path)
    text = app_path.read_text(encoding="utf-8")
    text = replace_get_page_from_path(text)
    text = replace_or_insert_pages(text)
    text = add_wakefield_render(text)
    app_path.write_text(text, encoding="utf-8")
    print(f"Patched {app_path}")


def ensure_route_script(root: Path) -> None:
    scripts_dir = root / "scripts"
    scripts_dir.mkdir(exist_ok=True)

    route_script = scripts_dir / "create-static-route-entrypoints.mjs"
    route_script.write_text(
        """import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const distDir = 'dist';
const sourceIndex = join(distDir, 'index.html');

const routes = [
  'towns',
  'methodology',
  'map',
  'myths',
  'wakefield'
];

if (!existsSync(sourceIndex)) {
  throw new Error('dist/index.html does not exist. Run vite build before creating route entrypoints.');
}

for (const route of routes) {
  const target = join(distDir, route, 'index.html');
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(sourceIndex, target);
  console.log(`Created ${target}`);
}
""",
        encoding="utf-8",
    )
    print(f"Ensured {route_script}")


def ensure_package_build(root: Path) -> None:
    package_path = root / "package.json"
    if not package_path.exists():
        print("No package.json found; skipping build script patch.")
        return

    backup(package_path)
    data = json.loads(package_path.read_text(encoding="utf-8"))
    scripts = data.setdefault("scripts", {})
    build = scripts.get("build", "")

    if "create-static-route-entrypoints.mjs" not in build:
        if "vite build" in build:
            build = build.replace("vite build", "vite build && node scripts/create-static-route-entrypoints.mjs", 1)
        elif build.strip():
            build = build + " && node scripts/create-static-route-entrypoints.mjs"
        else:
            build = "vite build && node scripts/create-static-route-entrypoints.mjs"

    scripts["build"] = build
    package_path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Ensured package build script: {build}")


def ensure_redirects(root: Path) -> None:
    public_dir = root / "public"
    public_dir.mkdir(exist_ok=True)
    redirects_path = public_dir / "_redirects"

    wanted_lines = [
        "/wakefield      /wakefield/index.html     200",
        "/wakefield/     /wakefield/index.html     200",
        "/map            /map/index.html           200",
        "/map/           /map/index.html           200",
        "/myths          /myths/index.html         200",
        "/myths/         /myths/index.html         200",
        "/towns          /towns/index.html         200",
        "/towns/         /towns/index.html         200",
        "/methodology    /methodology/index.html   200",
        "/methodology/   /methodology/index.html   200",
        "/town/*         /index.html               200",
        "/*              /index.html               200",
    ]

    current = redirects_path.read_text(encoding="utf-8") if redirects_path.exists() else ""
    if redirects_path.exists():
        backup(redirects_path)

    old_route_prefixes = (
        "/wakefield", "/map", "/myths", "/towns", "/methodology", "/town/*", "/*"
    )
    kept = []
    for line in current.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith(old_route_prefixes):
            continue
        kept.append(line)

    redirects_path.write_text("\n".join(wanted_lines + kept) + "\n", encoding="utf-8")
    print(f"Ensured {redirects_path}")


def main() -> None:
    root = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_ROOT
    root = root.expanduser().resolve()

    print(f"Patching HerdWatch at: {root}")
    patch_app_tsx(root)
    ensure_route_script(root)
    ensure_package_build(root)
    ensure_redirects(root)

    print("\nDone.")
    print("Next commands:")
    print(fr"cd {root}")
    print("npm run build")
    print("npm run preview")


if __name__ == "__main__":
    main()
