import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CliError,
  generateConfigContent,
  generateEnvContent,
  generateScriptContent,
  parseInitOptions,
  parsePcodexCommand,
} from '../core.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

async function createLauncherFixture(envContent: string): Promise<{
  binDir: string;
  capturePath: string;
  launcherPath: string;
  projectConfigDir: string;
}> {
  const projectConfigDir = await mkdtemp(join(tmpdir(), 'pcodex-test-'));
  tempDirs.push(projectConfigDir);

  const binDir = join(projectConfigDir, 'bin');
  const capturePath = join(projectConfigDir, 'capture.txt');
  const launcherPath = join(projectConfigDir, 'pcodex');

  await mkdir(binDir);
  await writeFile(join(projectConfigDir, '.env'), envContent);
  await writeFile(
    join(projectConfigDir, 'config.toml'),
    'model_provider = "openai"\nmodel = "codex-mini"\n',
  );
  await writeFile(launcherPath, generateScriptContent(), { mode: 0o755 });
  await writeFile(
    join(binDir, 'codex'),
    `#!/bin/bash
{
  printf 'CODEX_HOME=%s\\n' "\${CODEX_HOME-}"
  printf 'OPENAI_API_KEY=%s\\n' "\${OPENAI_API_KEY-}"
  printf 'ARGS='
  for arg in "$@"; do
    printf '[%s]' "$arg"
  done
  printf '\\n'
} > "$CAPTURE"
`,
    { mode: 0o755 },
  );

  return { binDir, capturePath, launcherPath, projectConfigDir };
}

describe('parseInitOptions', () => {
  it('returns defaults with no arguments', () => {
    const opts = parseInitOptions([]);
    expect(opts.dir).toBe(process.cwd());
    expect(opts.force).toBe(false);
    expect(opts.provider).toBe('openai');
    expect(opts.model).toBe('codex-mini');
    expect(opts.baseUrl).toBeUndefined();
    expect(opts.apiKey).toBeUndefined();
  });

  it('parses all options', () => {
    const opts = parseInitOptions([
      '--dir',
      '/tmp/test',
      '--force',
      '--provider',
      'custom',
      '--model',
      'gpt-4',
      '--base-url',
      'https://api.example.com/v1',
      '--api-key',
      'sk-test',
    ]);
    expect(opts.dir).toBe('/tmp/test');
    expect(opts.force).toBe(true);
    expect(opts.provider).toBe('custom');
    expect(opts.model).toBe('gpt-4');
    expect(opts.baseUrl).toBe('https://api.example.com/v1');
    expect(opts.apiKey).toBe('sk-test');
  });

  it('throws on unknown option', () => {
    expect(() => parseInitOptions(['--unknown'])).toThrow(CliError);
    expect(() => parseInitOptions(['--unknown'])).toThrow('Unknown option: --unknown');
  });

  it('throws when option value is missing', () => {
    expect(() => parseInitOptions(['--dir'])).toThrow(CliError);
    expect(() => parseInitOptions(['--dir'])).toThrow('Missing value for option: --dir');
  });

  it('throws when last option is missing value', () => {
    expect(() => parseInitOptions(['--provider', 'openai', '--model'])).toThrow(
      'Missing value for option: --model',
    );
  });
});

describe('parsePcodexCommand', () => {
  it('routes init to initialization', () => {
    expect(parsePcodexCommand(['init', '--model', 'gpt-4'])).toEqual({
      type: 'init',
      options: {
        dir: process.cwd(),
        force: false,
        provider: 'openai',
        model: 'gpt-4',
      },
    });
  });

  it('keeps top-level help and version for the wrapper', () => {
    expect(parsePcodexCommand(['--help'])).toEqual({ type: 'help' });
    expect(parsePcodexCommand(['-v'])).toEqual({ type: 'version' });
  });

  it('passes Codex commands and their options through', () => {
    expect(parsePcodexCommand(['exec', '--help'])).toEqual({
      type: 'run',
      args: ['exec', '--help'],
    });
  });

  it('runs the project launcher with no arguments', () => {
    expect(parsePcodexCommand([])).toEqual({ type: 'run', args: [] });
  });
});

describe('generateEnvContent', () => {
  it('includes model', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
    });
    expect(content).toContain("CODEX_MODEL='codex-mini'");
  });

  it('includes api key when provided', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
      apiKey: 'sk-test',
    });
    expect(content).toContain("OPENAI_API_KEY='sk-test'");
  });

  it('comments out base url when not provided', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
    });
    expect(content).toContain("# CODEX_BASE_URL='https://api.openai.com/v1'");
  });

  it('includes runtime base url only for the built-in OpenAI provider', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'gpt-4',
      baseUrl: 'https://proxy.example.com/v1',
    });
    expect(content).toContain("CODEX_BASE_URL='https://proxy.example.com/v1'");
  });

  it('does not duplicate custom provider base url as an OpenAI runtime override', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'custom',
      model: 'gpt-4',
      baseUrl: 'https://proxy.example.com/v1',
    });
    expect(content).toContain("# CODEX_BASE_URL='https://api.openai.com/v1'");
    expect(content).not.toContain("CODEX_BASE_URL='https://proxy.example.com/v1'");
  });

  it('shell-quotes generated values', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: "model'with-quote",
      apiKey: "sk'test",
    });
    expect(content).toContain("OPENAI_API_KEY='sk'\\''test'");
    expect(content).toContain("CODEX_MODEL='model'\\''with-quote'");
  });

  it('does not include unused CODEX_PROVIDER or CODEX_EXTRA_ARGS', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
    });
    expect(content).not.toContain('CODEX_PROVIDER');
    expect(content).not.toContain('CODEX_EXTRA_ARGS');
  });
});

describe('generateScriptContent', () => {
  it('starts with shebang', () => {
    const content = generateScriptContent();
    expect(content).toMatch(/^#!/);
  });

  it('sources the .env file', () => {
    const content = generateScriptContent();
    expect(content).toContain('source "$ENV_FILE"');
  });

  it('validates OPENAI_API_KEY', () => {
    const content = generateScriptContent();
    expect(content).toContain('OPENAI_API_KEY');
  });

  it('loads config.toml through CODEX_HOME', () => {
    const content = generateScriptContent();
    expect(content).toContain('CONFIG_FILE="$SCRIPT_DIR/config.toml"');
    expect(content).toContain('export CODEX_HOME="$SCRIPT_DIR"');
    expect(content).not.toContain('"--config" "$CONFIG_FILE"');
  });

  it('builds codex args from env vars', () => {
    const content = generateScriptContent();
    expect(content).toContain('CODEX_MODEL');
    expect(content).toContain('CODEX_BASE_URL');
    expect(content).toContain('CODEX_SANDBOX');
  });
});

describe('generated launcher behavior', () => {
  it('isolates Codex home and passes user arguments through', async () => {
    const fixture = await createLauncherFixture(
      [
        "OPENAI_API_KEY='project-key'",
        "CODEX_MODEL='project-model'",
        "CODEX_BASE_URL='https://project.example/v1'",
        "CODEX_SANDBOX='workspace-write'",
      ].join('\n'),
    );

    execFileSync(fixture.launcherPath, ['exec', 'say hello', '--flag', 'two words'], {
      cwd: fixture.projectConfigDir,
      env: {
        ...process.env,
        PATH: `${fixture.binDir}${delimiter}${process.env.PATH ?? ''}`,
        CAPTURE: fixture.capturePath,
        OPENAI_API_KEY: 'global-key',
        OPENAI_BASE_URL: 'https://global.example/v1',
      },
    });

    const captured = await readFile(fixture.capturePath, 'utf-8');
    expect(captured).toContain(`CODEX_HOME=${fixture.projectConfigDir}`);
    expect(captured).toContain('OPENAI_API_KEY=project-key');
    expect(captured).toContain(
      'ARGS=[-c][model=project-model][-c][openai_base_url=https://project.example/v1][-c][sandbox_mode=workspace-write][exec][say hello][--flag][two words]',
    );
    expect(captured).not.toContain('--config');
  });

  it('does not leak inherited OpenAI base URL into the project', async () => {
    const fixture = await createLauncherFixture("OPENAI_API_KEY='project-key'\n");

    execFileSync(fixture.launcherPath, [], {
      cwd: fixture.projectConfigDir,
      env: {
        ...process.env,
        PATH: `${fixture.binDir}${delimiter}${process.env.PATH ?? ''}`,
        CAPTURE: fixture.capturePath,
        OPENAI_BASE_URL: 'https://global.example/v1',
      },
    });

    const captured = await readFile(fixture.capturePath, 'utf-8');
    expect(captured).toContain(`CODEX_HOME=${fixture.projectConfigDir}`);
    expect(captured).toContain('OPENAI_API_KEY=project-key');
    expect(captured).toContain('ARGS=\n');
  });

  it('maps network access to Codex sandbox workspace configuration', async () => {
    const fixture = await createLauncherFixture(
      ["OPENAI_API_KEY='project-key'", "CODEX_NETWORK_ACCESS='true'"].join('\n'),
    );

    execFileSync(fixture.launcherPath, [], {
      cwd: fixture.projectConfigDir,
      env: {
        ...process.env,
        PATH: `${fixture.binDir}${delimiter}${process.env.PATH ?? ''}`,
        CAPTURE: fixture.capturePath,
      },
    });

    const captured = await readFile(fixture.capturePath, 'utf-8');
    expect(captured).toContain('ARGS=[-c][sandbox_workspace_write.network_access=true]\n');
  });

  it('keeps backward compatibility with enabled network access values', async () => {
    const fixture = await createLauncherFixture(
      ["OPENAI_API_KEY='project-key'", "CODEX_NETWORK_ACCESS='enabled'"].join('\n'),
    );

    execFileSync(fixture.launcherPath, [], {
      cwd: fixture.projectConfigDir,
      env: {
        ...process.env,
        PATH: `${fixture.binDir}${delimiter}${process.env.PATH ?? ''}`,
        CAPTURE: fixture.capturePath,
      },
    });

    const captured = await readFile(fixture.capturePath, 'utf-8');
    expect(captured).toContain('ARGS=[-c][sandbox_workspace_write.network_access=true]\n');
  });
});

describe('generateConfigContent', () => {
  it('includes provider and model', () => {
    const content = generateConfigContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
    });
    expect(content).toContain('model_provider = "openai"');
    expect(content).toContain('model = "codex-mini"');
  });

  it('uses openai_base_url for the built-in OpenAI provider', () => {
    const content = generateConfigContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'gpt-4',
      baseUrl: 'https://proxy.example.com/v1',
    });
    expect(content).toContain('model_provider = "openai"');
    expect(content).toContain('openai_base_url = "https://proxy.example.com/v1"');
    expect(content).not.toContain('[model_providers."openai"]');
  });

  it('includes custom provider section when base url is set for a non-built-in provider', () => {
    const content = generateConfigContent({
      dir: '/tmp',
      force: false,
      provider: 'custom',
      model: 'gpt-4',
      baseUrl: 'https://proxy.example.com/v1',
    });
    expect(content).toContain('[model_providers."custom"]');
    expect(content).toContain('env_key = "OPENAI_API_KEY"');
    expect(content).toContain('base_url = "https://proxy.example.com/v1"');
  });

  it('quotes TOML strings and table keys', () => {
    const content = generateConfigContent({
      dir: '/tmp',
      force: false,
      provider: 'custom.provider',
      model: 'gpt "quoted"',
      baseUrl: 'https://proxy.example.com/v1',
    });
    expect(content).toContain('model_provider = "custom.provider"');
    expect(content).toContain('model = "gpt \\"quoted\\""');
    expect(content).toContain('[model_providers."custom.provider"]');
  });

  it('omits custom provider section when no base url', () => {
    const content = generateConfigContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
    });
    expect(content).not.toContain('[model_providers.');
  });
});
