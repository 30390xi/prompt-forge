package com.xgs.promptforge.service;

import com.xgs.promptforge.entity.LlmProvider;
import com.xgs.promptforge.llm.LlmProviderConfig;
import com.xgs.promptforge.repo.LlmProviderRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class LlmProviderService {

    private final LlmProviderRepository repository;

    @Value("${llm.base-url}")
    private String fallbackBaseUrl;

    @Value("${llm.api-key:}")
    private String fallbackApiKey;

    @Value("${llm.model}")
    private String fallbackModel;

    @Value("${llm.timeout-seconds:120}")
    private long timeoutSeconds;

    public LlmProviderService(LlmProviderRepository repository) {
        this.repository = repository;
    }

    public LlmProviderConfig resolveActiveConfig() {
        Optional<LlmProvider> active = repository.findByActiveTrue();
        if (active.isPresent()) {
            LlmProvider p = active.get();
            String key = p.getApiKey();
            if (key == null || key.isBlank()) {
                key = envApiKey();
            }
            return new LlmProviderConfig(trimSlash(p.getBaseUrl()), key, p.getModel(), timeoutSeconds);
        }
        String key = fallbackApiKey;
        if (key == null || key.isBlank()) {
            key = envApiKey();
        }
        return new LlmProviderConfig(trimSlash(fallbackBaseUrl), key, fallbackModel, timeoutSeconds);
    }

    private static String envApiKey() {
        String env = System.getenv("LLM_API_KEY");
        return env == null ? "" : env.trim();
    }

    private static String trimSlash(String url) {
        if (url == null) {
            return "";
        }
        String u = url.trim();
        while (u.endsWith("/")) {
            u = u.substring(0, u.length() - 1);
        }
        return u;
    }

    public List<Map<String, Object>> listMasked() {
        List<Map<String, Object>> out = new ArrayList<>();
        for (LlmProvider p : repository.findAllByOrderByIdAsc()) {
            out.add(toView(p, true));
        }
        return out;
    }

    public Map<String, Object> toView(LlmProvider p, boolean maskKey) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", p.getId());
        m.put("presetKey", p.getPresetKey());
        m.put("name", p.getName());
        m.put("baseUrl", p.getBaseUrl());
        m.put("model", p.getModel());
        m.put("active", p.isActive());
        m.put("hasApiKey", p.getApiKey() != null && !p.getApiKey().isBlank());
        m.put("apiKeyMasked", maskKey ? mask(p.getApiKey()) : p.getApiKey());
        return m;
    }

    public static String mask(String key) {
        if (key == null || key.isBlank()) {
            return "";
        }
        if (key.length() <= 8) {
            return "****";
        }
        return key.substring(0, 4) + "…" + key.substring(key.length() - 4);
    }

    @Transactional
    public LlmProvider save(Long id, String name, String baseUrl, String model, String apiKey, Boolean active) {
        LlmProvider p = id == null ? new LlmProvider() : repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("提供商不存在"));
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("名称不能为空");
        }
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("Base URL 不能为空");
        }
        if (model == null || model.isBlank()) {
            throw new IllegalArgumentException("模型不能为空");
        }
        p.setName(name.trim());
        p.setBaseUrl(baseUrl.trim());
        p.setModel(model.trim());
        if (apiKey != null && !apiKey.isBlank()) {
            p.setApiKey(apiKey.trim());
        }
        repository.save(p);
        if (Boolean.TRUE.equals(active)) {
            activate(p.getId());
        }
        return p;
    }

    @Transactional
    public void delete(Long id) {
        repository.deleteById(id);
        if (repository.findByActiveTrue().isEmpty() && repository.count() > 0) {
            LlmProvider first = repository.findAllByOrderByIdAsc().get(0);
            first.setActive(true);
            repository.save(first);
        }
    }

    @Transactional
    public void activate(Long id) {
        for (LlmProvider p : repository.findAll()) {
            p.setActive(p.getId().equals(id));
            repository.save(p);
        }
    }

    public void ensurePresets() {
        seed("deepseek", "DeepSeek", "https://api.deepseek.com", "deepseek-chat", true);
        seed("glm", "GLM Coding Plan", "https://open.bigmodel.cn/api/paas/v4", "glm-4-flash", false);
        seed("kimi", "Kimi Coding Plan", "https://api.moonshot.cn/v1", "moonshot-v1-8k", false);
        if (repository.findByActiveTrue().isEmpty() && repository.count() > 0) {
            repository.findByPresetKey("deepseek").ifPresent(p -> {
                p.setActive(true);
                repository.save(p);
            });
        }
    }

    private void seed(String key, String name, String baseUrl, String model, boolean activeIfFirst) {
        if (repository.findByPresetKey(key).isPresent()) {
            return;
        }
        LlmProvider p = new LlmProvider();
        p.setPresetKey(key);
        p.setName(name);
        p.setBaseUrl(baseUrl);
        p.setModel(model);
        p.setApiKey("");
        p.setActive(activeIfFirst && repository.count() == 0);
        repository.save(p);
    }
}
