package com.kristof._D_builder;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.Optional;

@Service
public class ProjectStorageService {

    private final ProjectRepository repository;
    private final WorldStateService worldStateService; // Hogy le tudjuk kérni az aktuális állapotot

    @Autowired
    public ProjectStorageService(ProjectRepository repository, WorldStateService worldStateService) {
        this.repository = repository;
        this.worldStateService = worldStateService;
    }

    // Mentés
    public ProjectData saveCurrentProject(String name) {
        // 1. Lekérjük a jelenlegi világot (ez a különálló WorldState objektum)
        WorldState currentState = worldStateService.getWorldState();

        // 2. Létrehozzuk a mentendő adatot
        ProjectData project = new ProjectData(name, currentState);

        // 3. Ha már létezik ilyen nevű, felülírjuk (vagy dobhatnánk hibát is)
        ProjectData existing = repository.findByName(name);
        if (existing != null) {
            project.id = existing.id; // Az ID megtartásával felülírja (update)
        }

        return repository.save(project);
    }

    // Betöltés
    public boolean loadProject(String id) {
        Optional<ProjectData> projectOpt = repository.findById(id);
        if (projectOpt.isPresent()) {
            ProjectData project = projectOpt.get();
            // Visszatöltjük az adatot a WorldStateService-be
            // (Ehhez a WorldStateService-ben kell majd egy loadWorldState metódus, de egyelőre a clear + add-okkal is megoldható lenne,
            // de elegánsabb, ha írunk egy restore-t. Ezt a következő lépésben megcsináljuk.)
            worldStateService.restoreStateFromDb(project.worldState);
            return true;
        }
        return false;
    }

    // Listázás
    public List<ProjectData> getAllProjects() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    // Törlés
    public void deleteProject(String id) {
        repository.deleteById(id);
    }
}