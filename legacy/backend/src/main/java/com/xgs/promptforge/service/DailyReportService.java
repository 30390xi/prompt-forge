package com.xgs.promptforge.service;

import com.xgs.promptforge.git.GitCollectService;
import com.xgs.promptforge.git.RepoDiscoveryService;
import com.xgs.promptforge.llm.LlmService;
import com.xgs.promptforge.prompt.PromptEngine;
import com.xgs.promptforge.util.PathSafety;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

@Service
public class DailyReportService {

    private final WorkspaceSettingsService settingsService;
    private final RepoDiscoveryService discoveryService;
    private final GitCollectService gitCollectService;
    private final LlmService llmService;
    private final EnhanceService enhanceService;

    public DailyReportService(WorkspaceSettingsService settingsService,
                              RepoDiscoveryService discoveryService,
                              GitCollectService gitCollectService,
                              LlmService llmService,
                              EnhanceService enhanceService) {
        this.settingsService = settingsService;
        this.discoveryService = discoveryService;
        this.gitCollectService = gitCollectService;
        this.llmService = llmService;
        this.enhanceService = enhanceService;
    }

    public record GenerateResult(boolean ok, String report, String error, List<GitCollectService.RepoDayData> repos) {
    }

    public GenerateResult generate(LocalDate date, String parentFolder, List<String> repoPaths, String authorOverride) {
        try {
            if (date == null) {
                date = LocalDate.now(ZoneId.of(settingsService.getOrCreate().getTimezone()));
            }
            Path root = settingsService.requireScanRoot(parentFolder);
            var settings = settingsService.getOrCreate();
            ZoneId zone = ZoneId.of(settings.getTimezone());
            String author = authorOverride != null && !authorOverride.isBlank()
                    ? authorOverride
                    : settings.getAuthorOverride();

            List<Path> repos;
            if (repoPaths != null && !repoPaths.isEmpty()) {
                repos = new ArrayList<>();
                for (String raw : repoPaths) {
                    Path p = PathSafety.requireAbsoluteDirectory(raw);
                    PathSafety.ensureUnderRoot(p, root);
                    if (!PathSafety.isGitRepo(p)) {
                        throw new IllegalArgumentException("不是 Git 仓库：" + p);
                    }
                    repos.add(p);
                }
            } else {
                repos = discoveryService.discover(root.toString(), settings.getScanDepth())
                        .stream()
                        .map(r -> Path.of(r.path()))
                        .toList();
            }

            List<GitCollectService.RepoDayData> data = new ArrayList<>();
            for (Path repo : repos) {
                data.add(gitCollectService.collectRepo(repo, root, author, date, zone));
            }
            String authorDisplay = DailyReportFormatter.displayAuthor(data, author);
            String report = DailyReportFormatter.format(date, authorDisplay, data);
            return new GenerateResult(true, report, null, data);
        } catch (Exception e) {
            return new GenerateResult(false, null, e.getMessage(), List.of());
        }
    }

    public EnhanceService.EnhanceResult polish(String draft, String style) {
        if (draft == null || draft.isBlank()) {
            return new EnhanceService.EnhanceResult(false, null, "日报内容为空", style);
        }
        var styles = enhanceService.resolveStyles();
        String normalized = styles.containsKey(style) ? style : PromptEngine.DEFAULT_STYLE;
        String guide = styles.get(normalized).guide();

        LlmService.LlmResult llmResult = llmService.chat(
                PromptEngine.DAILY_REPORT_SYSTEM,
                PromptEngine.buildDailyReportPolishMessage(draft.trim(), guide));
        if (!llmResult.ok()) {
            return new EnhanceService.EnhanceResult(false, null, llmResult.error(), normalized);
        }
        String out = PromptEngine.cleanPrompt(llmResult.content());
        if (out.isEmpty()) {
            return new EnhanceService.EnhanceResult(false, null, "模型返回了空结果", normalized);
        }
        return new EnhanceService.EnhanceResult(true, out, null, normalized);
    }
}
