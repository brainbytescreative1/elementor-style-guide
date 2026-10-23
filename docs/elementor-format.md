# Elementor import contract

The export is a website kit, not a page-template ZIP. The package contains exactly three JSON files. All are UTF-8 without a BOM, use forward-slash paths, and have no enclosing directory.

## Manifest

- `version: "3.0"` uses the boolean `site-settings` category map.
- `elementor_version: "4.3.5"` records the version of the original known export format used here. It is not a claim of compatibility with every Elementor release.
- `site-settings.globalColors`, `globalFonts`, `themeStyleSettings`, and `generalSettings` are enabled.
- `theme`, `experiments`, `customCode`, `customIcons`, and `customFonts` are disabled. There are no plugin dependencies.
- `content.page["1"]` supplies the page title, excerpt, `doc_type: "wp-page"`, thumbnail, source URL, and terms.
- The importer resolves this entry to `content/page/1.json`. The source identifier is local to the ZIP; WordPress assigns the destination ID.
- There is no `show_on_front` flag. Importing never makes the guide the homepage.

## Settings and page

`site-settings.json` is `{ content: [], settings: {...}, metadata: [] }`. It includes four system colors, custom colors, four system typography styles, custom H1–H6 styles, body/link/button theme settings, and content width.

`content/page/1.json` is `{ content: [...], settings: {...}, metadata: {...} }`. It uses native container, heading, text-editor, button, and HTML widgets. All nested containers have `isInner: true`; only the guide root is top-level. Global references resolve to IDs included in the kit. Custom IDs are stable and namespaced by source origin to reduce collisions with other kits.

Layout CSS is scoped to `.esg-style-guide`, with no original WordPress post ID embedded. An HTML widget contains only this scoped stylesheet, not the page itself; the actual content remains editable native widgets. No website scripts, form entries, media, cookies, credentials, or API tokens are exported.

The page sets `page_layout: "elementor_canvas"`, hides the theme's page title, and includes `_wp_page_template: "elementor_canvas"` metadata. The optional noindex metadata is supported by Yoast SEO / Rank Math, not by WordPress core alone.

## Source references

- [Elementor page export runner](https://github.com/elementor/elementor/blob/main/app/modules/import-export-customization/runners/export/elementor-content.php): page manifest fields and `content/<post-type>/<id>.json` paths.
- [Elementor page import runner](https://github.com/elementor/elementor/blob/main/app/modules/import-export-customization/runners/import/elementor-content.php): manifest resolution, native document creation, published status and document import.
- [Elementor base document](https://github.com/elementor/elementor/blob/main/core/base/document.php): `get_export_data()`, `get_import_data()` and `import()`, including page settings, native elements and metadata.
- [Elementor site settings importer](https://github.com/elementor/elementor/blob/main/app/modules/import-export-customization/runners/import/site-settings.php): category flags and settings application.
- [Elementor kit format adapter](https://github.com/elementor/elementor/blob/main/app/modules/import-export-customization/compatibility/customization.php): v2-to-v3 manifest changes.

These are implementation references, not vendored WordPress code. Verify live imports after Elementor upgrades, especially if changing the native widget or kit format.
