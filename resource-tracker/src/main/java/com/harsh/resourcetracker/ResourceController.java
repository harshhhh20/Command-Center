package com.harsh.resourcetracker;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/resources")
@CrossOrigin(origins = {"http://localhost:3000", "https://command-center-cc.vercel.app"})
public class ResourceController {

    private final ResourceRepository resourceRepository;
    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final AiService aiService;

    public ResourceController(ResourceRepository resourceRepository, FolderRepository folderRepository, AiService aiService, UserRepository userRepository) {
        this.resourceRepository = resourceRepository;
        this.folderRepository = folderRepository;
        this.aiService = aiService;
        this.userRepository = userRepository;
    }

    // Helper: get the currently logged-in User object
    private User getCurrentUser(Principal principal) {
        return userRepository.findByUsername(principal.getName());
    }

    // Helper: find or create a folder
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

    // POST /api/resources — create, locked to current user
    @PostMapping
    public Resource createResource(@RequestBody Map<String, Object> payload, Principal principal) {
        User currentUser = getCurrentUser(principal);

        Resource resource = new Resource();
        resource.setTitle((String) payload.get("title"));
        resource.setUrl((String) payload.get("url"));
        resource.setDifficulty((String) payload.get("difficulty"));
        resource.setStatus("Queued");
        resource.setIsCompleted(false);
        resource.setUser(currentUser); // 🔒 Lock to this user

        String folderName = (String) payload.get("category");
        resource.setFolder(getOrCreateFolder(folderName));

        return resourceRepository.save(resource);
    }

    // GET /api/resources — only active resources for current user
    @GetMapping
    public List<Resource> getAllActiveResources(Principal principal) {
        User currentUser = getCurrentUser(principal);
        return resourceRepository.findByUserIdAndStatusNot(currentUser.getId(), "Archived");
    }

    // GET /api/resources/archived — only archived resources for current user
    @GetMapping("/archived")
    public List<Resource> getArchivedResources(Principal principal) {
        User currentUser = getCurrentUser(principal);
        return resourceRepository.findByUserIdAndStatus(currentUser.getId(), "Archived");
    }

    // PUT /api/resources/{id} — update, only if it belongs to current user
    @PutMapping("/{id}")
    public ResponseEntity<Resource> updateResource(@PathVariable Long id, @RequestBody Map<String, Object> payload, Principal principal) {
        User currentUser = getCurrentUser(principal);
        return resourceRepository.findById(id)
                .filter(r -> r.getUser() != null && r.getUser().getId().equals(currentUser.getId()))
                .map(existingResource -> {
                    if (payload.containsKey("title")) {
                        existingResource.setTitle((String) payload.get("title"));
                    }
                    if (payload.containsKey("category")) {
                        existingResource.setFolder(getOrCreateFolder((String) payload.get("category")));
                    }
                    return ResponseEntity.ok(resourceRepository.save(existingResource));
                }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // POST /api/resources/sync — guest data migration on signup
    @PostMapping("/sync")
    public ResponseEntity<?> syncGuestResources(@RequestBody List<Resource> guestResources, Principal principal) {
        User user = getCurrentUser(principal);
        for (Resource r : guestResources) {
            r.setUser(user);
            resourceRepository.save(r);
        }
        return ResponseEntity.ok("Synced successfully");
    }

    // DELETE /api/resources/{id} — archive, only if owned by current user
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> archiveResource(@PathVariable Long id, Principal principal) {
        User currentUser = getCurrentUser(principal);
        return resourceRepository.findById(id)
                .filter(r -> r.getUser() != null && r.getUser().getId().equals(currentUser.getId()))
                .map(resource -> {
                    resource.setStatus("Archived");
                    resourceRepository.save(resource);
                    return ResponseEntity.ok().<Void>build();
                }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // PUT /api/resources/{id}/restore — restore, only if owned by current user
    @PutMapping("/{id}/restore")
    public ResponseEntity<Void> restoreResource(@PathVariable Long id, Principal principal) {
        User currentUser = getCurrentUser(principal);
        return resourceRepository.findById(id)
                .filter(r -> r.getUser() != null && r.getUser().getId().equals(currentUser.getId()))
                .map(resource -> {
                    resource.setStatus("Queued");
                    resourceRepository.save(resource);
                    return ResponseEntity.ok().<Void>build();
                }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // DELETE /api/resources/{id}/permanent — hard delete, only if owned by current user
    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<Void> permanentlyDeleteResource(@PathVariable Long id, Principal principal) {
        User currentUser = getCurrentUser(principal);
        return resourceRepository.findById(id)
                .filter(r -> r.getUser() != null && r.getUser().getId().equals(currentUser.getId()))
                .map(resource -> {
                    resourceRepository.delete(resource);
                    return ResponseEntity.ok().<Void>build();
                }).orElseGet(() -> ResponseEntity.notFound().build());
    }

    // GET /api/resources/analyze — AI scan (no user filter needed, public tool)
    @GetMapping("/analyze")
    public ResponseEntity<Map<String, String>> analyzeUrl(@RequestParam String url) {
        List<String> existingFolders = folderRepository.findAllFolderNames();
        Map<String, String> aiResult = aiService.generateResourceDetails(url, existingFolders);
        return ResponseEntity.ok(aiResult);
    }

    // GET /api/resources/folders
    @GetMapping("/folders")
    public List<Folder> getFolderTree() {
        return folderRepository.findAll().stream()
                .filter(folder -> folder.getParent() == null)
                .toList();
    }

    // GET /api/resources/analytics/difficulty — scoped to current user
    @GetMapping("/analytics/difficulty")
    public List<Map<String, Object>> getDifficultyStats(Principal principal) {
        User currentUser = getCurrentUser(principal);
        return resourceRepository.countByDifficultyForUser(currentUser.getId()).stream()
                .map(obj -> {
                    Object difficulty = obj[0] != null ? obj[0] : "Unspecified";
                    return Map.of("name", difficulty, "value", obj[1]);
                })
                .toList();
    }
}