package com.xgs.promptforge.service;

import com.xgs.promptforge.git.GitCollectService;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

public final class DailyReportFormatter {

    private static final String[] WEEKDAY_ZH = {"星期一", "星期二", "星期三", "星期四", "星期五", "星期六", "星期日"};

    private DailyReportFormatter() {
    }

    public static String format(LocalDate date, String authorDisplay, List<GitCollectService.RepoDayData> repos) {
        String weekday = WEEKDAY_ZH[date.getDayOfWeek().getValue() - 1];
        StringBuilder sb = new StringBuilder();
        sb.append("【日报】").append(date).append("（").append(weekday).append("）  作者：").append(authorDisplay).append("\n\n");

        sb.append("一、今日完成\n");
        boolean anyCommit = false;
        int itemIndex = 1;
        for (GitCollectService.RepoDayData repo : repos) {
            if (repo.commits().isEmpty()) {
                continue;
            }
            anyCommit = true;
            if (repos.size() > 1) {
                sb.append("【").append(repo.repoName()).append("】\n");
            }
            for (GitCollectService.CommitItem c : repo.commits()) {
                sb.append(itemIndex++).append(". [").append(c.typeLabel()).append("] ")
                        .append(c.subject()).append("  ——  ").append(c.shortHash()).append("\n");
            }
        }
        if (!anyCommit) {
            sb.append("今日所选仓库无提交记录。\n");
        }

        sb.append("\n二、进行中\n");
        boolean anyWip = false;
        int wipIndex = 1;
        for (GitCollectService.RepoDayData repo : repos) {
            if (repo.inProgress().fileCount() <= 0) {
                continue;
            }
            anyWip = true;
            String prefix = repos.size() > 1 ? "（" + repo.repoName() + "）" : "";
            sb.append(wipIndex++).append(". ").append(prefix)
                    .append(repo.inProgress().summary().isBlank() ? "未提交改动" : repo.inProgress().summary())
                    .append("（未提交改动：").append(repo.inProgress().fileCount()).append(" 个文件，+")
                    .append(repo.inProgress().insertions()).append("/-").append(repo.inProgress().deletions()).append("）\n");
        }
        if (!anyWip) {
            sb.append("无\n");
        }

        int commits = 0;
        int files = 0;
        int ins = 0;
        int del = 0;
        for (GitCollectService.RepoDayData repo : repos) {
            commits += repo.totalCommits();
            files += repo.totalFiles();
            ins += repo.totalInsertions();
            del += repo.totalDeletions();
        }
        sb.append("\n三、代码统计\n");
        sb.append("提交 ").append(commits).append(" 次｜修改文件 ").append(files)
                .append(" 个｜新增 +").append(ins).append(" 行｜删除 -").append(del).append(" 行\n");

        sb.append("\n四、问题与风险\n");
        List<String> risks = inferRisks(repos);
        if (risks.isEmpty()) {
            sb.append("无\n");
        } else {
            for (int i = 0; i < risks.size(); i++) {
                sb.append(i + 1).append(". ").append(risks.get(i)).append("\n");
            }
        }

        sb.append("\n五、明日计划\n");
        sb.append("（待补充）\n");
        return sb.toString().trim() + "\n";
    }

    private static List<String> inferRisks(List<GitCollectService.RepoDayData> repos) {
        List<String> risks = new ArrayList<>();
        for (GitCollectService.RepoDayData repo : repos) {
            for (GitCollectService.CommitItem c : repo.commits()) {
                String lower = c.subject().toLowerCase(Locale.ROOT);
                if (lower.contains("revert") || lower.contains("hotfix") || lower.startsWith("fix")) {
                    String line = "[" + repo.repoName() + "] " + c.subject();
                    if (line.length() > 48) {
                        line = line.substring(0, 45) + "…";
                    }
                    risks.add(line);
                }
            }
        }
        return risks;
    }

    public static String displayAuthor(List<GitCollectService.RepoDayData> repos, String override) {
        if (override != null && !override.isBlank()) {
            return override.trim();
        }
        return repos.stream().map(GitCollectService.RepoDayData::author).filter(a -> a != null && !a.isBlank())
                .findFirst().orElse("未知");
    }
}
