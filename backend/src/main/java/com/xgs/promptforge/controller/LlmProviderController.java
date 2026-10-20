package com.xgs.promptforge.controller;

import com.xgs.promptforge.entity.LlmProvider;
import com.xgs.promptforge.service.LlmProviderService;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/llm")
public class LlmProviderController {

    private final LlmProviderService providerService;

    public LlmProviderController(LlmProviderService providerService) {
        this.providerService = providerService;
    }

    @GetMapping("/providers")
    public Map<String, Object> list() {
        return Map.of("ok", true, "providers", providerService.listMasked());
    }

    @PostMapping("/providers")
    public Map<String, Object> create(@RequestBody Map<String, Object> body) {
        return save(null, body);
    }

    @PutMapping("/providers/{id}")
    public Map<String, Object> update(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return save(id, body);
    }

    private Map<String, Object> save(Long id, Map<String, Object> body) {
        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            LlmProvider p = providerService.save(
                    id,
                    str(body.get("name")),
                    str(body.get("baseUrl")),
                    str(body.get("model")),
                    str(body.get("apiKey")),
                    body.get("active") instanceof Boolean b ? b : null);
            resp.put("ok", true);
            resp.put("provider", providerService.toView(p, true));
        } catch (Exception e) {
            resp.put("ok", false);
            resp.put("error", e.getMessage());
        }
        return resp;
    }

    @DeleteMapping("/providers/{id}")
    public Map<String, Object> delete(@PathVariable Long id) {
        providerService.delete(id);
        return Map.of("ok", true);
    }

    @PostMapping("/providers/{id}/activate")
    public Map<String, Object> activate(@PathVariable Long id) {
        providerService.activate(id);
        return Map.of("ok", true);
    }

    private static String str(Object o) {
        return o == null ? null : o.toString();
    }
}
