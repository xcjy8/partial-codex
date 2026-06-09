#!/usr/bin/env node

import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { exit } from 'node:process';
import { execFileSync } from 'node:child_process';
import {
  getVersion,
  parseInitOptions,
  generateEnvContent,
  generateScriptContent,
  generateConfigContent,
  CliError,
  type InitOptions,
} from './core.js';

const HELP_TEXT = `
pcodex - Project-level Codex CLI configuration manager

Usage:
  pcodex init [options]    Initialize project-level Codex configuration
  pcodex --help            Show this help message
  pcodex --version         Show version

Options:
  --dir <path>           Target directory (default: current directory)
  --force                Overwrite existing configuration
  --provider <name>      Model provider name (default: openai)
  --model <name>         Model name (default: codex-mini)
  --base-url <url>       API base URL
  --api-key <key>        API key (will be prompted if not provided)

Examples:
  pcodex init
  pcodex init --dir /path/to/project
  pcodex init --provider openai --model codex-mini
  pcodex init --provider custom --base-url https://api.example.com/v1
`;

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP_TEXT);
    exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(await getVersion());
    exit(0);
  }

  const command = args[0];

  if (command === 'init') {
    const options = parseInitOptions(args.slice(1));
    await initCommand(options);
  } else if (command === undefined) {
    await runProjectPcodex(args);
  } else {
    console.error(`Unknown command: ${command}`);
    console.log(HELP_TEXT);
    exit(1);
  }
}

async function runProjectPcodex(args: string[]): Promise<void> {
  const cwd = process.cwd();
  const scriptPath = join(cwd, 'debug', 'partial-codex', 'pcodex');

  try {
    await access(scriptPath);
  } catch {
    console.error('No pcodex configuration found in current directory.');
    console.error("Run 'pcodex init' to initialize configuration.");
    exit(1);
  }

  try {
    execFileSync(scriptPath, args, { stdio: 'inherit', cwd });
  } catch (err: unknown) {
    const status = (err as { status?: number }).status;
    exit(status ?? 1);
  }
}

async function initCommand(options: InitOptions): Promise<void> {
  const targetDir = resolve(options.dir);
  const debugDir = join(targetDir, 'debug', 'partial-codex');

  console.log('Initializing project-level Codex configuration...');
  console.log(`Target directory: ${targetDir}`);

  // Check if already initialized
  try {
    await access(join(debugDir, '.env'));
    if (!options.force) {
      console.error(`Configuration already exists at ${debugDir}`);
      console.error('Use --force to overwrite');
      exit(1);
    }
  } catch {
    // Not exists, continue
  }

  // Create directory
  await mkdir(debugDir, { recursive: true });

  // Generate .env file
  const envContent = generateEnvContent(options);
  await writeFile(join(debugDir, '.env'), envContent);

  // Generate pcodex script
  const scriptContent = generateScriptContent();
  const scriptPath = join(debugDir, 'pcodex');
  await writeFile(scriptPath, scriptContent, { mode: 0o755 });

  // Generate config.toml
  const configContent = generateConfigContent(options);
  await writeFile(join(debugDir, 'config.toml'), configContent);

  console.log(`\n✓ Configuration created at ${debugDir}`);
  console.log('\nNext steps:');
  console.log(`1. Edit ${join(debugDir, '.env')} to set your API key and other settings`);
  console.log(`2. Run ${scriptPath} to start Codex with project-level configuration`);
}

main().catch((err: unknown) => {
  if (err instanceof CliError) {
    console.error(err.message);
    exit(err.exitCode);
  }
  console.error('Error:', err instanceof Error ? err.message : err);
  exit(1);
});
