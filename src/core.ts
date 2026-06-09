import { join, dirname } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

export interface InitOptions {
  dir: string;
  force: boolean;
  provider: string;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

export type PcodexCommand =
  | { type: 'help' }
  | { type: 'version' }
  | { type: 'init'; options: InitOptions }
  | { type: 'run'; args: string[] };

export async function getVersion(): Promise<string> {
  try {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(__dirname, '..', 'package.json');
    const raw = await readFile(pkgPath, 'utf-8');
    return JSON.parse(raw).version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number = 1,
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export function parseInitOptions(args: string[]): InitOptions {
  const options: InitOptions = {
    dir: process.cwd(),
    force: false,
    provider: 'openai',
    model: 'codex-mini',
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--dir':
      case '--provider':
      case '--model':
      case '--base-url':
      case '--api-key': {
        if (i + 1 >= args.length) {
          throw new CliError(`Missing value for option: ${arg}`);
        }
        const value = args[++i];
        if (arg === '--dir') options.dir = value;
        else if (arg === '--provider') options.provider = value;
        else if (arg === '--model') options.model = value;
        else if (arg === '--base-url') options.baseUrl = value;
        else if (arg === '--api-key') options.apiKey = value;
        break;
      }
      case '--force':
        options.force = true;
        break;
      default:
        throw new CliError(`Unknown option: ${arg}\nRun 'pcodex --help' for available options.`);
    }
  }

  return options;
}

export function parsePcodexCommand(args: string[]): PcodexCommand {
  const command = args[0];

  if (command === '--help' || command === '-h') {
    return { type: 'help' };
  }

  if (command === '--version' || command === '-v') {
    return { type: 'version' };
  }

  if (command === 'init') {
    return { type: 'init', options: parseInitOptions(args.slice(1)) };
  }

  return { type: 'run', args };
}

function shellQuote(value: string | undefined): string {
  const raw = value ?? '';
  return `'${raw.replace(/'/g, `'\\''`)}'`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function isBuiltInOpenAiProvider(provider: string): boolean {
  return provider === 'openai';
}

export function generateEnvContent(options: InitOptions): string {
  const lines = [
    '# Partial Codex - Project-level configuration',
    '# This file is auto-generated. Edit as needed.',
    '',
    '# API Key (required)',
    `OPENAI_API_KEY=${shellQuote(options.apiKey)}`,
    '',
    '# Runtime model override (optional, config.toml also stores the initial model)',
    `CODEX_MODEL=${shellQuote(options.model)}`,
    '',
    '# Runtime OpenAI API base URL override (optional, maps to openai_base_url)',
    options.baseUrl && isBuiltInOpenAiProvider(options.provider)
      ? `CODEX_BASE_URL=${shellQuote(options.baseUrl)}`
      : "# CODEX_BASE_URL='https://api.openai.com/v1'",
    '',
    '# Review Model (optional, defaults to main model)',
    '# CODEX_REVIEW_MODEL=',
    '',
    '# Model Settings',
    '# CODEX_REASONING_EFFORT=high',
    '# CODEX_CONTEXT_WINDOW=1000000',
    '# CODEX_AUTO_COMPACT_LIMIT=900000',
    '',
    '# Approval Policy (never, on-failure, on-request)',
    '# CODEX_APPROVAL_POLICY=never',
    '',
    '# Sandbox Mode (read-only, workspace-write, danger-full-access)',
    '# CODEX_SANDBOX=workspace-write',
    '',
    '# Network Access (true, false)',
    '# CODEX_NETWORK_ACCESS=true',
  ];

  return lines.join('\n');
}

export function generateScriptContent(): string {
  return `#!/bin/bash
# Partial Codex - Project-level Codex launcher
# This script is auto-generated. Do not edit.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENV_FILE="$SCRIPT_DIR/.env"
CONFIG_FILE="$SCRIPT_DIR/config.toml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE" >&2
  echo "Run 'pcodex init' to initialize configuration" >&2
  exit 1
fi

if [ ! -f "$CONFIG_FILE" ]; then
  echo "Error: config.toml file not found at $CONFIG_FILE" >&2
  echo "Run 'pcodex init' to initialize configuration" >&2
  exit 1
fi

# Clear inherited Codex/OpenAI config so this project stays isolated.
unset CODEX_HOME
unset OPENAI_API_KEY OPENAI_BASE_URL OPENAI_API_BASE
unset OPENAI_ORG_ID OPENAI_ORGANIZATION OPENAI_PROJECT OPENAI_PROJECT_ID
unset CODEX_MODEL CODEX_BASE_URL CODEX_REVIEW_MODEL CODEX_REASONING_EFFORT
unset CODEX_CONTEXT_WINDOW CODEX_AUTO_COMPACT_LIMIT CODEX_APPROVAL_POLICY
unset CODEX_SANDBOX CODEX_NETWORK_ACCESS

# Source environment file
set -a
source "$ENV_FILE"
set +a

# Make Codex load config.toml, auth, logs, sessions, and state from this project.
export CODEX_HOME="$SCRIPT_DIR"

# Validate required variables
if [ -z "\${OPENAI_API_KEY:-}" ]; then
  echo "Error: OPENAI_API_KEY is not set in $ENV_FILE" >&2
  exit 1
fi

# Build codex arguments
CODEX_ARGS=()

if [ -n "\${CODEX_MODEL:-}" ]; then
  CODEX_ARGS+=("-c" "model=\${CODEX_MODEL}")
fi

if [ -n "\${CODEX_BASE_URL:-}" ]; then
  CODEX_ARGS+=("-c" "openai_base_url=\${CODEX_BASE_URL}")
fi

if [ -n "\${CODEX_REVIEW_MODEL:-}" ]; then
  CODEX_ARGS+=("-c" "review_model=\${CODEX_REVIEW_MODEL}")
fi

if [ -n "\${CODEX_REASONING_EFFORT:-}" ]; then
  CODEX_ARGS+=("-c" "model_reasoning_effort=\${CODEX_REASONING_EFFORT}")
fi

if [ -n "\${CODEX_CONTEXT_WINDOW:-}" ]; then
  CODEX_ARGS+=("-c" "model_context_window=\${CODEX_CONTEXT_WINDOW}")
fi

if [ -n "\${CODEX_AUTO_COMPACT_LIMIT:-}" ]; then
  CODEX_ARGS+=("-c" "model_auto_compact_token_limit=\${CODEX_AUTO_COMPACT_LIMIT}")
fi

if [ -n "\${CODEX_APPROVAL_POLICY:-}" ]; then
  CODEX_ARGS+=("-c" "approval_policy=\${CODEX_APPROVAL_POLICY}")
fi

if [ -n "\${CODEX_SANDBOX:-}" ]; then
  CODEX_ARGS+=("-c" "sandbox_mode=\${CODEX_SANDBOX}")
fi

if [ -n "\${CODEX_NETWORK_ACCESS:-}" ]; then
  case "\${CODEX_NETWORK_ACCESS}" in
    enabled) CODEX_NETWORK_ACCESS_VALUE=true ;;
    disabled) CODEX_NETWORK_ACCESS_VALUE=false ;;
    true|false) CODEX_NETWORK_ACCESS_VALUE="\${CODEX_NETWORK_ACCESS}" ;;
    *)
      echo "Error: CODEX_NETWORK_ACCESS must be true, false, enabled, or disabled" >&2
      exit 1
      ;;
  esac
  CODEX_ARGS+=("-c" "sandbox_workspace_write.network_access=\${CODEX_NETWORK_ACCESS_VALUE}")
fi

# Add user arguments (extra args passed after pcodex command)
CODEX_ARGS+=("$@")

# Launch codex
if [ \${#CODEX_ARGS[@]} -eq 0 ]; then
  exec codex
else
  exec codex "\${CODEX_ARGS[@]}"
fi
`;
}

export function generateConfigContent(options: InitOptions): string {
  const lines = [
    '# Partial Codex - Project-level Codex configuration',
    '# This file is loaded through CODEX_HOME by debug/partial-codex/pcodex.',
    '# This file is auto-generated. Edit as needed.',
    '',
    '# Model Provider',
    `model_provider = ${tomlString(options.provider)}`,
    `model = ${tomlString(options.model)}`,
    '',
    '# Review Model (optional)',
    `# review_model = ${tomlString(options.model)}`,
    '',
    '# Model Settings',
    '# model_reasoning_effort = "high"',
    '# model_context_window = 1000000',
    '# model_auto_compact_token_limit = 900000',
    '',
    '# Approval Policy',
    '# approval_policy = "never"',
    '',
    '# Sandbox',
    '# sandbox_mode = "workspace-write"',
    '',
    '# Network Access',
    '# [sandbox_workspace_write]',
    '# network_access = true',
    '',
    '# Features',
    '# [features]',
    '# hooks = true',
    '# multi_agent = true',
  ];

  if (options.baseUrl && isBuiltInOpenAiProvider(options.provider)) {
    lines.push('');
    lines.push('# OpenAI Provider Base URL');
    lines.push(`openai_base_url = ${tomlString(options.baseUrl)}`);
  } else if (options.baseUrl) {
    lines.push('');
    lines.push('# Custom Provider Configuration');
    lines.push(`[model_providers.${tomlString(options.provider)}]`);
    lines.push(`name = ${tomlString(options.provider)}`);
    lines.push('wire_api = "responses"');
    lines.push('env_key = "OPENAI_API_KEY"');
    lines.push(`base_url = ${tomlString(options.baseUrl)}`);
  }

  return lines.join('\n');
}
