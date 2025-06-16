package com.sincon.ticketing_app.ticket;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import com.sincon.ticketing_app.enums.*;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.List;

@Repository
public interface TicketRepository extends JpaRepository<Ticket, Long> {

    List<Ticket> findByStatus(TicketStatus status);

    @Query("SELECT COUNT(t) FROM Ticket t WHERE t.status = :status")
    Long countByStatus(TicketStatus status);

    @Query("SELECT t FROM Ticket t WHERE LOWER(t.title) LIKE LOWER(CONCAT('%', :keyword, '%'))")
    List<Ticket> searchByTitle(String keyword);

    @Query("""
        SELECT ticket
        FROM Ticket ticket
        """)
    Page<Ticket> findAllTickets(Pageable pageable);

    Page<Ticket> findAllByCreatedBy(Pageable pageable, String userId);

}