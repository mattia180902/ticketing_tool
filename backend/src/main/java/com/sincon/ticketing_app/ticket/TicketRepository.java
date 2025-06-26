package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {

    // --- Metodi per l'Owner (Creator) del Ticket ---
    // Recupera ticket per owner che NON sono DRAFT
    List<Ticket> findByOwner_IdAndStatusNot(String ownerId, TicketStatus statusToExclude);
    Page<Ticket> findByOwner_IdAndStatusNot(String ownerId, TicketStatus statusToExclude, Pageable pageable);

    // Recupera ticket per owner con uno status specifico (es. DRAFT, OPEN, ecc.)
    List<Ticket> findByOwner_IdAndStatus(String ownerId, TicketStatus status);
    Page<Ticket> findByOwner_IdAndStatus(String ownerId, TicketStatus status, Pageable pageable);


    // --- Metodi per l'Assegnatario (AssignedTo) del Ticket ---
    // Recupera ticket assegnati a un utente che NON sono DRAFT
    List<Ticket> findByAssignedTo_IdAndStatusNot(String assignedToId, TicketStatus statusToExclude);
    Page<Ticket> findByAssignedTo_IdAndStatusNot(String assignedToId, TicketStatus statusToExclude, Pageable pageable);

    // Recupera ticket assegnati a un utente con uno status specifico
    List<Ticket> findByAssignedTo_IdAndStatus(String assignedToId, TicketStatus status);
    Page<Ticket> findByAssignedTo_IdAndStatus(String assignedToId, TicketStatus status, Pageable pageable);

    // --- Conteggi ---
    // Conteggi globali per ADMIN
    long count();
    long countByStatus(TicketStatus status);

    // Conteggi per owner specifico
    long countByOwner_Id(String ownerId);
    long countByOwner_IdAndStatus(String ownerId, TicketStatus status);

    // Conteggi per assegnatario specifico
    long countByAssignedTo_Id(String assignedToId);
    long countByAssignedTo_IdAndStatus(String assignedToId, TicketStatus status);

    // Conteggi per ticket dove l'utente è assegnatario O owner (utile per Helper/PM dashboard)
    long countByAssignedTo_IdOrOwner_Id(String assignedToId, String ownerId);
    long countByAssignedTo_IdAndStatusOrOwner_IdAndStatus(String assignedToId, TicketStatus assignedStatus, String ownerId, TicketStatus ownerStatus);


    // --- Query Complesse ---
    // Per TicketService.getTickets per Helper/PM: ticket assegnati O creati dall'utente, escludendo le bozze
    Page<Ticket> findByAssignedTo_IdOrOwner_IdAndStatusNot(String assignedToId, String ownerId, TicketStatus statusToExclude, Pageable pageable);

    // Query personalizzata per recuperare i dettagli con i fetch necessari
    @Query("SELECT t FROM Ticket t LEFT JOIN FETCH t.owner LEFT JOIN FETCH t.category LEFT JOIN FETCH t.service LEFT JOIN FETCH t.assignedTo WHERE t.id = :id")
    Optional<Ticket> findDetailedById(@Param("id") Long id);
}
