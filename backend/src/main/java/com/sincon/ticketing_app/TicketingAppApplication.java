package com.sincon.ticketing_app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

import io.github.cdimascio.dotenv.Dotenv;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeIn;
import io.swagger.v3.oas.annotations.enums.SecuritySchemeType;
import io.swagger.v3.oas.annotations.security.OAuthFlow;
import io.swagger.v3.oas.annotations.security.OAuthFlows;
import io.swagger.v3.oas.annotations.security.SecurityScheme;

@SpringBootApplication
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
@SecurityScheme(
    name = "keycloak", 
    type = SecuritySchemeType.OAUTH2, 
    bearerFormat = "JWT", 
    scheme = "bearer", 
    in = SecuritySchemeIn.HEADER, 
    flows = @OAuthFlows(password = @OAuthFlow(authorizationUrl 
    = "http://localhost:9090/realms/ticket_tool/protocol/openid-connect/auth", 
    tokenUrl = "http://localhost:9090/realms/ticket_tool/protocol/openid-connect/token"))
    )
public class TicketingAppApplication {

	public static void main(String[] args) {
		Dotenv dotenv = null;
        try {
            // SPECIFICA LA DIRECTORY "backend" dove si trova ini.env
            dotenv = Dotenv.configure()
                           .directory("backend") // Il file ini.env è qui, rispetto alla working directory
                           .filename("ini.env")
                           .load();
            System.out.println("ini.env loaded successfully!");
        } catch (io.github.cdimascio.dotenv.DotenvException e) {
            System.err.println("Failed to load ini.env: " + e.getMessage());
            System.err.println("Please ensure 'ini.env' is in the 'backend' directory relative to the working directory: " + System.getProperty("user.dir"));
            // Termina l'applicazione se non può caricare le variabili essenziali
            System.exit(1);
        }

		// Se vuoi rendere le variabili disponibili come proprietà di sistema
		dotenv.entries().forEach(entry -> System.setProperty(entry.getKey(), entry.getValue()));
		SpringApplication.run(TicketingAppApplication.class, args);
	}
}
