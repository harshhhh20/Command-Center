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
        factory.setReadTimeout(5000); // 5 seconds as requested

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

            // 2. Build a strong, honest prompt
            String prompt =
                "You are a smart bookmarking assistant for a general-purpose link tracker. " +
                "Users bookmark ALL kinds of links — tutorials, news articles, recipes, shopping pages, " +
                "tools, YouTube videos, GitHub repos, documentation, entertainment, social media, and anything else. " +
                "This is NOT a study-course catalog. Do not assume the link is educational.\n\n" +

                "URL: " + url + "\n" +
                "Scraped page title: '" + webpageTitle + "'\n" +
                "User's existing categories: " + existingCategories + "\n\n" +

                "Your task: return a JSON object with exactly three keys — title, category, difficulty.\n\n" +

                "--- TITLE ---\n" +
                "Write a clean, human-readable title (3–10 words). " +
                "Strip site-name boilerplate like '| YouTube', '- Reddit', '| Medium'. " +
                "If the scraped title is junk or 'Unknown Title', infer a sensible title from the URL path words. " +
                "Do NOT just repeat the raw URL.\n\n" +

                "--- CATEGORY ---\n" +
                "Pick the single best category for this link. " +
                "If it closely matches one of the user's existing categories (case-insensitive), return that EXACT existing name — do not create a near-duplicate. " +
                "If nothing fits, invent a short, broad, title-case category (1–3 words). " +
                "Categories are not limited to tech topics: 'Recipes', 'Finance', 'Gaming', 'Design', 'News', 'Shopping' are all valid.\n\n" +

                "--- DIFFICULTY ---\n" +
                "Only assign a difficulty (Beginner, Intermediate, or Advanced) for content that has genuine structured learning: " +
                "tutorials, courses, technical documentation, or academic papers. " +
                "For everything else — news, social media, entertainment, shopping, recipes, tools, landing pages, etc. — " +
                "set difficulty to 'Unspecified'. " +
                "An incorrect difficulty label is worse than no label at all.\n\n" +

                "Return ONLY a valid JSON object. No explanation, no markdown, no extra text.";

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