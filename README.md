# Style Kit — website to Elementor

A static, public-facing tool for **GitHub Pages**. Collect the styles used across a website, review the detected design system, and download **one Elementor website kit ZIP containing global styles and an editable style guide page**.

No server, WordPress password, external proxy, or API key is required. The builder and collector run in your browser.

## Use it

1. Enter the website URL in the builder and choose a page budget.
2. Click **Prepare collection** and drag **Collect site styles** to your bookmarks bar.
3. Open the source website using **Open the website**, then run that bookmark from a public page.
4. Click **Start collection** in the collector panel. Keep the source tab open.
5. Results return to the builder. If the tab connection was severed, use **Save report JSON** in the collector and **Import report JSON** in the builder.
6. Review colors, fonts, heading sizes for all three viewports, button radius, and content width. The preview updates as you edit.
7. Download the Elementor kit. In Elementor's **website kit / website templates importer**, select **Site Settings** and **Content / Pages**.

The **Aloha example** uses the approved reference palette and heading sizes from this project. It is clearly labeled as an example, not a complete crawl of that site.

## Why a bookmarklet?

GitHub Pages serves static files. A page hosted there cannot read another website's DOM or computed styles because of the browser's same-origin policy. The collector therefore runs **on the source site**, where it can read same-origin pages in rendered frames. It returns a report to the builder with an origin-checked, session-bound `postMessage` connection.

This is not a server-side crawler disguised as a static app. There is no CORS proxy or remote browser service. Sites that block external bookmarklet scripts, same-origin frames, or the required requests cannot be scanned this way. Those limitations are reported rather than bypassed.

## Collection behavior

- Reads `robots.txt`, up to 30 same-origin sitemap files, and same-origin links from fetched and rendered pages.
- Captures computed styles at **1440px, 768px, and 390px**; desktop-only collection is optional.
- Measures headings, body text, links, buttons, colors, gradients, corner radii, shadows, and likely content widths.
- Repeated styles across multiple pages outweigh unusually frequent styles on one page.
- Skips administration paths, file downloads, checkout/cart links, credentials in URLs, and common state-changing query parameters.
- Fetches page HTML without credentials to check public availability. Browser-rendered frames may use the site's existing cookies; no form values, credentials, page body copy, or cookies are included in the report. Log out first if you need a completely anonymous rendering.
- Honors robots rules and crawl delay. A missing `robots.txt` (HTTP 4xx other than 429) is treated as unavailable; network/server errors pause collection conservatively.
- Uses a configurable page budget (25–2,000), a one-hour time limit, and a 20 MB report budget. Stop at any time to keep partial results.
- The coverage panel lists collected pages, failures, warnings, and whether the discovered queue was exhausted. It never proves that undiscoverable or unlinked pages do not exist.

Styles are observations, not authoritative brand decisions. Review inferred headings and global color roles before exporting. Custom/licensed font files are not copied; install them separately on the destination when needed.

## What the ZIP contains

```text
manifest.json
site-settings.json
content/
  page/
    1.json
```

The manifest uses Elementor's **3.0 website-kit format**, matched against the Elementor **4.3.5** export supplied for this project. It declares both settings and page content. It does not declare theme installation, plugin dependencies, experiments, custom code, custom icons, or font uploads.

Global colors and typography are referenced by the page's native Elementor widgets. The guide includes typography, swatches, gradients when observed, filled and outlined buttons, sample light/dark sections, radii, shadows when observed, and content width. Its CSS is scoped to the guide and stored in an HTML widget, so **Atomic Editor and Elementor Pro custom CSS are not required**. The destination must support container-based Elementor and website-kit imports. Theme and font availability can affect final rendering.

**Noindex:** the optional page metadata sets Yoast SEO's `_yoast_wpseo_meta-robots-noindex=1` and Rank Math's `rank_math_robots=[noindex,follow]`. Elementor's document importer saves this metadata. This is not a universal WordPress robots setting: verify the final robots tag after import, and configure noindex manually if neither plugin is active. A page import creates a published page; it does not replace an existing guide or change the homepage.

See [the format notes](docs/elementor-format.md) for the importer contract and source references.

## Run locally

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev
```

Open the printed URL, normally `http://127.0.0.1:4173`. `dev` builds and serves `dist/`; rerun after changing source files. When collecting HTTPS sites, use the deployed HTTPS GitHub Pages builder: browsers may block a collector loaded from a local HTTP development server.

```sh
npm test
npm run check
npm run build
```

The production output is entirely static in `dist/`. Asset URLs work under the repository subpath; no domain-specific configuration is needed.

## Deploy to GitHub Pages

In the repository's **Settings → Pages**, choose **GitHub Actions** as the source. Push to `main` or run **Deploy GitHub Pages** in Actions. The workflow installs locked dependencies, runs tests and syntax checks, builds the static files, and deploys the Pages artifact.

Expected project URL: `https://brainbytescreative1.github.io/elementor-style-guide/`.

## Project map

| File | Purpose |
| --- | --- |
| `src/collector.js` | Source-site bookmarklet UI, discovery, rendered style collection, cancellation, report handoff |
| `src/robots.js` | Robots rules and sitemap parsing |
| `src/model.js` | Report validation, normalization, style ranking, editable theme model |
| `src/elementor.js` | Global settings, native guide widgets, manifest, ZIP packaging and contract validation |
| `src/app.js` | Builder UI, source connection, report import, review, preview and downloads |
| `public/` | Static interface and visual design |
| `examples/aloha-report.json` | Labeled reference example |
| `test/core.test.js` | Ranking, robots, malformed input, ZIP, global-reference and import-format checks |

## Privacy and verification

Reports stay in memory until downloaded; they are not uploaded to a service or saved in browser storage. The interface uses Google Fonts, and its preview requests detected Google font family names from Google Fonts. The target site loads its own normal resources in frames.

Automated tests validate the generated ZIP structure, manifest/page paths, JSON encoding, native container nesting, global references, input handling, responsive style mapping, and optional SEO metadata. Browser QA checks the static interface and generated preview. A ZIP still needs a final import check on the destination WordPress installation; local contract tests do not substitute for that check.
