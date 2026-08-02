package com.harsh.resourcetracker;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;

import java.util.List;
import java.util.Map;

import com.harsh.resourcetracker.User; 
import com.harsh.resourcetracker.UserRepository;

import com.harsh.resourcetracker.User; 
import com.harsh.resourcetracker.UserRepository;

@RestController
@RequestMapping("/api/resources")
@CrossOrigin(origins = "http://localhost:3000")
public class ResourceController {

    private final ResourceRepository resourceRepository;
    private final FolderRepository folderRepository; // NEW
    private final UserRepository userRepository;
    private final AiService aiService;

    
    public ResourceController(ResourceRepository resourceRepository, FolderRepository folderRepository, AiService aiService, UserRepository userRepository) {
        this.resourceRepository = resourceRepository;
        this.folderRepository = folderRepository;
        this.aiService = aiService;
        this.userRepository = userRepository;
    }

    // THE ENGINE: Finds an existing folder, or creates a brand new one if it doesn't exist
    private Folder getOrCreateFolder(String folderName) {
        if (folderName == null || folderName.trim().isEmpty()) {
            folderName = "General";
        }
        String finalFolderName = folderName;
        return folderRepository.findByName(folderName)
                .orElseGet(() -> {
                    Folder newFolder = new Folder();
                    newFolder.setName(finalFolderName);
                    return folderRepository.save(newFolder);
                });
    }

    @PostMapping
    public Resource createResource(@RequestBody Map<String, Object> payload) {
        Resource resource = new Resource();
        resource.setTitle((String) payload.get("title"));
        resource.setUrl((String) payload.get("url"));
        resource.setDifficulty((String) payload.get("difficulty"));
        resource.setStatus("Queued");
        resource.setIsCompleted(false);

        // Intercept the category string and turn it into a real Folder object
        String folderName = (String) payload.get("category");
        resource.setFolder(getOrCreateFolder(folderName));

        return resourceRepository.save(resource);
    }

    @GetMapping
    public List<Resource> getAllActiveResources() {
        return resourceRepository.findByStatusNot("Archived");
    }

    @GetMapping("/archived")
    public List<Resource> getArchivedResources() {
        return resourceRepository.findByStatus("Archived");
    }

    @PutMapping("/{id}")
    public ResponseEntity<Resource> updateResource(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        return resourceRepository.findById(id).map(existingResource -> {
            if (payload.containsKey("title")) {
                existingResource.setTitle((String) payload.get("title"));
            }
            if (payload.containsKey("category")) {
                existingResource.setFolder(getOrCreateFolder((String) payload.get("category")));
            }
            return ResponseEntity.ok(resourceRepository.save(existingResource));
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/sync")
    public ResponseEntity<?> syncGuestResources(@RequestBody List<Resource> guestResources, Principal principal) {
        String username = principal.getName();
        User user = userRepository.findByUsername(username);
    
        for (Resource r : guestResources) {
            r.setUser(user); // Associate the old guest data with the new user
            resourceRepository.save(r);
        }
    
        return ResponseEntity.ok("Synced successfully");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archiveResource(@PathVariable Long id) {
        return resourceRepository.findById(id).map(resource -> {
            resource.setStatus("Archived");
            resourceRepository.save(resource);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PutMapping("/{id}/restore")
    public ResponseEntity<Void> restoreResource(@PathVariable Long id) {
        return resourceRepository.findById(id).map(resource -> {
            resource.setStatus("Queued");
            resourceRepository.save(resource);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentlyDeleteResource(@PathVariable Long id) {
        return resourceRepository.findById(id).map(resource -> {
            resourceRepository.delete(resource);
            return ResponseEntity.ok().<Void>build();
        }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/analyze")
    public ResponseEntity<Map<String, String>> analyzeUrl(@RequestParam String url) {
        // Feed the AI all our REAL folder names directly from the new database table
        List<String> existingFolders = folderRepository.findAllFolderNames();
        Map<String, String> aiResult = aiService.generateResourceDetails(url, existingFolders);
        return ResponseEntity.ok(aiResult);
    }

    @GetMapping("/folders")
    public List<Folder> getFolderTree() {
        // This grabs all folders, but filters the list to only return the "Root" folders.
        // Because of how we set up the entity, Spring Boot will automatically nest the sub-folders inside them!
        return folderRepository.findAll().stream()
                .filter(folder -> folder.getParent() == null)
                .toList();
    }

    @GetMapping("/analytics/difficulty")
    public List<Map<String, Object>> getDifficultyStats() {
        return resourceRepository.countByDifficulty().stream()
                .map(obj -> {
                    Object difficulty = obj[0] != null ? obj[0] : "Unspecified";
                    return Map.of("name", difficulty, "value", obj[1]);
                })
                .toList();
    }
}