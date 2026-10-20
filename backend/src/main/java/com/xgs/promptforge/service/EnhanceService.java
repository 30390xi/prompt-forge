package com.xgs.promptforge.service;

import com.xgs.promptforge.entity.CustomStyle;
import com.xgs.promptforge.entity.EnhanceHistory;
import com.xgs.promptforge.llm.LlmService;
import com.xgs.promptforge.prompt.PromptEngine;
import com.xgs.promptforge.repo.CustomStyleRepository;
import com.xgs.promptforge.repo.EnhanceHistoryRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class EnhanceService {

    private final LlmService llmService;
    private final EnhanceHistoryRepository historyRepository;
    private final CustomStyleRepository customStyleRepository;

    public EnhanceService(LlmService llmService,
                          EnhanceHistoryRepository historyRepository,
                          CustomStyleRepository customStyleRepository) {
        this.llmService = llmService;
        this.historyRepository = historyRepository;
        this.customStyleRepository = customStyleRepository;
    }

    public record EnhanceResult(boolean ok, String prompt, String error, String style) {
    }

    /**
     * 内置风格加自定义风格，自定义不允许覆盖内置。
     */
    public Map<String, PromptEngine.StyleDef> resolveStyles() {
        Map<String, PromptEngine.StyleDef> table = new LinkedHashMap<>(PromptEngine.builtinStyles());
        List<CustomStyle> customs = customStyleRepository.findAll(Sort.by(Sort.Direction.ASC, "id"));
        int count = 0;
        for (CustomStyle custom : customs) {
            if (count >= PromptEngine.MAX_CUSTOM_STYLES) {
                break;
            }
            String key = custom.getStyleKey();
            if (!PromptEngine.isValidStyleId(key) || PromptEngine.isBuiltin(key)) {
                continue;
            }
            String guide = custom.getGuide() == null ? "" : custom.getGuide().trim();
            if (guide.isEmpty()) {
                continue;
            }
            table.put(key, new PromptEngine.StyleDef(key, custom.getName(),
                    PromptEngine.wrapCustomGuide(key, guide), false));
            count++;
        }
        return table;
    }

    public EnhanceResult enhance(String draft, String style) {
        if (draft == null || draft.isBlank()) {
            return new EnhanceResult(false, null, "草稿为空，没有可增强的内容", style);
        }
        Map<String, PromptEngine.StyleDef> styles = resolveStyles();
        String normalized = styles.containsKey(style) ? style : PromptEngine.DEFAULT_STYLE;
        String guide = styles.get(normalized).guide();

        LlmService.LlmResult llmResult = llmService.chat(
                PromptEngine.WB_SYSTEM,
                PromptEngine.buildUserMessage(draft.trim(), guide));
        if (!llmResult.ok()) {
            return new EnhanceResult(false, null, llmResult.error(), normalized);
        }
        String prompt = PromptEngine.cleanPrompt(llmResult.content());
        if (prompt.isEmpty()) {
            return new EnhanceResult(false, null, "模型返回了空结果，请重试", normalized);
        }

        EnhanceHistory history = new EnhanceHistory();
        history.setDraft(draft.trim());
        history.setStyle(normalized);
        history.setResult(prompt);
        historyRepository.save(history);

        return new EnhanceResult(true, prompt, null, normalized);
    }

    public Page<EnhanceHistory> history(int page, int size) {
        int safeSize = Math.min(Math.max(size, 1), 50);
        return historyRepository.findAll(
                PageRequest.of(Math.max(page, 0), safeSize, Sort.by(Sort.Direction.DESC, "id")));
    }

    public void deleteHistory(Long id) {
        historyRepository.deleteById(id);
    }

    public record StyleResult(boolean ok, String error) {
    }

    public StyleResult addCustomStyle(String styleKey, String name, String guide) {
        if (!PromptEngine.isValidStyleId(styleKey)) {
            return new StyleResult(false, "风格标识只能是小写字母开头的字母、数字、中划线、下划线，最长 32 位");
        }
        if (PromptEngine.isBuiltin(styleKey)) {
            return new StyleResult(false, "不能覆盖内置风格");
        }
        if (guide == null || guide.isBlank()) {
            return new StyleResult(false, "风格指令不能为空");
        }
        if (guide.length() > 1000) {
            return new StyleResult(false, "风格指令不能超过 1000 字");
        }
        if (customStyleRepository.findByStyleKey(styleKey).isPresent()) {
            return new StyleResult(false, "该风格标识已存在");
        }
        if (customStyleRepository.count() >= PromptEngine.MAX_CUSTOM_STYLES) {
            return new StyleResult(false, "自定义风格最多 " + PromptEngine.MAX_CUSTOM_STYLES + " 个");
        }
        CustomStyle style = new CustomStyle();
        style.setStyleKey(styleKey);
        style.setName(name == null || name.isBlank() ? styleKey : name.trim());
        style.setGuide(guide.trim());
        customStyleRepository.save(style);
        return new StyleResult(true, null);
    }

    public void deleteCustomStyle(Long id) {
        customStyleRepository.deleteById(id);
    }

    public List<Map<String, Object>> styleList() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (PromptEngine.StyleDef def : resolveStyles().values()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("id", def.id());
            item.put("name", def.name());
            item.put("builtin", def.builtin());
            if (!def.builtin()) {
                customStyleRepository.findByStyleKey(def.id()).ifPresent(c -> {
                    item.put("dbId", c.getId());
                    item.put("guide", c.getGuide());
                });
            }
            list.add(item);
        }
        return list;
    }
}
