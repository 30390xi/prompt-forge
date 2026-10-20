package com.xgs.promptforge.llm;

public record LlmProviderConfig(String baseUrl, String apiKey, String model, long timeoutSeconds) {
}
