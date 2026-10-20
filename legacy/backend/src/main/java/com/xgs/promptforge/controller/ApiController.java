package com.xgs.promptforge.controller;

import com.xgs.promptforge.entity.EnhanceHistory;
import com.xgs.promptforge.prompt.PromptEngine;
import com.xgs.promptforge.service.EnhanceService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class ApiController {

    private final EnhanceService enhanceService;

    public ApiController(EnhanceService enhanceService) {
        this.enhanceService = enhanceService;
    }

    @PostMapping("/enhance")
    public Map<String, Object> enhance(@RequestBody Map<String, String> body) {
        String draft = body.get("draft");
        String style = body.get("style");
        EnhanceService.EnhanceResult result = enhanceService.enhance(draft, style);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", result.ok());
        resp.put("style", result.style());
        if (result.ok()) {
            resp.put("prompt", result.prompt());
        } else {
            resp.put("error", result.error());
        }
        return resp;
    }

    @GetMapping("/styles")
    public Map<String, Object> styles() {
        List<Map<String, Object>> styles = enhanceService.styleList();
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", true);
        resp.put("styles", styles);
        resp.put("defaultStyle", PromptEngine.DEFAULT_STYLE);
        return resp;
    }

    @PostMapping("/styles")
    public Map<String, Object> addStyle(@RequestBody Map<String, String> body) {
        EnhanceService.StyleResult result = enhanceService.addCustomStyle(
                body.get("id"), body.get("name"), body.get("guide"));
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", result.ok());
        if (!result.ok()) {
            resp.put("error", result.error());
        }
        return resp;
    }

    @DeleteMapping("/styles/{id}")
    public Map<String, Object> deleteStyle(@PathVariable Long id) {
        enhanceService.deleteCustomStyle(id);
        return Map.of("ok", true);
    }

    @GetMapping("/history")
    public Map<String, Object> history(@RequestParam(defaultValue = "0") int page,
                                       @RequestParam(defaultValue = "10") int size) {
        Page<EnhanceHistory> data = enhanceService.history(page, size);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", true);
        resp.put("content", data.getContent());
        resp.put("page", data.getNumber());
        resp.put("totalPages", data.getTotalPages());
        resp.put("totalElements", data.getTotalElements());
        return resp;
    }

    @DeleteMapping("/history/{id}")
    public Map<String, Object> deleteHistory(@PathVariable Long id) {
        enhanceService.deleteHistory(id);
        return Map.of("ok", true);
    }
}
