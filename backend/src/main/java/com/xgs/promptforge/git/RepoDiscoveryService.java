package com.xgs.promptforge.git;

import com.xgs.promptforge.util.PathSafety;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

@Service
public class RepoDiscoveryService {

    private static final Set<String> SKIP_DIRS = Set.of("node_modules", ".git", "dist", "build", "target", ".idea", ".vscode");

    public record RepoInfo(String path, String name) {
    }

    public List<RepoInfo> discover(String parentFolderRaw, int scanDepth) {
        Path parent = PathSafety.requireAbsoluteDirectory(parentFolderRaw);
        int depth = Math.min(Math.max(scanDepth, 0), 2);
        Set<Path> found = new LinkedHashSet<>();
        collectRepos(parent, parent, depth, found);
        List<RepoInfo> list = new ArrayList<>();
        for (Path repo : found) {
            list.add(new RepoInfo(repo.toString(), PathSafety.repoName(repo)));
        }
        list.sort(Comparator.comparing(RepoInfo::name));
        return list;
    }

    private void collectRepos(Path root, Path current, int depthRemaining, Set<Path> out) {
        if (PathSafety.isGitRepo(current) && !current.equals(root)) {
            out.add(current.normalize().toAbsolutePath());
            return;
        }
        if (depthRemaining < 0) {
            return;
        }
        try (Stream<Path> children = Files.list(current)) {
            children.filter(Files::isDirectory)
                    .filter(p -> !SKIP_DIRS.contains(p.getFileName().toString()))
                    .sorted()
                    .forEach(child -> {
                        try {
                            if (PathSafety.isGitRepo(child)) {
                                out.add(child.normalize().toAbsolutePath());
                            } else if (depthRemaining > 0) {
                                collectRepos(root, child, depthRemaining - 1, out);
                            }
                        } catch (Exception ignored) {
                        }
                    });
        } catch (IOException ignored) {
        }
    }
}
