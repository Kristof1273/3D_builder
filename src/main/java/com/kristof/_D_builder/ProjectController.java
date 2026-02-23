package com.kristof._D_builder;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/projects")
@CrossOrigin(origins = "http://localhost:5173") // Engedélyezzük a React frontendet
public class ProjectController {

    private final ProjectStorageService projectStorageService;

    @Autowired
    public ProjectController(ProjectStorageService projectStorageService) {
        this.projectStorageService = projectStorageService;
    }

    // LISTÁZÁS: GET /api/projects
    @GetMapping
    public List<ProjectData> listProjects() {
        return projectStorageService.getAllProjects();
    }

    // MENTÉS: POST /api/projects?name=Valami
    @PostMapping
    public ProjectData saveProject(@RequestParam String name) {
        return projectStorageService.saveCurrentProject(name);
    }

    // BETÖLTÉS: POST /api/projects/{id}/load
    @PostMapping("/{id}/load")
    public ResponseEntity<String> loadProject(@PathVariable String id) {
        boolean success = projectStorageService.loadProject(id);
        if (success) {
            return ResponseEntity.ok("Project loaded successfully.");
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    // TÖRLÉS: DELETE /api/projects/{id}
    @DeleteMapping("/{id}")
    public void deleteProject(@PathVariable String id) {
        projectStorageService.deleteProject(id);
    }
}