# Changelog

All notable changes to mdview will be documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/), and this project adheres to
[Semantic Versioning](https://semver.org/).

## [1.0.0] â€?2026-10-08

### Added
- File tree with keyboard navigation, fuzzy filter, and live refresh.
- Markdown (marked) with code highlighting (highlight.js) and HTML sanitisation
  (DOMPurify).
- LaTeX rendering via KaTeX (`$...$` inline, `$$...$$` display). Toggle on/off
  in settings.
- Three-line (academic) table styling with centred text.
- Theming via JSON config files in `themes/`. Ships with four built-in themes:
  `github-light`, `github-dark`, `serif-light`, `noir`.
- Font settings: four presets, a custom-font input that scans 270+ system
  fonts, and a slider for the body size (12â€?0 px).
- Customisable keyboard shortcuts (9 actions) with conflict detection.
- Settings panel anchored to the bottom-left of the sidebar.
- Native folder picker: Windows (PowerShell FolderBrowserDialog), macOS
  (AppleScript), Linux (zenity / kdialog / python-tkinter fallback).
- Run-time directory switching via the toolbar; the current directory is
  remembered in `localStorage` and restored on the next launch.
- Read-only access limited to the mounted directory, with 403 on path
  traversal and 413 above 5 MB.
- Auto dark mode (follows `prefers-color-scheme`).
- Cross-platform: Windows, macOS, Linux.
- Project branding (favicon, badge, README in English and Simplified Chinese),
  and a Playwright-based screenshot pipeline under `scripts/screenshots.js`.

### Notes
- All third-party assets (marked, DOMPurify, highlight.js, KaTeX) are loaded
  from `cdn.jsdelivr.net` to keep the install footprint small.
- The store is dependency-free except for `express` on the server side.

### Notes
- All third-party assets (marked, DOMPurify, highlight.js, KaTeX) are loaded
  from `cdn.jsdelivr.net` to keep the install footprint small.
- The store is dependency-free except for `express` on the server side.