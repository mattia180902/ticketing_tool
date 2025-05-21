package com.sincon.ticketing_app.ticket;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
@Tag(name = "Ticket")
public class TicketController {

    private final TicketService ticketService;

    @GetMapping
    public List<TicketDTO> getAllTickets() {
        return ticketService.getAllTickets();
    }

    @GetMapping("/{id}")
    public TicketDTO getTicketById(@PathVariable Long id) {
        return ticketService.getTicketById(id);
    }

    @PostMapping
    public TicketDTO createTicket(@RequestBody TicketDTO ticketDTO) {
        return ticketService.createTicket(ticketDTO);
    }

    @PutMapping("/{id}")
    public TicketDTO updateTicket(@PathVariable Long id, @RequestBody TicketDTO ticketDTO) {
        return ticketService.updateTicket(id, ticketDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTicket(@PathVariable Long id) {
        ticketService.deleteTicket(id);
        return ResponseEntity.noContent().build();
    }
}
