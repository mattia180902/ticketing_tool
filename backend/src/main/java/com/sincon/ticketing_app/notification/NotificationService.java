package com.sincon.ticketing_app.notification;

/* import com.sincon.ticketing_app.ticket.Ticket;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class NotificationService {

    private final JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromAddress;

    private SimpleMailMessage baseMessage(String to, String subject, String content) {
        SimpleMailMessage msg = new SimpleMailMessage();
        msg.setFrom(fromAddress);
        msg.setTo(to);
        msg.setSubject(subject);
        msg.setText(content);
        return msg;
    }
    

    // Email di creazione ticket all'utente proprietario
    public void sendTicketCreationEmail(Ticket ticket) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(ticket.getEmail());
        message.setSubject("Ticket Created: " + ticket.getId());
        message.setText("Your ticket has been successfully created.\n\n" +
                        "Ticket ID: " + ticket.getId() + "\n" +
                        "Title: " + ticket.getTitle() + "\n" +
                        "Description: " + ticket.getDescription() + "\n" +
                        "Status: " + ticket.getStatus() + "\n\n" +
                        "You will be notified when it is taken in charge.");
        mailSender.send(message);
    }

    // Email di assegnazione ticket all'helper
    public void sendTicketAssignedEmail(Ticket ticket) {
        if (ticket.getAssignedTo() == null) return;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(ticket.getAssignedTo().getEmail());
        message.setSubject("New Ticket Assigned: " + ticket.getId());
        message.setText("You have been assigned a new ticket.\n\n" +
                        "Ticket ID: " + ticket.getId() + "\n" +
                        "Title: " + ticket.getTitle() + "\n" +
                        "Description: " + ticket.getDescription() + "\n" +
                        "Status: " + ticket.getStatus() + "\n\n" +
                        "Please log in to the Ticketing System to manage this ticket.");
        mailSender.send(message);
    }

    // Email di cambio stato ticket all'utente proprietario
    public void sendTicketStatusUpdateEmail(Ticket ticket) {
        if (ticket.getEmail() == null) return;
    
        String content = String.format("""
            The status of your ticket has been updated.
    
            Ticket ID: %s
            Title: %s
            New Status: %s
    
            Please log in to the Ticketing System for details.
            """, ticket.getId(), ticket.getTitle(), ticket.getStatus());

        mailSender.send(baseMessage(ticket.getEmail(), "Ticket Status Updated: " + ticket.getId(), content));
    }
    

    // Email di riassegnazione ticket al nuovo helper
    public void sendTicketReassignedEmail(Ticket ticket) {
        if (ticket.getAssignedTo() == null) return;

        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromAddress);
        message.setTo(ticket.getAssignedTo().getEmail());
        message.setSubject("Ticket Reassigned: " + ticket.getId());
        message.setText("A ticket has been reassigned to you.\n\n" +
                        "Ticket ID: " + ticket.getId() + "\n" +
                        "Title: " + ticket.getTitle() + "\n" +
                        "Description: " + ticket.getDescription() + "\n" +
                        "Status: " + ticket.getStatus() + "\n\n" +
                        "Please log in to the Ticketing System to take charge.");
        mailSender.send(message);
    }
} */
