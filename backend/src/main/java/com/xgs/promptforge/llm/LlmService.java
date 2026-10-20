package com.xgs.promptforge.llm;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.xgs.promptforge.service.LlmProviderService;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 调用 OpenAI 兼容的 chat/completions 接口。
 */
@Service
public class LlmService {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private final LlmProviderService providerService;

    public LlmService(LlmProviderService providerService) {
        this.providerService = providerService;
    }

    public record LlmResult(boolean ok, String content, String error) {
    }

    public LlmResult chat(String system, String user) {
        LlmProviderConfig config = providerService.resolveActiveConfig();
        if (config.apiKey() == null || config.apiKey().isBlank()) {
            return new LlmResult(false, null, "尚未配置模型 API Key，请在「设置(模型)」中添加或在环境变量 LLM_API_KEY 中设置");
        }
        try {
            Map<String, Object> payload = Map.of(
                    "model", config.model(),
                    "temperature", 0.3,
                    "max_tokens", 4096,
                    "messages", List.of(
                            Map.of("role", "system", "content", system),
                            Map.of("role", "user", "content", user)
                    )
            );
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(config.baseUrl() + "/chat/completions"))
                    .timeout(Duration.ofSeconds(config.timeoutSeconds()))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + config.apiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload)))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return new LlmResult(false, null, mapHttpError(response.statusCode(), response.body()));
            }
            JsonNode root = objectMapper.readTree(response.body());
            JsonNode content = root.path("choices").path(0).path("message").path("content");
            if (!content.isTextual()) {
                return new LlmResult(false, null, "模型返回了空结果，请重试");
            }
            return new LlmResult(true, content.asText(), null);
        } catch (java.net.http.HttpTimeoutException e) {
            return new LlmResult(false, null, "模型请求超时，请重试");
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new LlmResult(false, null, "请求被中断");
        } catch (Exception e) {
            return new LlmResult(false, null, "模型调用异常：" + e.getMessage());
        }
    }

    private String mapHttpError(int status, String body) {
        return switch (status) {
            case 400 -> "请求参数错误：" + brief(body);
            case 401, 403 -> "认证失败，请检查 API Key 是否正确";
            case 404 -> "接口地址不存在，请检查 llm.base-url 配置";
            case 429 -> "请求过于频繁或额度耗尽，稍后重试";
            default -> "模型调用失败，HTTP " + status + "：" + brief(body);
        };
    }

    private String brief(String body) {
        if (body == null) {
            return "";
        }
        String text = body.replaceAll("\\s+", " ").trim();
        return text.length() > 200 ? text.substring(0, 200) : text;
    }
}
