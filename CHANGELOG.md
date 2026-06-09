# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-06-09

### Added

- `pcodex init` command to initialize project-level Codex configuration
- `pcodex init --force` to overwrite existing configuration
- `pcodex init --provider`, `--model`, `--base-url`, `--api-key` options
- `pcodex init --dir` to specify target project directory
- Auto-generated launcher script (`debug/partial-codex/pcodex`)
- Auto-generated `.env` and `config.toml` configuration files
- `pcodex --help` and `pcodex --version` commands
- Direct `pcodex` invocation to run project-level Codex launcher
- Unit tests with Vitest (16 tests)
- ESLint + Prettier code quality toolchain
- GitHub Actions CI workflow (Node 20/22 matrix)
- MIT License
