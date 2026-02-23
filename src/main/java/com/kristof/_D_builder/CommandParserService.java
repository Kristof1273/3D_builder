package com.kristof._D_builder;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.ArrayList;
import java.util.List;

@Service
public class CommandParserService {

    private final WorldStateService worldStateService;
    private final ProjectStorageService projectStorageService;

    @Autowired
    // JAVÍTVA: Most már két szervizt injektálunk!
    public CommandParserService(WorldStateService worldStateService, ProjectStorageService projectStorageService) {
        this.worldStateService = worldStateService;
        this.projectStorageService = projectStorageService;
    }

    public String processCommand(String command) {
        if (command == null || command.trim().isEmpty()) return "";

        command = command.trim();

        // --- CONTROL COMMANDS ---
        if (command.equalsIgnoreCase("Clear")) { worldStateService.clear(); return "World cleared."; }
        if (command.equalsIgnoreCase("Undo")) { worldStateService.undo(); return "Undo executed."; }
        if (command.equalsIgnoreCase("Redo")) { worldStateService.redo(); return "Redo executed."; }
        if (command.equalsIgnoreCase("Play")) { worldStateService.play(); return "Timeline playing."; }
        if (command.equalsIgnoreCase("Pause")) { worldStateService.pause(); return "Timeline paused."; }
        if (command.equalsIgnoreCase("Stop") || command.equalsIgnoreCase("Stop()")) { worldStateService.stop(); return "Timeline stopped."; }
        if (command.startsWith("SaveProject")) return parseSaveProject(command);
        if (command.startsWith("LoadProject")) return parseLoadProject(command);
        if (command.startsWith("removecollection")) {
            return parseRemoveCollection(command);
        }
        if (command.startsWith("renamecollection")) {
            return parseRenameCollection(command);
        }


        if (command.startsWith("Seek")) {
            try {
                double time = Double.parseDouble(command.substring(command.indexOf("(") + 1, command.lastIndexOf(")")));
                worldStateService.seek(time);
                return "Seek to " + time;
            } catch (Exception e) { return "Invalid Seek format"; }
        }

        // --- BUILD COMMANDS ---
        if (command.startsWith("AddPoint")) return parseAddPoint(command);
        if (command.startsWith("Connect")) return parseConnect(command);
        if (command.startsWith("AddFace")) return parseAddFace(command);
        if (command.startsWith("Color")) return parseColor(command);
        if (command.startsWith("Move") && !command.contains("AddClip")) return parseMove(command);
        if (command.startsWith("Delete") && !command.startsWith("DeleteClip")) return parseDelete(command);

        // --- COLLECTION COMMANDS ---
        if (command.startsWith("AddCollection")) return parseAddCollection(command);
        if (command.startsWith("AddToCollection")) return parseAddToCollection(command);
        if (command.startsWith("RemoveFromCollection")) return parseRemoveFromCollection(command);

        // --- ANIMATION / CLIP COMMANDS ---
        if (command.startsWith("DeleteClipById")) return parseDeleteClipById(command);
        if (command.startsWith("DeleteClip")) return parseDeleteClip(command);
        if (command.startsWith("UpdateClip")) return parseUpdateClip(command);
        if (command.startsWith("AddClip")) return parseAddClip(command);

        return "Unknown command: " + command;
    }

    // ==========================================
    // 1. BASIC COMMAND PARSERS
    // ==========================================

    private String parseAddPoint(String cmd) {
        try {
            String[] parts = extractParams(cmd);
            double x = Double.parseDouble(parts[0]);
            double y = Double.parseDouble(parts[1]);
            double z = Double.parseDouble(parts[2]);
            String color = (parts.length > 3) ? parts[3].trim() : "#ffffff";
            worldStateService.addPoint(x, y, z, color);
            return "Point added.";
        } catch (Exception e) { return "Error adding point: " + e.getMessage(); }
    }

    private String parseConnect(String cmd) {
        try {
            String content = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")"));
            int firstComma = content.indexOf(",");
            String sourceStr = content.substring(0, firstComma).trim();
            int sourceId = parseId(sourceStr);

            String rest = content.substring(firstComma + 1).trim();

            List<Integer> targetIds = new ArrayList<>();
            String paramsPart = "";

            if (rest.startsWith("[")) {
                int listEnd = rest.indexOf("]");
                String listStr = rest.substring(0, listEnd + 1);
                targetIds = parseList(listStr);
                paramsPart = rest.substring(listEnd + 1).trim();
            } else {
                int nextComma = rest.indexOf(",");
                if (nextComma == -1) nextComma = rest.length();
                String targetStr = rest.substring(0, nextComma).trim();

                List<Integer> colIds = worldStateService.getCollectionIds(targetStr);
                if(colIds != null) targetIds = colIds;
                else targetIds.add(parseId(targetStr));

                paramsPart = (nextComma < rest.length()) ? rest.substring(nextComma).trim() : "";
            }

            if (paramsPart.startsWith(",")) paramsPart = paramsPart.substring(1).trim();
            String[] opts = paramsPart.isEmpty() ? new String[0] : paramsPart.split(",");
            String color = (opts.length > 0) ? opts[0].trim() : "#ffffff";
            double thickness = (opts.length > 1) ? Double.parseDouble(opts[1].trim()) : 1.0;

            for(int tid : targetIds) {
                worldStateService.addConnection(sourceId, tid, color, thickness);
            }
            return "Connected.";
        } catch (Exception e) { return "Error connecting: " + e.getMessage(); }
    }

    private String parseAddFace(String cmd) {
        try {
            String content = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")"));
            int listEnd = content.indexOf("]");
            String listStr = content.substring(0, listEnd + 1);
            List<Integer> ids = parseList(listStr);

            String rest = content.substring(listEnd + 1).trim();
            String color = rest.startsWith(",") ? rest.substring(1).trim() : "#888888";

            worldStateService.addFace(ids, color);
            return "Face created.";
        } catch (Exception e) { return "Error adding face: " + e.getMessage(); }
    }

    private String parseColor(String cmd) {
        try {
            String[] parts = extractParams(cmd);
            int id = parseId(parts[0]);
            String color = parts[1].trim();
            worldStateService.updatePointColor(id, color);
            return "Color updated.";
        } catch (Exception e) { return "Error updating color."; }
    }

    private String parseMove(String cmd) {
        try {
            String[] parts = extractParams(cmd);
            int id = parseId(parts[0]);
            double x = Double.parseDouble(parts[1]);
            double y = Double.parseDouble(parts[2]);
            double z = Double.parseDouble(parts[3]);
            worldStateService.updatePoint(id, x, y, z);
            return "Point moved.";
        } catch (Exception e) { return "Error moving point."; }
    }

    private String parseDelete(String cmd) {
        try {
            String target = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")")).trim();
            List<Integer> colIds = worldStateService.getCollectionIds(target);
            if(colIds != null) {
                for(int id : colIds) worldStateService.deletePoint(id);
                return "Collection deleted.";
            }
            int id = parseId(target);
            worldStateService.deletePoint(id);
            return "Point deleted.";
        } catch (Exception e) { return "Error deleting."; }
    }

    // ==========================================
    // 2. COLLECTION COMMANDS
    // ==========================================

    private String parseAddCollection(String cmd) {
        try {
            String content = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")"));
            int firstComma = content.indexOf(",");
            if (firstComma == -1) return "Error format. Usage: AddCollection(name, [p1...p5])";

            String name = content.substring(0, firstComma).trim();
            String listPart = content.substring(firstComma + 1).trim();

            // Itt hívjuk az új okos függvényt!
            List<Integer> ids = parseIdList(listPart);

            worldStateService.createCollection(name, ids);
            return "Collection '" + name + "' created with " + ids.size() + " points.";
        } catch (Exception e) { return "Error AddCollection: " + e.getMessage(); }
    }

    private String parseAddToCollection(String cmd) {
        try {
            String content = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")"));
            int firstComma = content.indexOf(",");
            if (firstComma == -1) return "Error format. Usage: AddToCollection(name, [p1...p5])";

            String name = content.substring(0, firstComma).trim();
            String listPart = content.substring(firstComma + 1).trim();

            // Itt is hívjuk az új okos függvényt!
            List<Integer> ids = parseIdList(listPart);

            int addedCount = worldStateService.addToCollection(name, ids);
            return addedCount + " points added to '" + name + "'.";
        } catch (Exception e) { return "Error AddToCollection: " + e.getMessage(); }
    }
    private String parseRemoveCollection(String cmd) {
        try {
            // RemoveCollection(name)
            String[] parts = extractParams(cmd);
            String name = parts[0];
            if (worldStateService.removeCollection(name)) return "Collection removed.";
            return "Collection not found.";
        } catch (Exception e) { return "Error removing collection."; }
    }

    private String parseRenameCollection(String cmd) {
        try {
            // RenameCollection(oldName, newName)
            String[] parts = extractParams(cmd);
            String oldName = parts[0];
            String newName = parts[1];
            if (worldStateService.renameCollection(oldName, newName)) return "Collection renamed.";
            return "Collection not found.";
        } catch (Exception e) { return "Error renaming collection."; }
    }
    // Segédfüggvény: [p1, p3...p6, p8] formátum feldolgozása
    private List<Integer> parseIdList(String param) {
        List<Integer> ids = new ArrayList<>();
        // 1. Szögletes zárójelek eltávolítása
        String clean = param.trim().replace("[", "").replace("]", "");

        if (clean.isEmpty()) return ids;

        // 2. Vessző mentén darabolás
        String[] tokens = clean.split(",");

        for (String token : tokens) {
            token = token.trim().toLowerCase();

            // 3. ELLENŐRZÉS: Van-e benne "..." (vagy "..")
            if (token.contains("..")) {
                // RANGE KEZELÉSE (pl. p3...p7)
                String[] parts = token.split("\\.{2,3}"); // 2 vagy 3 pont mentén vágunk
                if (parts.length == 2) {
                    try {
                        int start = Integer.parseInt(parts[0].replace("p", "").trim());
                        int end = Integer.parseInt(parts[1].replace("p", "").trim());

                        // Helyes sorrend biztosítása (ha p7...p3-at írtak volna)
                        int min = Math.min(start, end);
                        int max = Math.max(start, end);

                        for (int i = min; i <= max; i++) {
                            ids.add(i);
                        }
                    } catch (NumberFormatException e) {
                        System.err.println("Invalid range format: " + token);
                    }
                }
            } else {
                // SIMA PONT (pl. p5)
                try {
                    ids.add(Integer.parseInt(token.replace("p", "").trim()));
                } catch (NumberFormatException e) {
                    System.err.println("Invalid ID format: " + token);
                }
            }
        }
        return ids;
    }
    private String parseRemoveFromCollection(String cmd) {
        try {
            String content = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")"));
            int firstComma = content.indexOf(",");
            String name = content.substring(0, firstComma).trim();
            String listPart = content.substring(firstComma + 1).trim();
            List<Integer> ids = parseList(listPart);
            worldStateService.removeFromCollection(name, ids);
            return "Removed from collection.";
        } catch (Exception e) { return "Error RemoveFromCollection: " + e.getMessage(); }
    }

    // ==========================================
    // 3. ANIMATION COMMANDS (FULL LOGIC)
    // ==========================================

    private String parseAddClip(String cmd) {
        String content = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")"));

        try {
            // 1. LÉPÉS: Paraméterek szétválogatása a splitParams segítségével
            // Ez helyesen kezeli a zárójeleket a [p0,p1] esetén is
            List<String> parts = splitParams(content);

            if (parts.size() < 5) return "Error: Not enough parameters.";

            String targetStr = parts.get(0).trim();
            String type = parts.get(1).trim();
            double startTime = Double.parseDouble(parts.get(2).trim());
            double endTime = Double.parseDouble(parts.get(3).trim());

            // 2. LÉPÉS: Mód eldöntése az 5. paraméter alapján
            // Ha az 5. paraméter szögletes zárójellel kezdődik, akkor VEKTOR mód (pl. [10,0,0])
            // Ha nem, akkor TENGELYES mód (pl. x, y, z)

            String param5 = parts.get(4).trim();
            boolean isVectorMode = param5.startsWith("[");

            String namePart = "";
            double dx = 0, dy = 0, dz = 0; // Relatív
            double absX = 0, absY = 0, absZ = 0; // Abszolút

            if (isVectorMode) {
                // --- VEKTOR MÓD ---
                // AddClip(target, type, start, end, [x,y,z], "name"?)

                String vectorPart = param5.replace("[", "").replace("]", "");
                String[] coords = vectorPart.split(",");
                absX = Double.parseDouble(coords[0].trim());
                absY = Double.parseDouble(coords[1].trim());
                absZ = Double.parseDouble(coords[2].trim());

                if (parts.size() > 5) {
                    namePart = parts.get(5).replace("\"", "").replace("'", "").trim();
                }

            } else {
                // --- TENGELYES MÓD ---
                // AddClip(target, type, start, end, axis, amount, "name"?)
                if (parts.size() < 6) return "Error: Missing axis or amount.";

                String axis = param5.toLowerCase();
                double amount = Double.parseDouble(parts.get(5).trim());

                if (parts.size() > 6) {
                    namePart = parts.get(6).replace("\"", "").replace("'", "").trim();
                }

                if (axis.equals("x")) dx = amount;
                else if (axis.equals("y")) dy = amount;
                else if (axis.equals("z")) dz = amount;
            }

            // 3. LÉPÉS: Célpontok feloldása (Lista, Collection vagy Single ID)
            List<Integer> targetIds = new ArrayList<>();
            if (targetStr.startsWith("[")) {
                targetIds = parseList(targetStr);
            } else {
                List<Integer> colIds = worldStateService.getCollectionIds(targetStr);
                if (colIds != null && !colIds.isEmpty()) targetIds.addAll(colIds);
                else {
                    try { targetIds.add(parseId(targetStr)); }
                    catch(Exception e) { return "Error: Target not found."; }
                }
            }

            // 4. LÉPÉS: Klipek létrehozása
            int count = 0;
            for (int id : targetIds) {
                double tx, ty, tz;
                if (isVectorMode) {
                    tx = absX; ty = absY; tz = absZ;
                } else {
                    Point3D p = worldStateService.getPoint(id);
                    if (p == null) continue;
                    tx = p.x() + dx;
                    ty = p.y() + dy;
                    tz = p.z() + dz;
                }
                worldStateService.addClip(id, type, startTime, endTime, tx, ty, tz, namePart);
                count++;
            }
            return "Added " + count + " clips.";

        } catch (Exception e) {
            e.printStackTrace();
            return "Error parsing AddClip: " + e.getMessage();
        }
    }

    private String parseDeleteClipById(String cmd) {
        try {
            String id = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")")).trim();
            id = id.replace("\"", "").replace("'", "");
            boolean success = worldStateService.deleteClipById(id);
            return success ? "Clip deleted." : "Clip ID not found.";
        } catch (Exception e) { return "Error: " + e.getMessage(); }
    }

    private String parseDeleteClip(String cmd) {
        String name = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")")).trim();
        name = name.replace("\"", "");
        worldStateService.deleteClip(name);
        return "Clips deleted by name.";
    }

    private String parseUpdateClip(String cmd) {
        try {
            String[] parts = extractParams(cmd);
            worldStateService.updateClip(parts[0], parts[1], Double.parseDouble(parts[2]), Double.parseDouble(parts[3]));
            return "Clip updated.";
        } catch(Exception e) { return "Error updating."; }
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    private String[] extractParams(String cmd) {
        String content = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")"));
        return content.split(",");
    }

    private List<String> splitParams(String content) {
        List<String> parts = new ArrayList<>();
        int bracketLevel = 0;
        StringBuilder sb = new StringBuilder();
        for (char c : content.toCharArray()) {
            if (c == '[') bracketLevel++;
            if (c == ']') bracketLevel--;
            if (c == ',' && bracketLevel == 0) {
                parts.add(sb.toString().trim());
                sb.setLength(0);
            } else {
                sb.append(c);
            }
        }
        parts.add(sb.toString().trim());
        return parts;
    }

    private List<Integer> parseList(String listStr) {
        List<Integer> ids = new ArrayList<>();
        String clean = listStr.replace("[", "").replace("]", "").trim();
        if(clean.isEmpty()) return ids;
        for(String s : clean.split(",")) {
            try { ids.add(parseId(s.trim())); } catch(Exception e){}
        }
        return ids;
    }

    private int parseId(String idStr) {
        return Integer.parseInt(idStr.toLowerCase().replace("p", "").trim());
    }

    private String parseSaveProject(String cmd) {
        try {
            // SaveProject(MyCoolHouse)
            String name = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")")).trim();
            // Idézőjelek levétele, ha van
            name = name.replace("\"", "").replace("'", "");

            ProjectData saved = projectStorageService.saveCurrentProject(name);
            return "Project saved! ID: " + saved.id;
        } catch (Exception e) {
            return "Error saving: " + e.getMessage();
        }
    }

    private String parseLoadProject(String cmd) {
        try {
            // LoadProject(projekt_id_string)
            String id = cmd.substring(cmd.indexOf("(") + 1, cmd.lastIndexOf(")")).trim();
            id = id.replace("\"", "").replace("'", "");

            // Itt trükközhetünk: Ha név alapján akarsz betölteni, ahhoz a repositoryban
            // kellene egy findByName, de most ID alapján a legbiztosabb.

            boolean success = projectStorageService.loadProject(id);
            return success ? "Project loaded." : "Project not found.";
        } catch (Exception e) {
            return "Error loading: " + e.getMessage();
        }
    }
}


