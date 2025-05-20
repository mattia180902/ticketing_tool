package com.sincon.ticketing_app.ticketHistory;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ticketHistories")
@RequiredArgsConstructor
public class TicketHistoryController {

    private final TicketHistoryService ticketHistoryService;

    // Recupera tutte le storie di un ticket dato l'ID del ticket
    @GetMapping("/ticket/{ticketId}")
    public ResponseEntity<List<TicketHistoryDTO>> getHistoryByTicketId(@PathVariable Long ticketId) {
        List<TicketHistoryDTO> historyList = ticketHistoryService.getHistoryByTicketId(ticketId);
        return ResponseEntity.ok(historyList);
    }

    // Crea una nuova voce di storia per un ticket
    @PostMapping
    public ResponseEntity<TicketHistoryDTO> createTicketHistory(@RequestBody TicketHistoryDTO dto) {
        TicketHistoryDTO created = ticketHistoryService.saveHistory(dto);
        return new ResponseEntity<>(created, HttpStatus.CREATED);
    }

    // Elimina una voce di storia dato l'ID
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTicketHistory(@PathVariable Long id) {
        ticketHistoryService.deleteById(id);
        return ResponseEntity.noContent().build();
    }
}
    
