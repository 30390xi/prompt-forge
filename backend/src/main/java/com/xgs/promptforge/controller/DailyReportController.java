package com.xgs.promptforge.controller;

import com.xgs.promptforge.git.RepoDiscoveryService;
import com.xgs.promptforge.service.DailyReportService;
import com.xgs.promptforge.service.EnhanceService;
import com.xgs.promptforge.service.WorkspaceSettingsService;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
public class DailyReportController {

    private final DailyReportService dailyReportService;
    private final RepoDiscoveryService discoveryService;
    private final WorkspaceSettingsService settingsService;

    public DailyReportController(DailyReportService dailyReportService,
                                 RepoDiscoveryService discoveryService,
                                 WorkspaceSettingsService settingsService) {
        this.dailyReportService = dailyReportService;
        this.discoveryService = discoveryService;
        this.settingsService = settingsService;
    }

    @PostMapping("/repos/scan")
    public Map<String, Object> scanRepos(@RequestBody Map<String, Object> body) {
        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            String parent = stringVal(body.get("parentFolder"));
            Integer depth = body.get("scanDepth") instanceof Number n ? n.intValue() : null;
            var settings = settingsService.getOrCreate();
            if (parent == null || parent.isBlank()) {
                parent = settings.getParentFolder();
            }
            int scanDepth = depth != null ? depth : settings.getScanDepth();
            var repos = discoveryService.discover(parent, scanDepth);
            resp.put("ok", true);
            resp.put("repos", repos);
        } catch (Exception e) {
            resp.put("ok", false);
            resp.put("error", e.getMessage());
        }
        return resp;
    }

    @PostMapping("/daily-report/generate")
    public Map<String, Object> generate(@RequestBody Map<String, Object> body) {
        String dateStr = stringVal(body.get("date"));
        LocalDate date = dateStr == null || dateStr.isBlank() ? null : LocalDate.parse(dateStr);
        String parent = stringVal(body.get("parentFolder"));
        String author = stringVal(body.get("author"));
        @SuppressWarnings("unchecked")
        List<String> repos = body.get("repos") instanceof List<?> list
                ? list.stream().map(Object::toString).toList()
                : null;

        DailyReportService.GenerateResult result = dailyReportService.generate(date, parent, repos, author);
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", result.ok());
        if (result.ok()) {
            resp.put("report", result.report());
        } else {
            resp.put("error", result.error());
        }
        return resp;
    }

    @PostMapping("/daily-report/polish")
    public Map<String, Object> polish(@RequestBody Map<String, String> body) {
        EnhanceService.EnhanceResult result = dailyReportService.polish(body.get("draft"), body.get("style"));
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("ok", result.ok());
        resp.put("style", result.style());
        if (result.ok()) {
            resp.put("report", result.prompt());
        } else {
            resp.put("error", result.error());
        }
        return resp;
    }

    @GetMapping("/settings/workspace")
    public Map<String, Object> getSettings() {
        return Map.of("ok", true, "settings", settingsService.toMap(settingsService.getOrCreate()));
    }

    @PutMapping("/settings/workspace")
    public Map<String, Object> putSettings(@RequestBody Map<String, Object> body) {
        Map<String, Object> resp = new LinkedHashMap<>();
        try {
            Integer depth = body.get("scanDepth") instanceof Number n ? n.intValue() : null;
            var updated = settingsService.update(
                    stringVal(body.get("parentFolder")),
                    depth,
                    stringVal(body.get("timezone")),
                    stringVal(body.get("authorOverride")));
            resp.put("ok", true);
            resp.put("settings", settingsService.toMap(updated));
        } catch (Exception e) {
            resp.put("ok", false);
            resp.put("error", e.getMessage());
        }
        return resp;
    }

    private static String stringVal(Object o) {
        return o == null ? null : o.toString();
    }
}
