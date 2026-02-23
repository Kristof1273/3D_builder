package com.kristof._D_builder;

import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.stereotype.Controller;

@Controller
public class CommandController {

    private final CommandParserService commandParserService;
    private final WorldStateService worldStateService;

    // Bekötjük a segítőinket (Constructor Injection)
    public CommandController(CommandParserService commandParserService, WorldStateService worldStateService) {
        this.commandParserService = commandParserService;
        this.worldStateService = worldStateService;
    }

    // A frontend ide küldi az üzenetet: /app/send-command
    @MessageMapping("/send-command")

    // A válasz automatikusan ide megy: /topic/world-updates
    // FONTOS: A visszatérési típus itt változott meg List<Point3D>-ről WorldState-re!
    @SendTo("/topic/world-updates")
    public WorldState handleCommand(String command) {

        System.out.println("Parancs érkezett: " + command);

        // 1. Feldolgozzuk a parancsot (pl. hozzáadja a pontot vagy összeköti őket)
        String result = commandParserService.processCommand(command);
        System.out.println("Eredmény: " + result);

        // 2. Visszaküldjük a TELJES világ állapotát (pontok + vonalak)
        // Most már a getWorldState() metódust hívjuk, ami mindent tartalmaz
        return worldStateService.getWorldState();
    }
}