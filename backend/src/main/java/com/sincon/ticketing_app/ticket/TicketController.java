package com.sincon.ticketing_app.ticket;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.sincon.ticketing_app.common.PageResponse;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
@Tag(name = "Ticket")
public class TicketController {

    private final TicketService ticketService;

    @PostMapping
    public ResponseEntity<Long> createTicket(
            @Valid @RequestBody TicketDTO ticketDTO, Authentication connectedUser) {
        return ResponseEntity.ok(ticketService.createTicket(ticketDTO, connectedUser));
    }

    @GetMapping
    public ResponseEntity<PageResponse<TicketResponse>> getAllTickets(
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "10") int size,
            Authentication connectedUser) {
        return ResponseEntity.ok(ticketService.getTicketsForUser(page, size, connectedUser));
    }

    @GetMapping("/{id}")
    public ResponseEntity<TicketResponse> getTicketById(
            @PathVariable("id") Long id) {
        return ResponseEntity.ok(ticketService.getTicketById(id));
    }

    @PatchMapping("{id}")
    public ResponseEntity<Long> updateTicket(
        @PathVariable("id") Long id,
        @RequestBody TicketDTO ticketDTO,
        Authentication connectedUser ) {
            return ResponseEntity.ok(ticketService.updateTicket(id, ticketDTO, connectedUser));
        }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTicket(@PathVariable Long id) {
        ticketService.deleteTicket(id);
        return ResponseEntity.noContent().build();
    }
}
