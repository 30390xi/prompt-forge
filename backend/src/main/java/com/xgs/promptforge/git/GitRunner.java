package com.xgs.promptforge.git;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * 只读执行 git 子命令。
 */
public final class GitRunner {

    private static final Duration DEFAULT_TIMEOUT = Duration.ofSeconds(60);

    private GitRunner() {
    }

    public static String run(Path repo, String... args) throws Exception {
        return run(repo, DEFAULT_TIMEOUT, args);
    }

    public static String run(Path repo, Duration timeout, String... args) throws Exception {
        List<String> command = new ArrayList<>();
        command.add("git");
        for (String arg : args) {
            command.add(arg);
        }
        ProcessBuilder pb = new ProcessBuilder(command);
        pb.directory(repo.toFile());
        pb.redirectErrorStream(true);
        Process process = pb.start();
        boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new IllegalStateException("git 命令超时");
        }
        String output;
        try (var reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                if (!sb.isEmpty()) {
                    sb.append('\n');
                }
                sb.append(line);
            }
            output = sb.toString();
        }
        if (process.exitValue() != 0) {
            throw new IllegalStateException(trimOutput(output));
        }
        return output;
    }

    private static String trimOutput(String text) {
        if (text == null) {
            return "";
        }
        String t = text.trim();
        return t.length() > 300 ? t.substring(0, 300) + "…" : t;
    }
}
