package com.kristof._D_builder;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

@Service
public class WorldStateService {

    private final SimpMessagingTemplate messagingTemplate;
    private final PricingService pricingService;

    // Szálbiztos tárolók
    private final List<Point3D> points = new CopyOnWriteArrayList<>();
    private final List<Connection> connections = new CopyOnWriteArrayList<>();
    private final List<Face> faces = new CopyOnWriteArrayList<>();
    private final Map<String, List<Integer>> collections = new ConcurrentHashMap<>();

    // Undo/Redo
    private final Stack<WorldState> undoStack = new Stack<>();
    private final Stack<WorldState> redoStack = new Stack<>();
    private static final int MAX_HISTORY = 50;

    // Animációk
    private final Map<Integer, AnimationData> activeAnimations = new ConcurrentHashMap<>();
    private final Map<Integer, RotationAnimData> activeRotationAnims = new ConcurrentHashMap<>();

    private final AtomicInteger nextId = new AtomicInteger(0);

    // TIMELINE
    private final List<TimelineClip> timelineClips = new CopyOnWriteArrayList<>();
    private double currentTime = 0.0;
    private double maxTime = 60.0;
    private boolean isPlaying = false;
    private long lastLoopTime = System.currentTimeMillis();

    public WorldStateService(SimpMessagingTemplate messagingTemplate, PricingService pricingService) {
        this.messagingTemplate = messagingTemplate;
        this.pricingService = pricingService;
    }

    private void broadcast() {
        try {
            messagingTemplate.convertAndSend("/topic/world-updates", getWorldState());
        } catch (Exception e) {
            System.err.println("Broadcast hiba: " + e.getMessage());
        }
    }

    // ==========================
    // FORGATÁS
    // ==========================

    private boolean internalRotatePoint(int id, String axis, double degrees, double px, double py, double pz) {
        Point3D p = getPoint(id);
        if (p == null) return false;

        double rad = Math.toRadians(degrees);

        // 1. Eltolás
        double x = p.x() - px;
        double y = p.y() - py;
        double z = p.z() - pz;

        // 2. Forgatás
        double nx = x, ny = y, nz = z;
        switch (axis.trim().toLowerCase()) {
            case "x":
                ny = y * Math.cos(rad) - z * Math.sin(rad);
                nz = y * Math.sin(rad) + z * Math.cos(rad);
                break;
            case "y":
                nx = x * Math.cos(rad) + z * Math.sin(rad);
                nz = -x * Math.sin(rad) + z * Math.cos(rad);
                break;
            case "z":
                nx = x * Math.cos(rad) - y * Math.sin(rad);
                ny = x * Math.sin(rad) + y * Math.cos(rad);
                break;
            default: return false;
        }

        // 3. Visszatolás és NaN védelem
        double finalX = nx + px;
        double finalY = ny + py;
        double finalZ = nz + pz;

        if (Double.isNaN(finalX) || Double.isNaN(finalY) || Double.isNaN(finalZ)) {
            System.err.println("CRITICAL MATH ERROR: NaN detected for point p" + id);
            return false;
        }

        return updatePoint(id, finalX, finalY, finalZ);
    }

    public boolean rotatePoint(int id, String axis, double degrees, double px, double py, double pz) {
        saveState();
        boolean success = internalRotatePoint(id, axis, degrees, px, py, pz);
        if (success) broadcast();
        return success;
    }

    public boolean rotatePointAroundPivot(int targetId, String axis, double degrees, int pivotId) {
        Point3D pivot = getPoint(pivotId);
        if (pivot == null) return false;
        return rotatePoint(targetId, axis, degrees, pivot.x(), pivot.y(), pivot.z());
    }

    public int rotateCollection(String name, String axis, double degrees) {
        List<Integer> ids = collections.get(name);
        if (ids == null || ids.isEmpty()) return 0;

        double cx = 0, cy = 0, cz = 0;
        int validCount = 0;
        for (Integer id : ids) {
            Point3D p = getPoint(id);
            if (p != null) { cx += p.x(); cy += p.y(); cz += p.z(); validCount++; }
        }

        if (validCount == 0) return 0;
        cx /= validCount; cy /= validCount; cz /= validCount;

        int count = 0;
        for (Integer id : ids) {
            if (internalRotatePoint(id, axis, degrees, cx, cy, cz)) count++;
        }
        if (count > 0) broadcast();
        return count;
    }

    // ==========================
    // ANIMÁCIÓS LOOP
    // ==========================

    public boolean startRotationAnim(int id, String axis, double speed, double px, double py, double pz) {
        Point3D target = getPoint(id);
        if (target == null) return false;

        // JAVÍTVA: Integer.valueOf(id)
        activeAnimations.remove(Integer.valueOf(id));

        // JAVÍTVA: Integer.valueOf(id) a put-nál is
        activeRotationAnims.put(Integer.valueOf(id), new RotationAnimData(
                axis, speed,
                px, py, pz,
                target.x(), target.y(), target.z()
        ));

        return true;
    }

    public boolean startRotationAnimWithPivotId(int id, String axis, double speed, int pivotId) {
        Point3D pivot = getPoint(pivotId);
        if (pivot == null) return false;
        return startRotationAnim(id, axis, speed, pivot.x(), pivot.y(), pivot.z());
    }

    public boolean startAnimation(int id, double tx, double ty, double tz, double spd) {
        Point3D p = getPoint(id);
        if (p == null) return false;

        // JAVÍTVA: Integer.valueOf(id)
        activeRotationAnims.remove(Integer.valueOf(id));

        // JAVÍTVA: Integer.valueOf(id)
        activeAnimations.put(Integer.valueOf(id), new AnimationData(p, tx, ty, tz, spd));
        return true;
    }

    @Scheduled(fixedRate = 33)
    public void gameLoop() {
        if (isPlaying) {
            long now = System.currentTimeMillis();
            double deltaSeconds = (now - lastLoopTime) / 1000.0;
            lastLoopTime = now;

            currentTime += deltaSeconds;

            if (currentTime >= maxTime) {
                currentTime = 0;
            }

            applyTimelineState();
            broadcast();
        } else {
            lastLoopTime = System.currentTimeMillis();
        }
    }

    private void applyTimelineState() {
        for (TimelineClip clip : timelineClips) {
            // ... (idő ellenőrzés ugyanaz marad) ...
            if (currentTime >= clip.startTime && currentTime <= clip.endTime) {

                double totalDuration = clip.endTime - clip.startTime;
                if (totalDuration <= 0) continue;

                double t = (currentTime - clip.startTime) / totalDuration;

                double curX = lerp(clip.sx, clip.ex, t);
                double curY = lerp(clip.sy, clip.ey, t);
                double curZ = lerp(clip.sz, clip.ez, t);

                // JAVÍTÁS: equalsIgnoreCase használata
                if (clip.type.equalsIgnoreCase("MOVE")) {
                    updatePoint(clip.targetId, curX, curY, curZ);
                }
                // (Később ide jöhet a ROTATE ág is)
            }
        }
    }

    private double lerp(double start, double end, double t) {
        return start + t * (end - start);
    }

    // ==========================
    // EGYÉB METÓDUSOK
    // ==========================

    public void saveState() {
        WorldState currentState = getWorldState();
        undoStack.push(currentState);
        if (undoStack.size() > MAX_HISTORY) undoStack.remove(0);
        redoStack.clear();
    }

    public String undo() {
        if (undoStack.isEmpty()) return "Nothing to undo.";
        redoStack.push(getWorldState());
        restoreState(undoStack.pop());
        broadcast();
        return "Undo successful.";
    }

    public String redo() {
        if (redoStack.isEmpty()) return "Nothing to redo.";
        undoStack.push(getWorldState());
        restoreState(redoStack.pop());
        broadcast();
        return "Redo successful.";
    }

    private void restoreState(WorldState state) {
        // 1. Listák törlése és újratöltése
        this.points.clear();
        if (state.points() != null) this.points.addAll(state.points());

        this.connections.clear();
        if (state.connections() != null) this.connections.addAll(state.connections());

        this.faces.clear();
        if (state.faces() != null) this.faces.addAll(state.faces());

        this.collections.clear();
        if (state.collections() != null) this.collections.putAll(state.collections());

        // 2. Animációk és klipek visszaállítása
        this.activeAnimations.clear();
        this.activeRotationAnims.clear();

        this.timelineClips.clear();
        if (state.clips() != null) this.timelineClips.addAll(state.clips());

        // 3. KRITIKUS: ID Számláló (nextId) szinkronizálása!
        // Meg kell keresni a legnagyobb ID-t a visszaállított pontok között,
        // és onnan kell folytatni a számozást.
        int maxId = -1;
        for (Point3D p : this.points) {
            if (p.id() > maxId) {
                maxId = p.id();
            }
        }
        // Ha nincs pont, akkor 0, amúgy maxId + 1
        this.nextId.set(maxId + 1);

        System.out.println("State restored. Next ID set to: " + this.nextId.get());
    }
    // Ezt add hozzá a WorldStateService.java-hoz:
    public void restoreStateFromDb(WorldState state) {
        saveState(); // Elmentjük a jelenlegit az Undo stackbe, biztos ami biztos

        this.points.clear();
        if (state.points() != null) this.points.addAll(state.points());

        this.connections.clear();
        if (state.connections() != null) this.connections.addAll(state.connections());

        this.faces.clear();
        if (state.faces() != null) this.faces.addAll(state.faces());

        this.collections.clear();
        if (state.collections() != null) this.collections.putAll(state.collections());

        this.timelineClips.clear();
        if (state.clips() != null) this.timelineClips.addAll(state.clips());

        this.currentTime = 0;
        this.isPlaying = false;

        // ==============================================
        // JAVÍTÁS: A számláló szinkronizálása (p0 probléma)
        // ==============================================
        int maxId = -1;
        for (Point3D p : this.points) {
            // A te Point3D osztályodban az ID egy int, nem String!
            // Ezért sokkal egyszerűbb dolgunk van:
            if (p.id() > maxId) {
                maxId = p.id();
            }
        }
        // Beállítjuk a következő ID-t a legnagyobb + 1-re
        this.nextId.set(maxId + 1);
        // ==============================================

        broadcast();
    }
    public void addPoint(double x, double y, double z, String color) {
        saveState();
        points.add(new Point3D(nextId.getAndIncrement(), x, y, z, (color == null || color.isEmpty()) ? "orange" : color));
        broadcast();
    }

    public boolean movePointUser(int id, double x, double y, double z) {
        saveState(); // <--- MENTÉS (Csak kézi mozgatásnál)
        return updatePoint(id, x, y, z);
    }

    public boolean updatePoint(int id, double x, double y, double z) {
        if (Double.isNaN(x) || Double.isNaN(y) || Double.isNaN(z)) return false;
        for (int i = 0; i < points.size(); i++) {
            if (points.get(i).id() == id) {
                points.set(i, new Point3D(id, x, y, z, points.get(i).color()));
                // broadcast() itt nincs, mert a loop hívja, vagy a hívó fél
                return true;
            }
        }
        return false;
    }

    public boolean updatePointColor(int id, String color) {
        saveState(); // <--- MENTÉS
        for (int i = 0; i < points.size(); i++) {
            if (points.get(i).id() == id) {
                points.set(i, new Point3D(id, points.get(i).x(), points.get(i).y(), points.get(i).z(), color));
                broadcast(); return true;
            }
        }
        return false;
    }

    public void addConnection(int id1, int id2, String color, double thick) {
        // Ellenőrizzük, hogy létezik-e már (ez a rész maradhat a régiből)
        for (int i = 0; i < connections.size(); i++) {
            Connection c = connections.get(i);
            if ((c.fromId() == id1 && c.toId() == id2) || (c.fromId() == id2 && c.toId() == id1)) {
                saveState();
                // ÚJ: Lekérjük az új anyag adatait, ha változott a szín
                PricingService.MaterialInfo mat = pricingService.getMaterialByColor(color);

                // Frissítjük a kapcsolatot az új adatokkal
                connections.set(i, new Connection(id1, id2, color, thick, mat.name(), mat.pricePerMeter()));
                broadcast();
                return;
            }
        }
        saveState();
        // ÚJ: Ha ez egy teljesen új vonal, akkor is lekérjük az árát
        PricingService.MaterialInfo mat = pricingService.getMaterialByColor(color);

        // Hozzáadjuk a listához a kibővített adatokkal
        connections.add(new Connection(id1, id2, color, thick, mat.name(), mat.pricePerMeter()));
        broadcast();
    }

    public void addFace(List<Integer> ids, String color) { saveState(); faces.add(new Face(ids, color)); broadcast(); }
    public void createCollection(String n, List<Integer> ids) { saveState(); collections.put(n, new ArrayList<>(ids)); broadcast(); }

    // ÚJ: Gyűjtemény törlése név alapján
    public boolean removeCollection(String name) {
        saveState(); // Undo-hoz mentés
        if (collections.remove(name) != null) {
            broadcast(); // Minden kliensnek szólunk
            return true;
        }
        return false;
    }

    // ÚJ: Gyűjtemény átnevezése (ha már itt vagyunk, csináljuk meg rendesen)
    public boolean renameCollection(String oldName, String newName) {
        if (!collections.containsKey(oldName)) return false;

        saveState();
        List<Integer> ids = collections.remove(oldName); // Kivesszük a régit
        collections.put(newName, ids); // Betesszük az újat

        broadcast();
        return true;
    }
    public int addToCollection(String n, List<Integer> ids) {
        saveState();
        collections.putIfAbsent(n, new ArrayList<>());
        List<Integer> list = collections.get(n);
        int c=0;
        for(Integer id : ids) {
            // JAVÍTVA: Integer.valueOf(id)
            if(!list.contains(Integer.valueOf(id))) {
                list.add(Integer.valueOf(id));
                c++;
            }
        }
        broadcast(); return c;
    }

    public int removeFromCollection(String n, List<Integer> ids) {
        saveState();
        if(!collections.containsKey(n)) return 0;
        int c=0;
        for(Integer id : ids) {
            // JAVÍTVA: Integer.valueOf(id)
            if(collections.get(n).remove(Integer.valueOf(id))) c++;
        }
        broadcast(); return c;
    }

    public boolean moveCollection(String name, String axis, double amount) {
        saveState();
        List<Integer> ids = collections.get(name);
        if(ids==null) return false;
        boolean moved = false;
        for(Integer id : ids) {
            Point3D p = getPoint(id);
            if(p!=null) {
                double nx=p.x(), ny=p.y(), nz=p.z();
                switch(axis.toLowerCase()){case "x":nx+=amount;break;case "y":ny+=amount;break;case "z":nz+=amount;break;}
                updatePoint(id, nx, ny, nz); moved=true;
            }
        }
        if(moved) broadcast(); return moved;
    }

    public boolean deletePoint(int id) {
        saveState();
        if(points.removeIf(p->p.id()==id)) {
            connections.removeIf(c->c.fromId()==id||c.toId()==id);

            faces.removeIf(f -> f.pointIds().contains(Integer.valueOf(id)));

            collections.values().forEach(l->l.remove(Integer.valueOf(id)));
            stopAnimation(id);
            broadcast(); return true;
        } return false;
    }

    public boolean deleteConnection(int id1, int id2) { saveState(); if(connections.removeIf(c->(c.fromId()==id1 && c.toId()==id2) || (c.fromId()==id2 && c.toId()==id1))) { broadcast(); return true; } return false; }
    public boolean deleteFace(List<Integer> ids) { saveState(); Set<Integer> s = new HashSet<>(ids); if(faces.removeIf(f->new HashSet<>(f.pointIds()).equals(s))) { broadcast(); return true; } return false; }

    public void clear() {
        saveState();
        points.clear(); connections.clear(); faces.clear(); collections.clear();
        activeAnimations.clear(); activeRotationAnims.clear();
        nextId.set(0);
        broadcast();
    }

    public int startCollectionAnimation(String n, double dx, double dy, double dz, double s) {
        List<Integer> ids=collections.get(n); if(ids==null)return 0;
        int c=0;
        for(Integer id : ids){
            if(startAnimation(id, getPoint(id).x()+dx, getPoint(id).y()+dy, getPoint(id).z()+dz, s)) c++;
        } return c;
    }

    public boolean stopAnimation(int id) {
        boolean changed = false;

        // JAVÍTVA: Integer.valueOf(id)
        RotationAnimData rot = activeRotationAnims.remove(Integer.valueOf(id));
        if (rot != null) {
            updatePoint(id, rot.origX, rot.origY, rot.origZ);
            changed = true;
        }

        // JAVÍTVA: Integer.valueOf(id)
        AnimationData lin = activeAnimations.remove(Integer.valueOf(id));
        if (lin != null) {
            updatePoint(id, lin.startX, lin.startY, lin.startZ);
            changed = true;
        }

        if (changed) {
            broadcast();
            return true;
        }
        return false;
    }

    public void stopAllAnimations() {
        Set<Integer> allActiveIds = new HashSet<>();
        allActiveIds.addAll(activeAnimations.keySet());
        allActiveIds.addAll(activeRotationAnims.keySet());

        for (Integer id : allActiveIds) {
            stopAnimation(id);
        }
    }

    public int stopPoints(List<Integer> ids) {
        int count = 0;
        for (Integer id : ids) {
            if (stopAnimation(id)) {
                count++;
            }
        }
        return count;
    }

    public int stopCollectionAnimation(String n) { List<Integer> ids=collections.get(n); if(ids==null) return 0; int c=0; for(int id:ids) if(stopAnimation(id)) c++; return c; }

    public Point3D getPoint(int id) { return points.stream().filter(p -> p.id() == id).findFirst().orElse(null); }
    public WorldState getWorldState() {
        WorldState worldState = new WorldState(
                new ArrayList<>(points),
                new ArrayList<>(connections),
                new ArrayList<>(faces),
                new HashMap<>(collections),
                this.currentTime,
                this.isPlaying,
                new ArrayList<>(timelineClips) // <--- 7. paraméter: A klipek listája
        );
        return worldState;
    }
    private static class AnimationData {
        double startX, startY, startZ, targetX, targetY, targetZ, speed, progress=0.0; boolean movingForward=true;
        public AnimationData(Point3D p, double tx, double ty, double tz, double s) { startX=p.x(); startY=p.y(); startZ=p.z(); targetX=tx; targetY=ty; targetZ=tz; speed=s; }
    }
    private static class RotationAnimData {
        String axis;
        double speed, px, py, pz;
        double origX, origY, origZ;

        public RotationAnimData(String a, double s, double px, double py, double pz, double ox, double oy, double oz) {
            this.axis = a;
            this.speed = s;
            this.px = px; this.py = py; this.pz = pz;
            this.origX = ox; this.origY = oy; this.origZ = oz;
        }
    }

    public List<Integer> getCollectionIds(String name) {
        if (collections.containsKey(name)) {
            return new ArrayList<>(collections.get(name));
        }
        return null;
    }

    public int startGroupRotationAnim(List<Integer> ids, String axis, double speed, double px, double py, double pz) {
        int count = 0;
        for (Integer id : ids) {
            if (startRotationAnim(id, axis, speed, px, py, pz)) {
                count++;
            }
        }
        return count;
    }

    public int startGroupRotationAnimWithPivotId(List<Integer> ids, String axis, double speed, int pivotId) {
        Point3D pivot = getPoint(pivotId);
        if (pivot == null) return 0;
        return startGroupRotationAnim(ids, axis, speed, pivot.x(), pivot.y(), pivot.z());
    }

    public static class TimelineClip {
        public String id;
        public String name; // <--- ÚJ MEZŐ
        public int targetId;
        public String type;
        public double startTime;
        public double endTime;
        public double sx, sy, sz;
        public double ex, ey, ez;

        public TimelineClip() {
            // A MongoDB-nek szüksége van erre!
        }

        public TimelineClip(String name, int targetId, String type, double start, double end,
                            double sx, double sy, double sz,
                            double ex, double ey, double ez) {
            this.id = UUID.randomUUID().toString();
            // Ha nincs név megadva, generálunk egyet (pl. "Move p0")
            this.name = (name == null || name.isEmpty()) ? type + " p" + targetId : name;
            this.targetId = targetId;
            this.type = type;
            this.startTime = start;
            this.endTime = end;
            this.sx = sx; this.sy = sy; this.sz = sz;
            this.ex = ex; this.ey = ey; this.ez = ez;
        }
    }

    // ==========================
    // TIMELINE VEZÉRLÉS
    // ==========================

    public void play() {
        this.isPlaying = true;
        this.lastLoopTime = System.currentTimeMillis();
    }

    public void pause() {
        this.isPlaying = false;
    }

    public void stop() {
        this.isPlaying = false;
        this.currentTime = 0.0; // Visszaállítjuk az időt az elejére

        // FONTOS: Azonnal kiszámoljuk, hol kell lenniük a pontoknak 0 másodpercnél
        applyTimelineState();

        // És leküldjük a frissítést a frontendnek (hogy a csúszka és a piros vonal is visszaugorjon)
        broadcast();
    }

    public void seek(double time) {
        this.currentTime = Math.max(0, Math.min(time, maxTime));
        applyTimelineState();
        broadcast();
    }

    public void addClip(int targetId, String type, double start, double end, double tx, double ty, double tz, String name) {
        saveState();
        Point3D p = getPoint(targetId);
        if (p == null) return;

        double sx = p.x(), sy = p.y(), sz = p.z();
        if (type.startsWith("ROTATE")) { sx=0; sy=0; sz=0; }

        // Átadjuk a nevet a konstruktornak
        timelineClips.add(new TimelineClip(name, targetId, type, start, end, sx, sy, sz, tx, ty, tz));

        if (end > maxTime) maxTime = end + 5.0;
        broadcast();
    }

    public void addClipExplicit(int targetId, String type, double start, double end,
                                double sx, double sy, double sz,
                                double ex, double ey, double ez) {
        saveState();
        timelineClips.add(new TimelineClip("", targetId, type, start, end, sx, sy, sz, ex, ey, ez));

        if (end > maxTime) maxTime = end + 5.0;
    }

    public int deleteClip(String name) {
        saveState();
        int prevSize = timelineClips.size();

        timelineClips.removeIf(c -> c.name.trim().equals(name.trim()));

        int deletedCount = prevSize - timelineClips.size();

        if (deletedCount > 0) {
            broadcast();
        }
        return deletedCount;
    }
    public boolean updateClip(String clipId, String newName, double newStart, double newEnd) {

        boolean found = timelineClips.stream().anyMatch(c -> c.id.equals(clipId));
        if(found) saveState();

        for (TimelineClip clip : timelineClips) {
            if (clip.id.equals(clipId)) {
                if (newStart < 0) newStart = 0;
                if (newEnd <= newStart) newEnd = newStart + 0.1;

                clip.name = newName;
                clip.startTime = newStart;
                clip.endTime = newEnd;

                if (newEnd > maxTime) maxTime = newEnd + 5.0;

                broadcast();
                return true;
            }
        }
        return false;
    }
    // Ezt a metódust add hozzá a WorldStateService osztályhoz!
    public boolean deleteClipById(String id) {
        saveState();
        // ID alapján keresünk és törlünk a listából
        // A removeIf igazat ad vissza, ha talált és törölt valamit

        boolean removed = timelineClips.removeIf(c -> c.id.equals(id));

        if (removed) {
            broadcast(); // Frissítjük a klienst
        } else {
            System.out.println("Warning: Clip with ID " + id + " not found.");
        }
        return removed;
    }
}