package com.kristof._D_builder;

import org.springframework.stereotype.Service;
import java.util.HashMap;
import java.util.Map;

@Service
public class PricingService {

    // Ez tárolja az árakat: Színkód -> Anyag Info
    private static final Map<String, MaterialInfo> MATERIAL_DB = new HashMap<>();

    static {
        // ITT DEFINIÁLD A TERMÉKEIDET:
        // Szín (HEX)       |  Megnevezés              | Ár (Ft/méter)
        MATERIAL_DB.put("#ffffff", new MaterialInfo("Standard Acélrúd", 1500.0));
        MATERIAL_DB.put("#ff0000", new MaterialInfo("Erősített Gerenda", 3200.0));
        MATERIAL_DB.put("#0000ff", new MaterialInfo("Alumínium Profil", 2100.0));
        MATERIAL_DB.put("#00ff00", new MaterialInfo("Dekorcsík", 500.0));
    }

    public MaterialInfo getMaterialByColor(String color) {
        // Ha olyan színt kapunk, ami nincs a listában, adunk egy alapértelmezettet
        return MATERIAL_DB.getOrDefault(color.toLowerCase(), new MaterialInfo("Ismeretlen Anyag", 0.0));
    }

    // Egy kis segédosztály az adatoknak (Record)
    public record MaterialInfo(String name, double pricePerMeter) {}
}