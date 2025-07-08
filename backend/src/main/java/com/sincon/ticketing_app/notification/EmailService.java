package com.sincon.ticketing_app.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import com.sincon.ticketing_app.ticket.Ticket;
import com.sincon.ticketing_app.user.User;
import org.springframework.beans.factory.annotation.Value;

import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    // Lista di provider di email comuni (puoi espanderla)
    private static final Set<String> COMMON_EMAIL_PROVIDERS = new HashSet<>(Arrays.asList(
        "gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "aol.com",
        "icloud.com", "protonmail.com", "mail.com", "inwind.it", "libero.it", "alice.it", "pec.it", "sincon.com" // Aggiunto il tuo dominio
    ));

    private SimpleMailMessage createBaseMessage(String to, String subject, String content) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(fromAddress);
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(content);
        return msg;
    }

    /**
     * Verifica se il dominio dell'email appartiene a un provider comune.
     * Questo metodo è quello che useremo per la validazione.
     * @param email L'indirizzo email da controllare.
     * @return true se il provider è riconosciuto, false altrimenti.
     */
    public boolean isValidEmailProvider(String email) {
        if (email == null || !email.contains("@")) {
            return false;
        }
        String domain = email.substring(email.indexOf("@") + 1).toLowerCase();
        return COMMON_EMAIL_PROVIDERS.contains(domain);
    }

    /**
     * Invia un'email solo se il provider è valido.
     * @param to Destinatario
     * @param subject Oggetto
     * @param body Corpo dell'email
     */
    @Async // Esegui in un thread separato
    public void sendValidatedEmail(String to, String subject, String body) {
        if (!isValidEmailProvider(to)) {
            log.warn("Email provider for {} is not recognized or invalid. Email not sent.", to);
            return;
        }
        try {
            SimpleMailMessage message = createBaseMessage(to, subject, body);
            mailSender.send(message);
            log.info("Email inviata con successo a: {} con oggetto: {}", to, subject);
        } catch (MailException e) {
            log.error("Errore nell'invio dell'email a {} con oggetto {}: {}", to, subject, e.getMessage());
        }
    }

    // Metodi specifici per tipo di notifica, che usano sendValidatedEmail

    public void sendTicketCreationEmail(Ticket ticket) {
        String subject = "Nuovo Ticket Creato: " + ticket.getId();
        String body = String.format("""
            Il tuo ticket è stato creato con successo.
            
            ID Ticket: %d
            Oggetto: %s
            Descrizione: %s
            Stato: %s
            
            Sarai notificato quando verrà preso in carico.
            """, ticket.getId(), ticket.getTitle(), ticket.getDescription(), ticket.getStatus());
        
        sendValidatedEmail(ticket.getEmail(), subject, body);
    }

    public void sendTicketAssignedEmail(Ticket ticket, User assignee) {
        if (assignee == null || assignee.getEmail() == null) {
            log.warn("Tentativo di inviare email di assegnazione ticket senza assegnatario o email per ticket {}", ticket.getId());
            return;
        }
        String subject = "Nuovo Ticket Assegnato: " + ticket.getId();
        String body = String.format("""
            Ti è stato assegnato un nuovo ticket.
            
            ID Ticket: %d
            Oggetto: %s
            Descrizione: %s
            Stato: %s
            
            Accedi al sistema di Ticketing per gestire questo ticket.
            """, ticket.getId(), ticket.getTitle(), ticket.getDescription(), ticket.getStatus());
        
        sendValidatedEmail(assignee.getEmail(), subject, body);
    }

    public void sendTicketStatusUpdateEmail(Ticket ticket) {
        String subject = "Stato Ticket Aggiornato: " + ticket.getId();
        String body = String.format("""
            Lo stato del tuo ticket è stato aggiornato.
            
            ID Ticket: %d
            Oggetto: %s
            Nuovo Stato: %s
            
            Accedi al sistema di Ticketing per i dettagli.
            """, ticket.getId(), ticket.getTitle(), ticket.getStatus());
        
        sendValidatedEmail(ticket.getEmail(), subject, body);
    }

    public void sendTicketReassignedEmail(Ticket ticket, User oldAssignee, User newAssignee) {
        if (newAssignee == null || newAssignee.getEmail() == null) {
            log.warn("Tentativo di inviare email di riassegnazione ticket senza nuovo assegnatario o email per ticket {}", ticket.getId());
            return;
        }
        String subject = "Ticket Riassegnato: " + ticket.getId();
        String body = String.format("""
            Un ticket ti è stato riassegnato.
            
            ID Ticket: %d
            Oggetto: %s
            Descrizione: %s
            Stato: %s
            Assegnato precedentemente a: %s %s
            
            Accedi al sistema di Ticketing per prenderne carico.
            """, ticket.getId(), ticket.getTitle(), ticket.getDescription(), ticket.getStatus(),
            oldAssignee != null ? oldAssignee.getFirstName() + " " + oldAssignee.getLastName() : "N/A",
            oldAssignee != null ? "(" + oldAssignee.getEmail() + ")" : "");
        
        sendValidatedEmail(newAssignee.getEmail(), subject, body);

        // Notifica anche il vecchio assegnatario che il ticket è stato riassegnato
        if (oldAssignee != null && oldAssignee.getEmail() != null && !oldAssignee.equals(newAssignee)) {
            String oldAssigneeSubject = "Ticket Riassegnato da Te: " + ticket.getId();
            String oldAssigneeBody = String.format("""
                Il ticket con ID %d è stato riassegnato da te a %s %s.
                
                Oggetto: %s
                Stato attuale: %s
                """, ticket.getId(), newAssignee.getFirstName(), newAssignee.getLastName(), ticket.getTitle(), ticket.getStatus());
            sendValidatedEmail(oldAssignee.getEmail(), oldAssigneeSubject, oldAssigneeBody);
        }
    }

    /**
     * Invia un'email quando un ticket viene de-assegnato.
     * @param ticket Il ticket de-assegnato.
     * @param oldAssignee Il precedente assegnatario.
     */
    public void sendTicketDeassignedEmail(Ticket ticket, User oldAssignee) {
        if (oldAssignee == null || oldAssignee.getEmail() == null) {
            log.warn("Tentativo di inviare email di de-assegnazione ticket senza vecchio assegnatario o email per ticket {}", ticket.getId());
            return;
        }
        String subject = "Ticket De-assegnato: " + ticket.getId();
        String body = String.format("""
            Il ticket con ID %d, che ti era stato assegnato, è stato de-assegnato.
            
            Oggetto: %s
            Descrizione: %s
            Stato attuale: %s
            
            Non sei più responsabile di questo ticket.
            """, ticket.getId(), ticket.getTitle(), ticket.getDescription(), ticket.getStatus());
        
        sendValidatedEmail(oldAssignee.getEmail(), subject, body);
    }

    public void sendTicketRejectedEmail(Ticket ticket, User oldAssignee, User newAssignee) {
        if (newAssignee == null || newAssignee.getEmail() == null) {
            log.warn("Tentativo di inviare email di rifiuto ticket senza nuovo assegnatario o email per ticket {}", ticket.getId());
            return;
        }
        String subject = "Ticket Rifiutato e Riassegnato: " + ticket.getId();
        String body = String.format("""
            Il ticket con ID %d è stato rifiutato dall'assegnatario precedente (%s %s) e riassegnato a te.
            
            Oggetto: %s
            Stato: %s
            
            Accedi al sistema di Ticketing per prenderne carico.
            """, ticket.getId(), oldAssignee != null ? oldAssignee.getFirstName() + " " + oldAssignee.getLastName() : "N/A",
            oldAssignee != null ? "(" + oldAssignee.getEmail() + ")" : "",
            ticket.getTitle(), ticket.getStatus());
        
        sendValidatedEmail(newAssignee.getEmail(), subject, body);

        // Notifica l'utente proprietario del ticket
        String userSubject = "Il Tuo Ticket è stato Rifiutato e Riassegnato: " + ticket.getId();
        String userBody = String.format("""
            Il tuo ticket con ID %d è stato rifiutato dall'assegnatario precedente e riassegnato a %s %s.
            
            Oggetto: %s
            Stato attuale: %s
            
            Accedi al sistema di Ticketing per i dettagli.
            """, ticket.getId(), newAssignee.getFirstName(), newAssignee.getLastName(), ticket.getTitle(), ticket.getStatus());
        sendValidatedEmail(ticket.getEmail(), userSubject, userBody);

        // Notifica il vecchio assegnatario che il ticket è stato riassegnato
        if (oldAssignee != null && oldAssignee.getEmail() != null && !oldAssignee.equals(newAssignee)) {
            String oldAssigneeSubject = "Ticket Rifiutato da Te: " + ticket.getId();
            String oldAssigneeBody = String.format("""
                Il ticket con ID %d è stato rifiutato da te e riassegnato a %s %s.
                
                Oggetto: %s
                Stato attuale: %s
                """, ticket.getId(), newAssignee.getFirstName(), newAssignee.getLastName(), ticket.getTitle(), ticket.getStatus()); // Corretto qui
            sendValidatedEmail(oldAssignee.getEmail(), oldAssigneeSubject, oldAssigneeBody);
        }
    }

    public void sendTicketDeletedEmail(Ticket ticket) {
        String subject = "Ticket Eliminato: " + ticket.getId();
        String body = String.format("""
            Il ticket con ID %d è stato eliminato dal sistema.
            
            Oggetto: %s
            """, ticket.getId(), ticket.getTitle());
        
        sendValidatedEmail(ticket.getEmail(), subject, body);

        if (ticket.getAssignedTo() != null && ticket.getAssignedTo().getEmail() != null) {
            String assigneeSubject = "Ticket Eliminato (Assegnato a Te): " + ticket.getId();
            String assigneeBody = String.format("""
                Il ticket con ID %d, che ti era stato assegnato, è stato eliminato dal sistema.
                
                Oggetto: %s
                """, ticket.getId(), ticket.getTitle());
            sendValidatedEmail(ticket.getAssignedTo().getEmail(), assigneeSubject, assigneeBody);
        }
    }
}
