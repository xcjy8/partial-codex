import { describe, it, expect } from 'vitest';
import {
  parseInitOptions,
  generateEnvContent,
  generateScriptContent,
  generateConfigContent,
  CliError,
} from '../core.js';

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

describe('generateEnvContent', () => {
  it('includes provider and model', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
    });
    expect(content).toContain('CODEX_PROVIDER=openai');
    expect(content).toContain('CODEX_MODEL=codex-mini');
  });

  it('includes api key when provided', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
      apiKey: 'sk-test',
    });
    expect(content).toContain('OPENAI_API_KEY=sk-test');
  });

  it('comments out base url when not provided', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'openai',
      model: 'codex-mini',
    });
    expect(content).toContain('# CODEX_BASE_URL=https://api.openai.com/v1');
  });

  it('includes base url when provided', () => {
    const content = generateEnvContent({
      dir: '/tmp',
      force: false,
      provider: 'custom',
      model: 'gpt-4',
      baseUrl: 'https://proxy.example.com/v1',
    });
    expect(content).toContain('CODEX_BASE_URL=https://proxy.example.com/v1');
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

  it('builds codex args from env vars', () => {
    const content = generateScriptContent();
    expect(content).toContain('CODEX_MODEL');
    expect(content).toContain('CODEX_BASE_URL');
    expect(content).toContain('CODEX_SANDBOX');
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

  it('includes custom provider section when base url is set', () => {
    const content = generateConfigContent({
      dir: '/tmp',
      force: false,
      provider: 'custom',
      model: 'gpt-4',
      baseUrl: 'https://proxy.example.com/v1',
    });
    expect(content).toContain('[model_providers.custom]');
    expect(content).toContain('base_url = "https://proxy.example.com/v1"');
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
