import java.io.*;
import java.net.*;
import java.util.*;

public class TestGemini {
    public static void main(String[] args) throws Exception {
        String apiKey = System.getenv("GEMINI_API_KEY");
        if (apiKey == null) { System.out.println("No key"); return; }
        
        String urlString = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey;
        
        String payload = """
        {
          "contents": [
            {
              "parts": [
                {
                  "text": "test"
                }
              ]
            }
          ],
          "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 150,
            "responseMimeType": "application/json",
            "responseSchema": {
              "type": "OBJECT",
              "properties": {
                "title": { "type": "STRING" },
                "category": { "type": "STRING" },
                "difficulty": { "type": "STRING", "enum": ["Beginner", "Intermediate", "Advanced", "Unspecified"] }
              },
              "required": ["title", "category", "difficulty"]
            }
          }
        }
        """;

        URL url = new URL(urlString);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);

        try (OutputStream os = conn.getOutputStream()) {
            os.write(payload.getBytes());
        }

        int code = conn.getResponseCode();
        System.out.println("Response Code: " + code);
        
        InputStream is = code < 400 ? conn.getInputStream() : conn.getErrorStream();
        BufferedReader in = new BufferedReader(new InputStreamReader(is));
        String inputLine;
        while ((inputLine = in.readLine()) != null) {
            System.out.println(inputLine);
        }
        in.close();
    }
}
