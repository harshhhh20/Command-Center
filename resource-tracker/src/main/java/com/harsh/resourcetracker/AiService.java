package com.harsh.resourcetracker;

import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;
import java.util.List;
import java.util.Set;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    private static final Set<String> ALLOWED_DIFFICULTIES = Set.of("Beginner", "Intermediate", "Advanced");

    @Value("${spring.ai.openai.api-key}")
    private String apiKey;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public AiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000); // Reverted to 5s

        this.restTemplate = new RestTemplate(factory);
    }

    @SuppressWarnings("unchecked")
    public Map<String, String> generateResourceDetails(String url, List<String> existingCategories) {
        Map<String, String> fallback = new HashMap<>();
        fallback.put("title", "Could not analyze URL");
        fallback.put("category", "General");
        fallback.put("difficulty", null); // honest fallback — not "Beginner"

        try {
            // 1. Scrape the page title
            String webpageTitle = "Unknown Title";
            try {
                Document doc = Jsoup.connect(url).userAgent("Mozilla/5.0").timeout(3000).get();
                webpageTitle = doc.title();
            } catch (Exception e) {
                log.debug("Could not scrape URL '{}': {}", url, e.getMessage());
            }

            // 2. Build a concise but accurate prompt
            String prompt = "Analyze this URL: " + url + " \n" +
                    "The scraped webpage title is: '" + webpageTitle + "' \n" +
                    "If the scraped title is 'Unknown Title', please infer a readable title directly from the words in the URL string. \n" +
                    "Here are my existing database categories/folders: " + existingCategories + " \n" +
                    "Extract a clean Title, a Category, and Difficulty. \n" +
                    "CRITICAL: If this resource fits into one of my existing categories, you MUST use that exact category name. If nothing fits, invent a concise new category (e.g. Shopping, Recipes, News). \n" +
                    "CRITICAL DIFFICULTY RULE: Only assign Beginner/Intermediate/Advanced for study resources or tutorials. For non-educational links (news, shopping, general), set difficulty to 'Unspecified'. \n" +
                    "Return ONLY a raw JSON object with keys: 'title', 'category', 'difficulty'.";

            String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + apiKey;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            Map<String, Object> part = new HashMap<>();
            part.put("text", prompt);

            Map<String, Object> content = new HashMap<>();
            content.put("parts", new Object[]{part});

            Map<String, Object> requestBodyMap = new HashMap<>();
            requestBodyMap.put("contents", new Object[]{content});

            // Schema: difficulty uses an explicit 'Unspecified' option instead of nullable,
            // because Gemini's API strictly rejects the 'nullable' flag in structured outputs.
            Map<String, Object> titleProp = Map.of("type", "STRING");
            Map<String, Object> categoryProp = Map.of("type", "STRING");
            Map<String, Object> difficultyProp = Map.of(
                    "type", "STRING",
                    "enum", List.of("Beginner", "Intermediate", "Advanced", "Unspecified")
            );

            Map<String, Object> properties = new HashMap<>();
            properties.put("title", titleProp);
            properties.put("category", categoryProp);
            properties.put("difficulty", difficultyProp);

            Map<String, Object> responseSchema = new HashMap<>();
            responseSchema.put("type", "OBJECT");
            responseSchema.put("properties", properties);
            responseSchema.put("required", List.of("title", "category", "difficulty"));

            Map<String, Object> generationConfig = new HashMap<>();
            generationConfig.put("temperature", 0.1); // Very low — we want consistent classification, not creativity
            generationConfig.put("maxOutputTokens", 150);
            generationConfig.put("responseMimeType", "application/json");
            generationConfig.put("responseSchema", responseSchema);

            requestBodyMap.put("generationConfig", generationConfig);

            String requestBody = objectMapper.writeValueAsString(requestBodyMap);
            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, request, String.class);
            log.debug("Raw Gemini response: {}", response.getBody());

            JsonNode rootNode = objectMapper.readTree(response.getBody());
            JsonNode candidates = rootNode.path("candidates");

            if (!candidates.isArray() || candidates.isEmpty()) {
                log.warn("Gemini returned no candidates for url '{}'. Full response: {}", url, response.getBody());
                return fallback;
            }

            String aiText = candidates.get(0)
                    .path("content")
                    .path("parts").get(0)
                    .path("text").asText();

            log.debug("Extracted AI text: {}", aiText);

            String cleanJson = aiText.replace("```json", "").replace("```", "").trim();
            Map<String, String> aiResult = objectMapper.readValue(cleanJson, Map.class);

            return normalizeResult(aiResult, existingCategories, fallback);

        } catch (Exception e) {
            log.error("AI Analysis Failed for url '{}': {}", url, e.getMessage());
            fallback.put("title", "Error: " + e.getMessage());
            return fallback;
        }
    }

    private Map<String, String> normalizeResult(Map<String, String> aiResult, List<String> existingCategories, Map<String, String> fallback) {
        Map<String, String> result = new HashMap<>();

        String title = aiResult.get("title");
        result.put("title", (title == null || title.isBlank()) ? fallback.get("title") : title.trim());

        // normalizeDifficulty now returns null for non-learning content — that's intentional
        String difficulty = aiResult.get("difficulty");
        result.put("difficulty", normalizeDifficulty(difficulty));

        String category = aiResult.get("category");
        result.put("category", normalizeCategory(category, existingCategories));

        return result;
    }

    private String normalizeDifficulty(String difficulty) {
        if (difficulty == null || difficulty.isBlank() || difficulty.equalsIgnoreCase("Unspecified")) {
            return null; // Honest: not applicable. Do NOT default to "Beginner".
        }
        return ALLOWED_DIFFICULTIES.stream()
                .filter(allowed -> allowed.equalsIgnoreCase(difficulty.trim()))
                .findFirst()
                .orElse(null); // Unrecognized value → null, not "Beginner"
    }

    private String normalizeCategory(String category, List<String> existingCategories) {
        if (category == null || category.isBlank()) {
            return "General";
        }
        String trimmed = category.trim();
        if (existingCategories == null) {
            return trimmed;
        }
        return existingCategories.stream()
                .filter(existing -> existing.equalsIgnoreCase(trimmed))
                .findFirst()
                .orElse(trimmed);
    }
}