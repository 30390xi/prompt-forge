# Prompt Forge（桌面版）

可安装的跨平台桌面应用（Windows / macOS）：提示词增强、多 Git 仓库工作日报、多模型提供商配置。  
**技术栈**：Electron + Vue 3 + Vite，业务逻辑在 Electron 主进程（TypeScript），数据存本地 **SQLite**（`better-sqlite3`）。

> 原 Spring Boot + MySQL 后端已移至 [`legacy/backend/`](legacy/backend/)，仅作参考，**桌面版为当前产品**。

## 功能

- **提示词增强**：原版 / 扩充 / 精简 / 工程简报，自定义风格、历史记录、取消进行中的请求、恢复原文
- **多项目日报**：系统文件夹选择器、按深度发现 Git 仓库、按**项目分组**的固定模板生成、LLM 润色、复制/导出、**日报记录列表**（可查看/复制/删除）

### 日报输出格式

生成结果以 `【日报】日期  作者：…` 开头，每个 Git 仓库一段 `【项目名】`，条目为 `1) 【类型】 任务说明 【开发完成】` 等形式（类型如开发、bug修复、体验优化等；已提交默认为【开发完成】，未提交改动为【未完成】）。润色仅改写任务措辞，不擅自添加「已部署」「已自测」等标签。
- **设置（模型）**：OpenAI 兼容 `chat/completions`；预设 **xAI Grok**、DeepSeek、GLM Coding Plan、Kimi Coding Plan

### 模型与默认提供商

| 预设 | Base URL | 默认模型（可编辑） |
| --- | --- | --- |
| **xAI Grok（全新安装默认「当前使用」）** | `https://api.x.ai/v1` | `grok-4.7`（见 [xAI 模型文档](https://docs.x.ai/docs/models)） |
| DeepSeek | `https://api.deepseek.com` | `deepseek-flash`（亦可 `deepseek-v4-pro`） |
| GLM Coding Plan | `https://open.bigmodel.cn/api/coding/paas/v4` | `glm-5.3` |
| Kimi Coding Plan | `https://api.kimi.com/coding/v1` | `kimi-for-coding` |

1. 打开 **设置(模型)**，在 **xAI Grok** 卡片上点击 **编辑**（卡片内联表单），填入 xAI API Key（[console.x.ai](https://console.x.ai/)）。
2. 若要改用其他厂商：在对应卡片点击 **设为当前**；**模型** 字段为自由文本，改完后 **保存** 即可。
3. 可选：环境变量 `LLM_API_KEY` 作为当前激活提供商无 Key 时的后备。

API Key 使用 Electron `safeStorage` 加密（系统支持时）；界面仅显示掩码。

### 日报记录保留

- 默认保留最近 **10** 天日报记录；应用启动与每次保存后自动清理更早记录。
- 在 **设置(模型) → 工作区与数据** 中可修改 **日报记录保留天数**（1–3650）。
- **增强历史** 仍按条数分页保留，未套用日报保留策略。

## 数据存放位置

SQLite 数据库：`app.getPath('userData')/prompt-forge.sqlite`

- Windows：`%APPDATA%\Prompt Forge\`
- macOS：`~/Library/Application Support/Prompt Forge/`
- Linux：`~/.config/Prompt Forge/`

## 开发

```bash
npm install
npm run dev
```

需本机已安装 **Git**（日报功能只读调用 `git` 子进程）。

```bash
npm test          # 单元测试
npm run build     # 编译主进程、预加载与渲染进程
```

## 打包安装程序

在对应系统上：

```bash
npm run dist        # 当前平台
npm run dist:win    # Windows NSIS .exe
npm run dist:mac    # macOS .dmg（universal）
npm run dist:linux  # Linux AppImage（便于 CI 验证）
```

CI：见 [`.github/workflows/desktop-build.yml`](.github/workflows/desktop-build.yml)，在 Windows / macOS 上构建并上传产物。

### macOS 未签名应用

首次打开若提示无法验证开发者： **系统设置 → 隐私与安全性** → 仍要打开；或对 `.app` 右键 **打开**。

## SQLite 库选型说明

使用 **better-sqlite3**：同步 API、性能好、与 Electron 打包成熟（`electron-builder install-app-deps` + `asarUnpack` 解压原生模块）。WASM 方案（如 sql.js）免原生编译但大文件与写入性能较弱，不适合频繁写入日报/历史场景。

## 测试用样例仓库

```bash
bash tests/fixtures/setup-sample-repo.sh
```

在 **多项目日报** 中将父目录设为 `tests/fixtures` 并发现 `sample-repo` 即可验证生成逻辑（需 Git）。

## 许可证

与原项目一致；请勿将真实 API Key 提交到 Git。
