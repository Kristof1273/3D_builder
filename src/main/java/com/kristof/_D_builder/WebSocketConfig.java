package com.kristof._D_builder;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker // Ez kapcsolja be a "varázslatot"
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Ide küldi a szerver az adatokat (mint egy rádióadó)
        // A frontend erre a csatornára ("topic") fog feliratkozni.
        config.enableSimpleBroker("/topic");

        // Ide küldi a frontend a parancsokat (mint egy betelefonálós műsor)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Ez a "Bejárat" (Endpoint). Ide csatlakozik a React.
        // A setAllowedOriginPatterns("*") nagyon fontos, hogy engedje a csatlakozást máshonnan is!
        registry.addEndpoint("/3d-ws")
                .setAllowedOriginPatterns("*")
                .withSockJS(); // Ez segít, ha a böngésző nem támogatná a sima WebSocketet
    }
}