package com.kristof._D_builder;
import java.util.List;
import java.util.Map;

public record WorldState(
        List<Point3D> points,
        List<Connection> connections,
        List<Face> faces,
        Map<String, List<Integer>> collections,
        double currentTime,
        boolean isPlaying,
        List<WorldStateService.TimelineClip> clips
) {}