package com.sincon.ticketing_app.ticket;

import org.springframework.data.jpa.domain.Specification;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.supportservice.SupportService;

import jakarta.persistence.criteria.Join;
public class TicketSpecifications {

    // 1. Specifica per filtrare per ID del proprietario (owner)
    public static Specification<Ticket> byOwnerId(String ownerId) {
        return (root, query, criteriaBuilder) ->
            criteriaBuilder.equal(root.get("owner").get("id"), ownerId);
    }

    // 2. Specifica per filtrare per email diretta nel ticket
    public static Specification<Ticket> byTicketEmail(String email) {
        return (root, query, criteriaBuilder) ->
            criteriaBuilder.equal(root.get("email"), email);
    }

    // 3. Specifica per filtrare per stato del ticket
    public static Specification<Ticket> byStatus(TicketStatus status) {
        return (root, query, criteriaBuilder) ->
            criteriaBuilder.equal(root.get("status"), status);
    }

    // 4. Specifica per filtrare per stato del ticket NON uguale a
    public static Specification<Ticket> byStatusNot(TicketStatus status) {
        return (root, query, criteriaBuilder) ->
            criteriaBuilder.notEqual(root.get("status"), status);
    }

    // 5. Specifica per filtrare per ID assegnato a (assignedTo)
    public static Specification<Ticket> byAssignedToId(String assignedToId) {
        return (root, query, criteriaBuilder) ->
            criteriaBuilder.equal(root.get("assignedTo").get("id"), assignedToId);
    }

    // 6. Specifica per filtrare per ID proprietario O email del ticket
    public static Specification<Ticket> byOwnerIdOrTicketEmail(String ownerId, String ticketEmail) {
        return (root, query, builder) -> builder.or(
            byOwnerId(ownerId).toPredicate(root, query, builder),
            byTicketEmail(ticketEmail).toPredicate(root, query, builder)
        );
    }

    // 7. Specifica per filtrare per ID assegnato a O ID proprietario
    public static Specification<Ticket> byAssignedToIdOrOwnerId(String userId) {
        return (root, query, builder) -> builder.or(
            byAssignedToId(userId).toPredicate(root, query, builder),
            byOwnerId(userId).toPredicate(root, query, builder)
        );
    }

    // 8. Specifica per filtrare per ID proprietario E status
    public static Specification<Ticket> byOwnerIdAndStatus(String ownerId, TicketStatus status) {
        return (root, query, builder) -> builder.and(
            byOwnerId(ownerId).toPredicate(root, query, builder),
            byStatus(status).toPredicate(root, query, builder)
        );
    }

    // --- NUOVI METODI DI SPECIFICA ---

    // Specifica per filtrare per priorità del ticket
    public static Specification<Ticket> byPriority(TicketPriority priority) {
        return (root, query, criteriaBuilder) ->
            criteriaBuilder.equal(root.get("priority"), priority);
    }

    /**
     * Specifica per cercare un termine in titolo, descrizione, nome categoria o nome servizio di supporto.
     * Utilizza JOIN per accedere alle proprietà delle entità correlate.
     * @param searchTerm Il termine da cercare (case-insensitive).
     * @return Una Specification che combina le condizioni OR.
     */
    public static Specification<Ticket> byKeywordInTicketDetails(String searchTerm) {
        return (root, query, builder) -> {
            String likePattern = "%" + searchTerm.toLowerCase() + "%";

            // Join per Category e SupportService
            // Assicurati che le relazioni siano definite nell'entità Ticket
            // Esempio: @ManyToOne private Category category; @ManyToOne private SupportService service;
            Join<Ticket, Category> categoryJoin = root.join("category");
            Join<Ticket, SupportService> serviceJoin = root.join("service");

            return builder.or(
                builder.like(builder.lower(root.get("title")), likePattern),
                builder.like(builder.lower(root.get("description")), likePattern),
                builder.like(builder.lower(categoryJoin.get("name")), likePattern), // Cerca nel nome della categoria
                builder.like(builder.lower(serviceJoin.get("title")), likePattern) // Cerca nel titolo del servizio
            );
        };
    }
}