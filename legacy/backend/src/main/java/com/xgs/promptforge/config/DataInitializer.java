package com.xgs.promptforge.config;

import com.xgs.promptforge.service.LlmProviderService;
import com.xgs.promptforge.service.WorkspaceSettingsService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements ApplicationRunner {

    private final LlmProviderService llmProviderService;
    private final WorkspaceSettingsService workspaceSettingsService;

    public DataInitializer(LlmProviderService llmProviderService, WorkspaceSettingsService workspaceSettingsService) {
        this.llmProviderService = llmProviderService;
        this.workspaceSettingsService = workspaceSettingsService;
    }

    @Override
    public void run(ApplicationArguments args) {
        llmProviderService.ensurePresets();
        workspaceSettingsService.getOrCreate();
    }
}
