/**
 * 提示词增强引擎，逻辑移植自 Java PromptEngine（与 dsh-prompt-forge 一致）。
 */

export const WB_SYSTEM =
  'You are a prompt enhancement assistant. Improve the user prompt while preserving its intent and language.'

export const WB_PROMPT = `You are a prompt enhancement assistant. Improve the user prompt while preserving its intent and language.

USER INPUT:
{input}

TASK:
Rewrite the user input into a clearer, more specific prompt for the target AI assistant.

CRITICAL PRIORITY - LANGUAGE CONSISTENCY:
1. You MUST detect the language of the user input above and write the enhanced prompt in that same language.
2. If the user writes in Chinese, the enhanced prompt MUST be entirely in Chinese.
3. If the user writes in English, the enhanced prompt MUST be entirely in English.
4. If the user writes in any other language, the enhanced prompt MUST use that exact same language.
5. If the user mixes languages, keep a natural matching mix. Do not translate the user's intent into a single language.
6. These language rules are behavior instructions only; never include language analysis or language labels in the output.

ENHANCEMENT REQUIREMENTS:
1. Return only the enhanced prompt text; do not add explanations, prefaces, markdown fences, labels, or analysis.
2. Do not include language labels or meta notes such as "User input is in Chinese" or "Response must be in Chinese".
3. Preserve the user's original intent, topic, constraints, and target output type. Do not answer the request.
4. Always make a substantive enhancement when possible: clarify the task, scope, constraints, and expected output.
5. If the original prompt is already clear, lightly polish it instead of returning it unchanged.
6. Keep the enhanced prompt complete and concise. Do not end with an unfinished list, dangling conjunction, or trailing colon.
7. Do not add unrelated requirements, unsupported facts, or unnecessary sections.

EXAMPLES:
User input (Chinese): "请帮我解释这段代码的功能"
Enhanced prompt: "请解释这段代码的主要功能、执行流程和关键逻辑，并指出可能需要注意的边界情况。"

User input (English): "Please explain what this code does"
Enhanced prompt: "Explain what this code does, including its main purpose, key control flow, and any important edge cases."

User input (Mixed): "这段代码有 bug，can you help me fix it?"
Enhanced prompt: "请分析这段代码中的 bug，explain the root cause, and provide a minimal fix with necessary verification steps."

BAD OUTPUT EXAMPLE:
User input is in Chinese → Response must be in Chinese.
请解释这段代码的主要功能

GOOD OUTPUT EXAMPLE:
请解释这段代码的主要功能、执行流程和关键逻辑，并指出可能需要注意的边界情况。
`

export interface StyleDef {
  id: string
  name: string
  guide: string
  builtin: boolean
}

const BUILTIN_STYLES: Record<string, StyleDef> = {
  default: { id: 'default', name: '原版', guide: '', builtin: true },
  expand: {
    id: 'expand',
    name: '扩充',
    guide: `

    ADDITIONAL STYLE - EXPAND:
    Make the implicit explicit: state the goal, the expected deliverable, the constraints and the acceptance criteria the draft implies but leaves unstated.`,
    builtin: true
  },
  concise: {
    id: 'concise',
    name: '精简',
    guide: `

    ADDITIONAL STYLE - CONCISE:
    Tighten the result. Remove filler, hedging and repetition, resolve vague pronouns, and make the request unmistakable. Do not add requirements.`,
    builtin: true
  },
  structured: {
    id: 'structured',
    name: '工程简报',
    guide: `

    ADDITIONAL STYLE - STRUCTURED:
    Organize the result as a short engineering brief with the labeled sections 目标 / 交付物 / 约束 / 验收标准（omit a section the draft gives nothing for）.`,
    builtin: true
  }
}

export const DEFAULT_STYLE = 'default'
export const MAX_CUSTOM_STYLES = 12

const STYLE_ID = /^[a-z][a-z0-9_-]{0,31}$/
const QUOTE_EDGE = /^["'""'']|["'""'']$/
const CODE_FENCE = /^```[a-zA-Z0-9_-]*\n([\s\S]*?)\n```$/
const LABEL_LINE =
  /^(?:enhanced\s+prompt|rewritten\s+prompt|增强后的?提示词|优化后的?提示词)\s*[:：]\s*/i

export function builtinStyles(): Record<string, StyleDef> {
  return { ...BUILTIN_STYLES }
}

export function isBuiltin(id: string): boolean {
  return id in BUILTIN_STYLES
}

export function isValidStyleId(id: string | null | undefined): boolean {
  return id != null && STYLE_ID.test(id)
}

export function wrapCustomGuide(id: string, guide: string): string {
  return `\n\n    ADDITIONAL STYLE - ${id.toUpperCase()}:\n    ${guide.trim()}`
}

export function buildUserMessage(draft: string, guide: string | null): string {
  return WB_PROMPT.replace('{input}', draft) + (guide ?? '')
}

export const DAILY_REPORT_SYSTEM =
  'You are an assistant that polishes Chinese daily work reports (日报) for software engineers. ' +
  'Preserve project grouping, line numbering, work types, and status tags from the draft; do not invent deployment or test status.'

export const DAILY_REPORT_POLISH = `Rewrite the following daily work report draft into clearer, professional Chinese while keeping the exact structure:

【日报】日期（星期）  作者：姓名

【项目名】
1) 【类型】 任务内容 【状态标签】…
2) 【类型】 …

STRUCTURE RULES:
1. Keep the header line and every 【项目名】 section; keep 1) 2) numbering per project (restart at 1 for each project).
2. Each item MUST stay in the form: N) 【类型】 任务内容 【标签】… where 类型 is one of: 设计 | 需求 | 项目维护 | 开发 | bug修复 | 体验优化 | 测试
3. Status tags (only if already present in the draft — never add new ones): 设计完成 | 开发完成 | 已部署 | 已自测 | 未部署 | 未完成 | optional 【80%】 style ratio only if the draft already has it.
4. Polish only the 任务内容 wording (~40 Chinese characters); do NOT change 【类型】 or status tags unless the draft clearly mislabeled a fact.
5. Do not invent 已部署, 已自测, progress ratios, or extra projects/items; do not remove projects or items.
6. Return only the polished report text, no markdown fences or commentary.

DRAFT:
{input}
`

export function buildDailyReportPolishMessage(draft: string, guide: string | null): string {
  return DAILY_REPORT_POLISH.replace('{input}', draft) + (guide ?? '')
}

export function cleanPrompt(text: string | null | undefined): string {
  if (text == null) return ''
  let out = text.trim().replace(QUOTE_EDGE, '')
  const fence = CODE_FENCE.exec(out.trim())
  if (fence) {
    out = fence[1].trim()
  }
  out = out.replace(LABEL_LINE, '')
  return out.trim()
}
