package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketStatus;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {

    // Metodi derivati semplici e inequivocabili per liste specifiche
    List<Ticket> findByOwner_IdAndStatus(String ownerId, TicketStatus status);
    List<Ticket> findByAssignedTo_IdAndStatus(String assignedToId, TicketStatus status);

    // Conteggi base per dashboard (con String per gli ID utente)
    long countByStatus(TicketStatus status); // Conta tutti i ticket con un dato status
    long countByOwner_IdAndStatus(String ownerId, TicketStatus status); // Conta i ticket di un owner con un dato status
    long countByOwner_IdAndStatusNot(String ownerId, TicketStatus status); // Conta i ticket di un owner con status diverso
    long countByAssignedTo_IdAndStatus(String assignedToId, TicketStatus status); // Conta i ticket assegnati con un dato status
    long countByAssignedTo_IdAndStatusNot(String assignedToId, TicketStatus status); // Conta i ticket assegnati con status diverso

    // Query custom per dettagli completi con fetch join per evitare N+1
    @Query("SELECT t FROM Ticket t " +
            "LEFT JOIN FETCH t.owner " +
            "LEFT JOIN FETCH t.assignedTo " +
            "LEFT JOIN FETCH t.category " +
            "LEFT JOIN FETCH t.service " +
            "WHERE t.id = :id")
    Optional<Ticket> findDetailedById(@Param("id") Long id);
   
       // Aggiunto per eliminare i ticket quando un utente viene eliminato
       void deleteByOwner_Id(String ownerId);
       void deleteByAssignedTo_Id(String assignedToId);
}
