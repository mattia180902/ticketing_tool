package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.data.jpa.repository.*;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long>, JpaSpecificationExecutor<Ticket> {

    // Tutti i ticket dell'utente
    // Cambiato da findByUser_Id a findByOwner_Id
    List<Ticket> findByOwner_Id(String ownerId);

    // Tutti i ticket dell'utente filtrati per stato
    // Cambiato da findByUser_IdAndStatus a findByOwner_IdAndStatus
    List<Ticket> findByOwner_IdAndStatus(String ownerId, TicketStatus status);

    // Tutti i ticket assegnati a uno specifico helper (corretto, usa assignedTo)
    List<Ticket> findByAssignedTo_Id(String helperId);

    // Ticket assegnati a helper filtrati per stato (corretto, usa assignedTo)
    List<Ticket> findByAssignedTo_IdAndStatus(String helperId, TicketStatus status);

    // Contare ticket totali
    long count();

    // Contare ticket per stato
    long countByStatus(TicketStatus status);

    // Contare ticket assegnati a uno specifico helper per stato
    long countByAssignedTo_IdAndStatus(String helperId, TicketStatus status);

    // Dettaglio ticket con category e support service eager fetch
    @Query("SELECT t FROM Ticket t JOIN FETCH t.category JOIN FETCH t.service WHERE t.id = :id")
    Optional<Ticket> findDetailedById(Long id);

    // Paginazione dinamica con Specification
    Page<Ticket> findAll(Specification<Ticket> spec, Pageable pageable);

    Page<Ticket> findByAssignedTo_Id(String helperId, Pageable pageable);

    Page<Ticket> findByOwner_Id(String ownerId, Pageable pageable);

    long countByOwner_Id(String ownerId);

    long countByOwner_IdAndStatus(String ownerId, TicketStatus status);
    long countByAssignedTo_Id(String helperId);

}
