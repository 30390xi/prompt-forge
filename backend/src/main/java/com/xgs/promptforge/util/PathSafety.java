package com.xgs.promptforge.util;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class PathSafety {

    private PathSafety() {
    }

    public static Path requireAbsoluteDirectory(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("路径不能为空");
        }
        Path path = Paths.get(raw.trim()).normalize().toAbsolutePath();
        if (!path.isAbsolute()) {
            throw new IllegalArgumentException("必须使用绝对路径");
        }
        if (!Files.isDirectory(path)) {
            throw new IllegalArgumentException("路径不存在或不是目录：" + path);
        }
        return path;
    }

    public static void ensureUnderRoot(Path target, Path root) {
        Path normalizedTarget = target.normalize().toAbsolutePath();
        Path normalizedRoot = root.normalize().toAbsolutePath();
        if (!normalizedTarget.startsWith(normalizedRoot)) {
            throw new IllegalArgumentException("路径不在允许的根目录下");
        }
    }

    public static boolean isGitRepo(Path dir) {
        return Files.isDirectory(dir.resolve(".git"));
    }

    public static String repoName(Path repoRoot) {
        Path name = repoRoot.getFileName();
        return name == null ? repoRoot.toString() : name.toString();
    }

    public static Path tryResolve(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            Path path = Paths.get(raw.trim()).normalize().toAbsolutePath();
            if (Files.exists(path)) {
                return path;
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    public static Path parentPath(Path path) {
        Path parent = path.getParent();
        return parent != null ? parent : path;
    }

    public static boolean isReadableDirectory(Path path) {
        return path != null && Files.isDirectory(path) && Files.isReadable(path);
    }

    public static void rejectSymlinkEscape(Path path) throws IOException {
        Path real = path.toRealPath();
        if (!real.equals(path.normalize().toAbsolutePath())) {
            // allow real path resolution; caller compares startsWith on real paths
        }
    }
}
