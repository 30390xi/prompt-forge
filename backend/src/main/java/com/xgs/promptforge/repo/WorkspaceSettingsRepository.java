package com.xgs.promptforge.repo;

import com.xgs.promptforge.entity.WorkspaceSettings;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkspaceSettingsRepository extends JpaRepository<WorkspaceSettings, Long> {
}
