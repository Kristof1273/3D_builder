package com.kristof._D_builder;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Document(collection = "projects")
public class ProjectData {

    @Id
    public String id; // MongoDB ID

    public String name;
    public String description; // Opcionális
    public long createdAt = System.currentTimeMillis();

    // JAVÍTVA: Nem WorldStateService.WorldState, hanem simán WorldState
    public WorldState worldState;

    // Üres konstruktor (kell a MongoDB-nek)
    public ProjectData() {}

    public ProjectData(String name, WorldState worldState) {
        this.name = name;
        this.worldState = worldState;
    }
}