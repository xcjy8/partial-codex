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
- Project launcher sets `CODEX_HOME` so Codex loads project-local `config.toml`
- `pcodex --help` and `pcodex --version` commands
- Direct `pcodex` invocation to run project-level Codex launcher and pass through Codex args
- Unit tests with Vitest
- ESLint + Prettier code quality toolchain
- GitHub Actions CI workflow (Node 20/22 matrix)
- MIT License

### Fixed

- Fixed project config loading by using project-local `CODEX_HOME` instead of invalid `--config <file>`
- Cleared inherited Codex/OpenAI environment before sourcing project `.env`
- Fixed generated Codex config keys for `openai_base_url`, `sandbox_mode`, and sandbox network access
- Avoided invalid `[model_providers.openai]` output for the built-in OpenAI provider
- Forwarded unknown/top-level Codex commands such as `pcodex exec ...` to the project launcher
- Removed unused `CODEX_PROVIDER` from `.env` generation
- Removed `CODEX_EXTRA_ARGS` (broken space splitting; use direct args instead)
- Fixed help text: removed misleading "will be prompted" for `--api-key`
