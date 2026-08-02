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
import java.util.Arrays;

@Service
public class AiService {

    private static final Logger log = LoggerFactory.getLogger(AiService.class);

    // The only three difficulty values we ever want to persist.
    private static final Set<String> ALLOWED_DIFFICULTIES = Set.of("Beginner", "Intermediate", "Advanced");

    // Pulls the API key directly from your application.properties
    @Value("${spring.ai.openai.api-key}")
    private String apiKey;

    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate;

    public AiService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;

        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000); // 5 seconds to connect
        factory.setReadTimeout(5000);    // 5 seconds to read the response

        this.restTemplate = new RestTemplate(factory);
    }

    @SuppressWarnings("unchecked")
    public Map<String, String> generateResourceDetails(String url, List<String> existingCategories) {
        Map<String, String> fallback = new HashMap<>();
        fallback.put("title", "Could not analyze URL");
        fallback.put("category", "General");
        fallback.put("difficulty", "Beginner");

        try {
            // 1. THE FETCHER - Java visits the URL and grabs the webpage title
            String webpageTitle = "Unknown Title";
            try {
                Document doc = Jsoup.connect(url).userAgent("Mozilla/5.0").timeout(3000).get();
                webpageTitle = doc.title();
            } catch (Exception e) {
                log.debug("Could not scrape URL '{}', falling back to guessing. Reason: {}", url, e.getMessage());
            }

            // 2. THE THINKER - We give the AI the actual scraped title to analyze
            String prompt = "Analyze this URL: " + url + " \n" +
                    "The scraped webpage title is: '" + webpageTitle + "' \n" +
                    "If the scraped title is 'Unknown Title', please infer a readable title directly from the words in the URL string. \n" +
                    "Here are my existing database categories/folders: " + existingCategories + " \n" +
                    "Extract a clean Title, a Category, and Difficulty. \n" +
                    "CRITICAL: If this resource fits into one of my existing categories, you MUST use that exact category name. If it is something entirely new, invent a concise new category. \n" +
                    "Return ONLY a raw JSON object with keys: 'title', 'category', 'difficulty'.";

            // The actual, official Google Gemini endpoint (unchanged model)
            String endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=" + apiKey;
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            // Safely construct the nested JSON body that Gemini requires
            Map<String, Object> part = new HashMap<>();
            part.put("text", prompt);

            Map<String, Object> content = new HashMap<>();
            content.put("parts", new Object[]{part});

            Map<String, Object> requestBodyMap = new HashMap<>();
            requestBodyMap.put("contents", new Object[]{content});

            // Force Gemini to conform to an exact JSON shape and enum, instead of
            // just hoping the prompt wording is followed. This is the biggest
            // lever for reducing malformed JSON and hallucinated difficulty values.
            Map<String, Object> titleProp = Map.of("type", "STRING");
            Map<String, Object> categoryProp = Map.of("type", "STRING");
            Map<String, Object> difficultyProp = Map.of(
                    "type", "STRING",
                    "enum", List.of("Beginner", "Intermediate", "Advanced")
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
            generationConfig.put("temperature", 0.2); // Low creativity, high speed
            generationConfig.put("maxOutputTokens", 150); // Cut off long responses
            generationConfig.put("responseMimeType", "application/json"); // Force pure JSON
            generationConfig.put("responseSchema", responseSchema); // Force exact shape + enum

            requestBodyMap.put("generationConfig", generationConfig);

            // Convert the Java Maps into a JSON string
            String requestBody = objectMapper.writeValueAsString(requestBodyMap);
            HttpEntity<String> request = new HttpEntity<>(requestBody, headers);

            // Make the direct POST request to Google
            ResponseEntity<String> response = restTemplate.postForEntity(endpoint, request, String.class);
            log.debug("Raw Gemini response: {}", response.getBody());

            // Drill down into Google's response structure, defensively.
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

            // Clean up the AI's response and map it to our format
            String cleanJson = aiText.replace("```json", "").replace("```", "").trim();
            Map<String, String> aiResult = objectMapper.readValue(cleanJson, Map.class);

            return normalizeResult(aiResult, existingCategories, fallback);

        } catch (Exception e) {
            log.error("Direct AI Analysis Failed for url '{}': {}", url, e.getMessage());
            return fallback;
        }
    }

    /**
     * Cleans up whatever the model returned before it touches the database:
     * - snaps difficulty to one of the three allowed values (case-insensitive), defaulting to Beginner
     * - snaps category to the existing folder's exact casing if it's a case-insensitive match,
     *   so the AI doesn't create "web dev" as a duplicate of "Web Dev"
     */
    private Map<String, String> normalizeResult(Map<String, String> aiResult, List<String> existingCategories, Map<String, String> fallback) {
        Map<String, String> result = new HashMap<>();

        String title = aiResult.get("title");
        result.put("title", (title == null || title.isBlank()) ? fallback.get("title") : title.trim());

        String difficulty = aiResult.get("difficulty");
        result.put("difficulty", normalizeDifficulty(difficulty));

        String category = aiResult.get("category");
        result.put("category", normalizeCategory(category, existingCategories));

        return result;
    }

    private String normalizeDifficulty(String difficulty) {
        if (difficulty == null) {
            return "Beginner";
        }
        return ALLOWED_DIFFICULTIES.stream()
                .filter(allowed -> allowed.equalsIgnoreCase(difficulty.trim()))
                .findFirst()
                .orElse("Beginner");
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