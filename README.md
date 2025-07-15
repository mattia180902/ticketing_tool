Progetto Applicazione di Ticketing

Questo repository contiene il codice sorgente completo per l'applicazione di ticketing, composta da un'interfaccia utente (frontend) sviluppata con Angular e un'API di backend basata su Spring Boot.

🚀 Panoramica del Progetto
L'applicazione di ticketing è una soluzione completa per la gestione delle richieste di supporto. Permette agli utenti di creare ticket, agli agenti di supporto (Helper, PM, Admin) di gestirli, assegnarli, rispondere e risolverli. Include funzionalità di auto-salvataggio delle bozze, gestione dei ruoli utente e un flusso di lavoro intuitivo per l'intero ciclo di vita del ticket.

💻 Frontend: Applicazione Angular

📄 Panoramica
Il frontend è l'interfaccia utente dell'applicazione, sviluppata per essere reattiva e intuitiva, fornendo un'esperienza utente fluida per la creazione e la gestione dei ticket.

🛠️ Tecnologie Utilizzate
Angular: Framework per la costruzione di applicazioni web.
TypeScript: Linguaggio di programmazione tipizzato.
PrimeNG: Libreria di componenti UI per Angular, utilizzata per un'interfaccia utente pulita e funzionale.
RxJS: Libreria per la programmazione reattiva.
HTML5 / CSS3 (SCSS): Per la struttura e lo stile dell'applicazione.
AuthService: Servizio personalizzato per la gestione dell'autenticazione e dei ruoli utente.
📂 Struttura del Progetto Frontend (Alto Livello)
frontend/
├── src/
│   ├── app/
│   │   ├── core/           # Moduli core, intercettori, servizi base
│   │   ├── modules/        # Moduli specifici per funzionalità (es. ticket, user)
│   │   │   ├── ticket/
│   │   │   │   ├── components/ # Componenti riutilizzabili (es. draft-edit, new-ticket)
│   │   │   │   ├── service/   # Servizi specifici per il modulo ticket
│   │   │   │   └── ...
│   │   │   └── ...
│   │   ├── services/       # Servizi globali generati da openapi
│   │   ├── shared/         # Componenti, direttive, pipe, enums condivisi
│   │   └── ...
│   ├── assets/             # Risorse statiche (immagini, icone)
│   ├── environments/       # Configurazioni ambiente
│   └── ...
├── angular.json            # Configurazione del progetto Angular
├── package.json            # Dipendenze e script NPM
└── tsconfig.json           # Configurazione TypeScript

⚙️ Setup e Avvio (Frontend)
Prerequisiti
Node.js (versione consigliata: 18.x o superiore)
npm (solitamente installato con Node.js)
Angular CLI (installalo globalmente con npm install -g @angular/cli)
Installazione
Clona il repository:
git clone https://github.com/mattia180902/ticketing_tool.git
cd frontend/ticketing_app_ui

Installa le dipendenze:
npm install

Avvio dell'Applicazione
Per avviare l'applicazione in modalità di sviluppo:
ng serve

L'applicazione sarà disponibile su http://localhost:4200/. Le modifiche al codice verranno ricaricate automaticamente.

Build per la Produzione
Per creare una build ottimizzata per la produzione:
ng build --configuration production

I file generati si troveranno nella directory dist/.

✨ Funzionalità Chiave (Frontend)
Gestione Utenti e Ruoli: Login, registrazione e gestione dei permessi basata sui ruoli (USER, HELPER_JUNIOR, HELPER_SENIOR, PM, ADMIN).
Creazione e Modifica Ticket: Form intuitivi per la creazione di nuovi ticket e la modifica di bozze esistenti.
Auto-salvataggio Bozza: Le bozze dei ticket vengono salvate automaticamente durante la digitazione, con logica condizionale per Admin/Helper/PM.
Pre-compilazione Dati Utente: Caricamento automatico di Codice Fiscale e Numero di Telefono per gli utenti USER quando modificano le proprie bozze.
Validazione Condizionale: Il pulsante "Finalizza Bozza/Ticket" si abilita solo quando tutti i campi obbligatori sono validi, tenendo conto della selezione dell'email del proprietario.
Selezione Bozza: Possibilità di caricare bozze esistenti da un elenco filtrato.
Notifiche: Utilizzo di PrimeNG Toast per feedback utente.

--------------------------------------
🖥️ Backend: Applicazione Spring Boot

📄 Panoramica
Il backend fornisce le API RESTful per la gestione dei ticket, degli utenti, delle categorie e dei servizi di supporto. È costruito con Spring Boot per garantire robustezza e scalabilità.

🛠️ Tecnologie Utilizzate
Spring Boot: Framework per la creazione di applicazioni Java stand-alone e di produzione.
Spring Data JPA: Per l'interazione con il database.
Hibernate: Implementazione di JPA.
Maven: Strumento di gestione del progetto e delle dipendenze.
PostgreSQL: Per la persistenza dei dati.
Spring Security / Keycloak: Per l'autenticazione e l'autorizzazione (integrazione con Keycloak per la gestione utenti).
Lombok: Per ridurre il boilerplate code.
Java: Linguaggio di programmazione.

📂 Struttura del Progetto Backend (Alto Livello)
backend/
├── ini.env                     # File per variabili d'ambiente (es. credenziali email)
├── mvnw                        # Wrapper Maven per Linux/macOS
├── mvnw.cmd                    # Wrapper Maven per Windows
├── pom.xml                     # File di configurazione Maven
└── src/
    ├── main/
    │   ├── java/com/sincon/ticketing_app/ # Codice sorgente Java
    │   │   ├── category/       # Gestione categorie
    │   │   ├── common/         # Classi comuni (es. Auditable)
    │   │   ├── config/         # Configurazioni Spring (es. SecurityConfig)
    │   │   ├── enums/          # Enumerazioni (es. TicketStatus, UserRole)
    │   │   ├── exception/      # Eccezioni personalizzate
    │   │   ├── interceptor/    # Intercettori HTTP (es. UserSynchronizerFilter)
    │   │   ├── notification/   # Servizi di notifica (es. EmailService)
    │   │   ├── security/       # Configurazione sicurezza (Keycloak JWT)
    │   │   ├── supportservice/ # Gestione servizi di supporto
    │   │   ├── ticket/         # Logica e entità ticket
    │   │   ├── ticketHistory/  # Storico ticket
    │   │   └── user/           # Gestione utenti
    │   └── resources/
    │       ├── META-INF/
    │       │   └── additional-spring-configuration-metadata.json # Metadati di configurazione
    │       └── application.yml # Configurazioni dell'applicazione
    └── test/                   # Test unitari e di integrazione


⚙️ Setup e Avvio (Backend)
Prerequisiti
Java Development Kit (JDK) 17 o superiore
Maven (versione consigliata: 3.2.x o superiore)
Un'istanza di database (es. PostgreSQL) in esecuzione.
(Opzionale) Un'istanza di Keycloak configurata per la gestione degli utenti.
Installazione
Clona il repository:
git clone https://github.com/mattia180902/ticketing_tool.git
cd backend

Installa le dipendenze Maven:
mvn clean install

Il file di configurazione principale è src/main/resources/application.yml. Ecco i dettagli importanti:
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/ticket_tool # URL del database PostgreSQL
    username: username                               # Username del database
    password: password                               # Password del database
  jpa:
    hibernate:
      ddl-auto: update                               # Strategia DDL di Hibernate
    show-sql: true                                   # Mostra le query SQL nei log
    properties:
      hibernate:
        format_sql: true                             # Formatta le query SQL
    database: postgresql
    database-platform: org.hibernate.dialect.PostgreSQLDialect
  flyway:
    enabled: false                                   # Flyway disabilitato
  security:
    oauth2:
      resourceserver:
        jwt:
          issuer-uri: http://localhost:9090/realms/ticket_tool # Issuer URI per Keycloak
  servlet:
    multipart:
      max-file-size: 50MB                            # Dimensione massima file upload
  mail:
    host: smtp.gmail.com                             # Host SMTP per l'invio email
    port: 587                                        # Porta SMTP
    username: ${MAIL_USERNAME}                       # Username email (da ini.env)
    password: ${MAIL_PASSWORD}                       # Password email (da ini.env)
    properties:
      mail:
        smtp:
          auth: true
          starttls:
            enable: true
        debug: true                                  # Log di debug per email (opzionale)

springdoc:
  default-produces-media-type: application/json
  
application:
  file:
    uploads:
      media-output-path: ./uploads                   # Percorso per gli upload di file

logging:
  level:
    '[com.sincon.ticketing_app]': debug              # Livello di logging per il pacchetto dell'applicazione

Variabili d'ambiente (ini.env): Crea un file ini.env nella root della directory backend con le tue credenziali email per l'invio delle notifiche:
MAIL_USERNAME=tua_email@gmail.com
MAIL_PASSWORD=tua_password_app_o_specifica

Importante: Per le password di Gmail, potresti dover generare una "Password per app" se hai l'autenticazione a due fattori abilitata.
Avvio con Docker Compose (Raccomandato)
Il file docker-compose.yml è configurato per avviare un database PostgreSQL e un'istanza di Keycloak, fornendo l'ambiente necessario per il backend.
services:
  postgres:
    container_name: postgres-sql-ticket
    image: postgres
    environment:
      POSTGRES_USER: username
      POSTGRES_PASSWORD: password
      PGDATA: /var/lib/postgresql/data
      POSTGRES_DB: ticket_tool # Nome del database, deve corrispondere a spring.datasource.url
    volumes:
      - postgres:/data/postgres # Persistenza dei dati del database
    ports:
      - 5432:5432 # Mappa la porta del container alla porta locale
    networks:
      - ticketing_tool
    restart: unless-stopped # Riavvia il container a meno che non sia fermato manualmente

  keycloak:
    container_name: keycloak-ticket
    image: quay.io/keycloak/keycloak:26.0.0 # Immagine Keycloak
    ports:
      - 9090:8080  # Mappa la porta 8080 del container (Keycloak) alla porta 9090 locale
    environment:
      KEYCLOAK_ADMIN: admin # Credenziali utente amministratore di Keycloak
      KEYCLOAK_ADMIN_PASSWORD: admin
    networks:
      - ticketing_tool
    command:
      - "start-dev" # Avvia Keycloak in modalità sviluppo

networks:
  ticketing_tool:
    driver: bridge # Crea un network Docker per i servizi

volumes:
  postgres:
    driver: local # Definisce un volume locale per PostgreSQL

Per avviare i servizi con Docker Compose:
Assicurati di avere Docker e Docker Compose installati.
Apri il terminale nella directory di origine del progetto, dove si trova il file docker-compose.yml.
Esegui il comando:
docker-compose up -d


Questo avvierà PostgreSQL e Keycloak in background.
Configurazione di Keycloak
Dopo aver avviato Keycloak con Docker Compose, sarà disponibile su http://localhost:9090.
Accedi alla console di amministrazione (http://localhost:9090/admin) con le credenziali admin/admin (o quelle che hai configurato nel docker-compose.yml).
Crea un nuovo realm (es. ticket_tool) o usa quello master.
Configura client, ruoli e utenti come richiesto dalla tua applicazione. Assicurati che l'issuer-uri nel tuo application.yml corrisponda al realm che stai usando (es. http://localhost:9090/realms/ticket_tool).
Avvio dell'Applicazione Spring Boot (dopo Docker Compose)
Una volta che PostgreSQL e Keycloak sono in esecuzione tramite Docker Compose, puoi avviare il backend Spring Boot:
Assicurati di essere nella directory backend.
Compila il progetto:
mvn clean install

Avvia l'applicazione:
mvn spring-boot:run

L'API sarà disponibile su http://localhost:8080/

Esecuzione dei Test
mvn test

✨ Funzionalità Chiave (Backend)
API RESTful: Endpoint per la gestione completa di ticket, categorie, servizi di supporto e utenti.
Gestione Ticket: Creazione, lettura, aggiornamento (inclusa la finalizzazione delle bozze) ed eliminazione dei ticket.
Validazione Dati: Validazione robusta dei dati in ingresso per garantire l'integrità.
Sicurezza: Integrazione con Spring Security per l'autenticazione JWT (tramite Keycloak) e l'autorizzazione basata sui ruoli.
Logica di Business: Implementazione della logica per l'auto-salvataggio delle bozze, l'assegnazione dei ticket e la gestione degli stati.
Gestione Eccezioni: Gestione centralizzata delle eccezioni per risposte API coerenti.
Notifiche Email: Invio di notifiche via email per eventi importanti (es. creazione ticket, assegnazione).
Documentazione API: Swagger UI disponibile all'indirizzo: http://localhost:8080/swagger-ui/index.html#/

🚀 Deployment
Frontend: L'applicazione Angular può essere deployata su qualsiasi server web statico (es. Nginx, Apache, Netlify, Vercel) dopo aver eseguito ng build --configuration production.
Backend: L'applicazione Spring Boot può essere impacchettata come un file JAR eseguibile (java -jar target/ticketing_app-0.0.1-SNAPSHOT.jar) e deployata su un server (es. un'istanza EC2, un container Docker, un servizio cloud come Heroku o Google Cloud Run).
🤝 Contribuire
I contributi sono benvenuti! Se desideri contribuire, per favore:
Forka il repository.
Crea un nuovo branch (git checkout -b feature/nome-funzionalita).
Implementa le tue modifiche.
Scrivi test appropriati.
Esegui i test e assicurati che passino.
Effettua il commit delle tue modifiche (git commit -m 'feat: aggiunta nuova funzionalità').
Effettua il push del branch (git push origin feature/nome-funzionalita).
Apri una Pull Request.
📄 Licenza

Questo progetto è rilasciato sotto la licenza MIT License.
Sviluppato By Mattia Colucci.

