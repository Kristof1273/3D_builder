package com.kristof._D_builder;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

// <Mit mentünk, Mi az ID típusa> -> <ProjectData, String>
public interface ProjectRepository extends MongoRepository<ProjectData, String> {

    // Egyedi kereső metódusok (a Spring automatikusan megírja őket a név alapján)
    List<ProjectData> findAllByOrderByCreatedAtDesc();

    ProjectData findByName(String name);
}