# Prompt Forge

把随手写的草稿一键改写为结构完整的提示词，并支持扫描本地多个 Git 仓库生成固定格式的工作日报。

技术栈：Vue 3 + Vite 前端，Spring Boot 3 + MySQL 后端。

## 功能

### 提示词增强（原有）

- 一键增强草稿，支持原版 / 扩充 / 精简 / 工程简报等内置风格
- 自定义风格、增强历史、可取消请求

### 多项目日报（新增）

- 配置本地**父目录**（绝对路径），按深度发现子目录中的 Git 仓库
- 选择日期（默认今天，按 `Asia/Shanghai` 或设置中的时区统计 00:00–24:00）
- 聚合各仓库当日提交与未提交改动，生成固定模板日报
- 可选用提示词增强管线对日报进行润色（不编造明日计划与风险）
- 复制或导出 `.txt`

### 设置（模型）

- 管理多个 OpenAI 兼容提供商（名称、Base URL、模型、API Key）
- 内置预设：DeepSeek、GLM Coding Plan（智谱）、Kimi Coding Plan（Moonshot）
- 选择「当前使用」的提供商驱动提示词增强与日报润色
- 密钥存本地数据库，界面仅显示掩码；可用环境变量 `LLM_API_KEY` 作为后备

## 启动前准备

1. **MySQL**：创建数据库

```sql
CREATE DATABASE IF NOT EXISTS prompt_forge DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

在 `backend/src/main/resources/application.yml` 中配置 `spring.datasource` 账号密码。

2. **模型 Key**（任选其一）

- 打开前端 **设置(模型)**，编辑预设并填入 API Key，点击「设为当前」
- 或设置环境变量：`export LLM_API_KEY=你的密钥`
- 或在 `application.yml` 的 `llm.api-key` 填写（不推荐提交到 Git）

### 多项目日报：父目录配置

1. 启动前后端后，进入 **多项目日报**
2. 在「父目录」填入本机绝对路径，例如 `/Users/xgs/work`（macOS/Linux）或 `C:\work`（Windows）
3. 可点击 **浏览** 在服务器本机目录树中选择（后端运行在哪台机器，就浏览那台机器的磁盘）
4. 点击 **保存**，再 **发现仓库**，勾选仓库后 **一键生成**

> 后端仅执行只读 `git` 命令，不会修改你的仓库。扫描路径必须在已保存的父目录之下，防止路径穿越。

### 提供商预设参考

| 名称 | Base URL | 模型示例 |
| --- | --- | --- |
| DeepSeek | `https://api.deepseek.com` | `deepseek-chat` |
| GLM Coding Plan | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-flash` 或 Coding Plan 文档中的模型名 |
| Kimi Coding Plan | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` 或套餐对应模型 |

请以各厂商最新文档为准更新模型名。

## 启动

后端：

```bash
cd backend
mvn package -DskipTests
java -jar target/prompt-forge-1.0.0.jar
```

前端：

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 http://localhost:4321（开发模式通过 Vite 代理访问 `http://localhost:8080` 的 API）。

## 主要 API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/enhance` | 增强草稿 |
| GET/POST/DELETE | `/api/styles` | 风格管理 |
| GET/PUT | `/api/settings/workspace` | 父目录、扫描深度、时区、作者覆盖 |
| POST | `/api/repos/scan` | 发现 Git 仓库 |
| POST | `/api/daily-report/generate` | 生成日报 |
| POST | `/api/daily-report/polish` | 润色日报 |
| GET | `/api/fs/list` | 浏览本机目录（配置父目录） |
| GET/POST/PUT/DELETE | `/api/llm/providers` | 模型提供商 CRUD |
| POST | `/api/llm/providers/{id}/activate` | 设为当前提供商 |

## 日报模板说明

生成结果包含：**今日完成**（按仓库分组）、**进行中**（未提交 diff 统计）、**代码统计**、**问题与风险**（从 revert/fix/hotfix 等推断）、**明日计划**（固定为「待补充」）。无提交时会明确说明。
