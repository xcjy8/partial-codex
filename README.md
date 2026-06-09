# partial-codex

[![CI](https://img.shields.io/github/actions/workflow/status/xcjy8/partial-codex/ci.yml?branch=main)](https://github.com/xcjy8/partial-codex/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-brightgreen.svg)](https://nodejs.org/)

**项目级 Codex CLI 配置管理工具**

让每个项目拥有独立的 Codex 配置，互不干扰，也不影响全局配置。

## 特性

- **项目隔离**：每个项目的配置完全独立
- **零全局影响**：不读取、不修改全局 `~/.codex/config.toml`
- **简单易用**：一条命令初始化，一条命令启动
- **灵活配置**：支持自定义 API key、模型、base URL
- **透传参数**：支持透传 Codex CLI 参数

## 快速开始

### 安装

```bash
# 克隆项目
git clone <repository-url>
cd partial-codex

# 安装依赖
pnpm install

# 构建项目
pnpm build

# 全局链接
pnpm link
```

### 使用

```bash
# 1. 进入你的项目目录
cd /path/to/your/project

# 2. 初始化配置
pcodex init

# 3. 编辑配置（填写 API key 等）
vim debug/partial-codex/.env

# 4. 启动 Codex
pcodex
```

## 配置示例

### 使用 OpenAI 官方 API

```bash
OPENAI_API_KEY='sk-xxx'
CODEX_MODEL='codex-mini'
```

### 使用 OpenAI API 代理

```bash
OPENAI_API_KEY='sk-xxx'
CODEX_MODEL='codex-mini'
CODEX_BASE_URL='https://your-api-proxy.com/v1'
```

初始化时传入的 `--provider`、`--model`、`--base-url` 会写入项目本地
`debug/partial-codex/config.toml`。启动脚本会把 `debug/partial-codex` 设置为
`CODEX_HOME`，因此 Codex 会从项目目录读取配置和写入状态，而不是使用 `~/.codex`。
当 provider 为默认 `openai` 时，`--base-url` 会写入 Codex 官方支持的
`openai_base_url`；自定义 provider 名称会写入 `[model_providers.<name>]`。

## 命令参考

```bash
# 查看帮助
pcodex --help

# 查看版本
pcodex --version

# 初始化配置
pcodex init

# 初始化配置（OpenAI API 代理）
pcodex init --provider openai --model codex-mini --base-url http://xxx

# 初始化配置（自定义 provider）
pcodex init --provider proxy --model codex-mini --base-url http://xxx

# 强制覆盖已有配置
pcodex init --force

# 启动 Codex（在项目根目录）
pcodex

# 启动 Codex 并透传参数
pcodex exec "review this project"

# 启动 Codex（指定路径）
./debug/partial-codex/pcodex
```

## 技术栈

- **语言**：TypeScript
- **运行时**：Node.js 20+
- **构建工具**：tsc
- **测试**：Vitest
- **Lint**：ESLint + Prettier

## 开发

```bash
# 安装依赖
pnpm install

# 构建
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint

# 格式化
pnpm format

# 类型检查
pnpm typecheck
```

## 目录结构

```
partial-codex/
├── src/
│   ├── index.ts          # CLI 入口
│   ├── core.ts           # 核心逻辑（可测试）
│   └── __tests__/
│       └── core.test.ts  # 单元测试
├── dist/                 # 编译输出
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
├── eslint.config.js      # ESLint 配置
├── vitest.config.ts      # Vitest 配置
├── .env.example          # 环境变量示例
├── .editorconfig         # 编辑器配置
├── .prettierrc           # Prettier 配置
├── .gitignore            # Git 忽略规则
├── LICENSE               # MIT 许可证
└── README.md             # 项目说明
```

## 许可证

MIT
