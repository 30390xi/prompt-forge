package com.xgs.promptforge.service;

import com.xgs.promptforge.entity.WorkspaceSettings;
import com.xgs.promptforge.repo.WorkspaceSettingsRepository;
import com.xgs.promptforge.util.PathSafety;
import org.springframework.stereotype.Service;

import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class WorkspaceSettingsService {

    private final WorkspaceSettingsRepository repository;

    public WorkspaceSettingsService(WorkspaceSettingsRepository repository) {
        this.repository = repository;
    }

    public WorkspaceSettings getOrCreate() {
        return repository.findById(WorkspaceSettings.SINGLETON_ID)
                .orElseGet(() -> {
                    WorkspaceSettings s = new WorkspaceSettings();
                    s.setId(WorkspaceSettings.SINGLETON_ID);
                    return repository.save(s);
                });
    }

    public Map<String, Object> toMap(WorkspaceSettings s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("parentFolder", s.getParentFolder());
        m.put("scanDepth", s.getScanDepth());
        m.put("timezone", s.getTimezone());
        m.put("authorOverride", s.getAuthorOverride());
        return m;
    }

    public WorkspaceSettings update(String parentFolder, Integer scanDepth, String timezone, String authorOverride) {
        WorkspaceSettings s = getOrCreate();
        if (parentFolder != null) {
            String trimmed = parentFolder.trim();
            if (!trimmed.isEmpty()) {
                PathSafety.requireAbsoluteDirectory(trimmed);
                s.setParentFolder(trimmed);
            } else {
                s.setParentFolder(null);
            }
        }
        if (scanDepth != null) {
            s.setScanDepth(Math.min(Math.max(scanDepth, 0), 2));
        }
        if (timezone != null && !timezone.isBlank()) {
            s.setTimezone(timezone.trim());
        }
        if (authorOverride != null) {
            s.setAuthorOverride(authorOverride.isBlank() ? null : authorOverride.trim());
        }
        return repository.save(s);
    }

    public Path requireScanRoot(String overrideParent) {
        String parent = overrideParent;
        if (parent == null || parent.isBlank()) {
            parent = getOrCreate().getParentFolder();
        }
        if (parent == null || parent.isBlank()) {
            throw new IllegalArgumentException("请先配置父目录路径");
        }
        return PathSafety.requireAbsoluteDirectory(parent);
    }
}
