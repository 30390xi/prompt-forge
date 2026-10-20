package com.xgs.promptforge.git;

import com.xgs.promptforge.util.PathSafety;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class GitCollectService {

    private static final Pattern CONVENTIONAL = Pattern.compile("^(?:(?:feat|fix|refactor|docs|test|chore)(?:\\([^)]+\\))?!?:\\s*)?(.+)$", Pattern.CASE_INSENSITIVE);
    private static final Pattern SHORTSTAT = Pattern.compile("(\\d+) files? changed(?:, (\\d+) insertions?\\(\\+\\))?(?:, (\\d+) deletions?\\(-\\))?");

    public record CommitItem(String hash, String shortHash, String subject, String typeLabel, int filesChanged, int insertions, int deletions) {
    }

    public record InProgress(String summary, int fileCount, int insertions, int deletions) {
    }

    public record RepoDayData(String repoPath, String repoName, String author, List<CommitItem> commits, InProgress inProgress,
                              int totalCommits, int totalFiles, int totalInsertions, int totalDeletions) {
    }

    public RepoDayData collectRepo(Path repoPath, Path scanRoot, String author, LocalDate date, ZoneId zone) {
        PathSafety.ensureUnderRoot(repoPath, scanRoot);
        String resolvedAuthor = author;
        if (resolvedAuthor == null || resolvedAuthor.isBlank()) {
            try {
                resolvedAuthor = GitRunner.run(repoPath, "config", "user.name").trim();
            } catch (Exception e) {
                resolvedAuthor = "未知";
            }
        }
        ZonedDateTime start = date.atStartOfDay(zone);
        ZonedDateTime end = date.plusDays(1).atStartOfDay(zone);
        String since = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(start);
        String until = DateTimeFormatter.ISO_OFFSET_DATE_TIME.format(end);

        List<CommitItem> commits = new ArrayList<>();
        int totalFiles = 0;
        int totalInsertions = 0;
        int totalDeletions = 0;

        try {
            String log = GitRunner.run(repoPath,
                    "log", "--all",
                    "--author=" + resolvedAuthor,
                    "--since=" + since,
                    "--until=" + until,
                    "--no-merges",
                    "--pretty=format:@@@%H@@@%s",
                    "--shortstat");
            commits = parseLog(log);
            for (CommitItem c : commits) {
                totalFiles += c.filesChanged();
                totalInsertions += c.insertions();
                totalDeletions += c.deletions();
            }
        } catch (Exception ignored) {
        }

        InProgress inProgress = readInProgress(repoPath);
        return new RepoDayData(
                repoPath.toString(),
                PathSafety.repoName(repoPath),
                resolvedAuthor,
                commits,
                inProgress,
                commits.size(),
                totalFiles,
                totalInsertions,
                totalDeletions
        );
    }

    private InProgress readInProgress(Path repo) {
        try {
            String status = GitRunner.run(repo, "status", "--short");
            int fileCount = 0;
            if (!status.isBlank()) {
                fileCount = (int) status.lines().filter(l -> !l.isBlank()).count();
            }
            int ins = 0;
            int del = 0;
            if (fileCount > 0) {
                String stat = GitRunner.run(repo, "diff", "--stat");
                Matcher m = SHORTSTAT.matcher(stat);
                if (m.find()) {
                    ins = parseInt(m.group(2));
                    del = parseInt(m.group(3));
                }
            }
            String summary = fileCount == 0 ? "" : summarizeStatus(status);
            return new InProgress(summary, fileCount, ins, del);
        } catch (Exception e) {
            return new InProgress("", 0, 0, 0);
        }
    }

    private String summarizeStatus(String status) {
        String first = status.lines().filter(l -> !l.isBlank()).findFirst().orElse("").trim();
        if (first.length() > 40) {
            return first.substring(0, 37) + "…";
        }
        return first.isEmpty() ? "有未提交改动" : "工作区有未提交改动";
    }

    private List<CommitItem> parseLog(String raw) {
        List<CommitItem> list = new ArrayList<>();
        if (raw == null || raw.isBlank()) {
            return list;
        }
        String[] blocks = raw.split("@@@");
        for (int i = 1; i < blocks.length; i++) {
            String block = blocks[i];
            int nl = block.indexOf('\n');
            if (nl < 0) {
                continue;
            }
            String header = block.substring(0, nl);
            int sep = header.indexOf("@@@");
            if (sep < 0) {
                continue;
            }
            String hash = header.substring(0, sep);
            String subject = header.substring(sep + 3).trim();
            String rest = block.substring(nl + 1);
            int files = 0;
            int ins = 0;
            int del = 0;
            Matcher m = SHORTSTAT.matcher(rest);
            if (m.find()) {
                files = parseInt(m.group(1));
                ins = parseInt(m.group(2));
                del = parseInt(m.group(3));
            }
            String type = classifyType(subject);
            String human = humanizeSubject(subject);
            list.add(new CommitItem(hash, hash.length() >= 7 ? hash.substring(0, 7) : hash, human, type, files, ins, del));
        }
        return list;
    }

    private int parseInt(String g) {
        if (g == null || g.isBlank()) {
            return 0;
        }
        try {
            return Integer.parseInt(g);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    static String classifyType(String subject) {
        String lower = subject.toLowerCase(Locale.ROOT);
        if (lower.startsWith("feat")) {
            return "新功能";
        }
        if (lower.startsWith("fix")) {
            return "修复";
        }
        if (lower.startsWith("refactor")) {
            return "重构";
        }
        if (lower.startsWith("docs")) {
            return "文档";
        }
        if (lower.startsWith("test")) {
            return "测试";
        }
        if (lower.startsWith("chore")) {
            return "杂项";
        }
        if (lower.contains("revert")) {
            return "修复";
        }
        return "杂项";
    }

    static String humanizeSubject(String subject) {
        Matcher m = CONVENTIONAL.matcher(subject.trim());
        String core = m.matches() ? m.group(1).trim() : subject.trim();
        if (core.length() > 40) {
            core = core.substring(0, 37) + "…";
        }
        return core.isEmpty() ? "代码更新" : core;
    }
}
