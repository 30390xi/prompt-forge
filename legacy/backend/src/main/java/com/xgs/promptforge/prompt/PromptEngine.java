package com.xgs.promptforge.prompt;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * 提示词增强引擎，逻辑移植自 dsh-prompt-forge。
 * systemPrompt 只有一句角色说明，完整指令通过 userPrompt 传入。
 */
public final class PromptEngine {

    private PromptEngine() {
    }

    public static final String WB_SYSTEM =
            "You are a prompt enhancement assistant. Improve the user prompt while preserving its intent and language.";

    public static final String WB_PROMPT = """
            You are a prompt enhancement assistant. Improve the user prompt while preserving its intent and language.

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
            """;

    public record StyleDef(String id, String name, String guide, boolean builtin) {
    }

    private static final Map<String, StyleDef> BUILTIN_STYLES = new LinkedHashMap<>();

    static {
        BUILTIN_STYLES.put("default", new StyleDef("default", "原版", "", true));
        BUILTIN_STYLES.put("expand", new StyleDef("expand", "扩充", """

                    ADDITIONAL STYLE - EXPAND:
                    Make the implicit explicit: state the goal, the expected deliverable, the constraints and the acceptance criteria the draft implies but leaves unstated.""", true));
        BUILTIN_STYLES.put("concise", new StyleDef("concise", "精简", """

                    ADDITIONAL STYLE - CONCISE:
                    Tighten the result. Remove filler, hedging and repetition, resolve vague pronouns, and make the request unmistakable. Do not add requirements.""", true));
        BUILTIN_STYLES.put("structured", new StyleDef("structured", "工程简报", """

                    ADDITIONAL STYLE - STRUCTURED:
                    Organize the result as a short engineering brief with the labeled sections 目标 / 交付物 / 约束 / 验收标准（omit a section the draft gives nothing for）.""", true));
    }

    public static final String DEFAULT_STYLE = "default";
    public static final int MAX_CUSTOM_STYLES = 12;

    private static final Pattern STYLE_ID = Pattern.compile("^[a-z][a-z0-9_-]{0,31}$");
    private static final Pattern QUOTE_EDGE = Pattern.compile("^[\"'“”‘’]|[\"'“”‘’]$");
    private static final Pattern CODE_FENCE = Pattern.compile("^```[a-zA-Z0-9_-]*\\n([\\s\\S]*?)\\n```$");
    private static final Pattern LABEL_LINE = Pattern.compile(
            "^(?:enhanced\\s+prompt|rewritten\\s+prompt|增强后的?提示词|优化后的?提示词)\\s*[:：]\\s*",
            Pattern.CASE_INSENSITIVE);

    public static Map<String, StyleDef> builtinStyles() {
        return BUILTIN_STYLES;
    }

    public static boolean isBuiltin(String id) {
        return BUILTIN_STYLES.containsKey(id);
    }

    public static boolean isValidStyleId(String id) {
        return id != null && STYLE_ID.matcher(id).matches();
    }

    public static String wrapCustomGuide(String id, String guide) {
        return "\n\n    ADDITIONAL STYLE - " + id.toUpperCase() + ":\n    " + guide.trim();
    }

    public static String buildUserMessage(String draft, String guide) {
        return WB_PROMPT.replace("{input}", draft) + (guide == null ? "" : guide);
    }

    public static final String DAILY_REPORT_SYSTEM =
            "You are an assistant that polishes Chinese daily work reports (日报) for software engineers. "
                    + "Preserve facts from the draft; do not invent tasks, time spent, risks, or tomorrow plans.";

    public static final String DAILY_REPORT_POLISH = """
            Rewrite the following daily work report draft into clearer, professional Chinese while keeping the exact section structure and titles:

            【日报】日期（星期）  作者：姓名
            一、今日完成
            二、进行中
            三、代码统计
            四、问题与风险
            五、明日计划

            RULES:
            1. Keep all factual commit hashes, counts, and file stats from the draft.
            2. One short sentence per numbered item (~40 Chinese characters); human wording, not raw commit spam.
            3. Do not invent time spent, new risks, or tomorrow plans; section 五 must remain 「（待补充）」 if the draft says so.
            4. If there were no commits, state that clearly.
            5. Return only the polished report text, no markdown fences or commentary.

            DRAFT:
            {input}
            """;

    public static String buildDailyReportPolishMessage(String draft, String guide) {
        return DAILY_REPORT_POLISH.replace("{input}", draft) + (guide == null ? "" : guide);
    }

    /**
     * 清理模型输出：去首尾引号、去代码围栏、去标签行。
     */
    public static String cleanPrompt(String text) {
        if (text == null) {
            return "";
        }
        String out = QUOTE_EDGE.matcher(text.trim()).replaceAll("");
        var fence = CODE_FENCE.matcher(out.trim());
        if (fence.matches()) {
            out = fence.group(1).trim();
        }
        out = LABEL_LINE.matcher(out).replaceFirst("");
        return out.trim();
    }
}
