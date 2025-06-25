package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.user.User;
import com.sincon.ticketing_app.user.UserDTO;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
public class TicketController {

    private final TicketService ticketService;

    // ✅ Crea nuovo ticket (anche bozza)
    @PostMapping
    public ResponseEntity<TicketResponseDTO> createTicket(@Valid @RequestBody TicketRequestDTO dto,
            Authentication auth) {
        return ResponseEntity.ok(ticketService.createTicket(dto, auth));
    }

    // ✅ Recupera tutti i ticket dell'utente autenticato
    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('USER','ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<List<TicketResponseDTO>> getMyTickets(Authentication auth) {
        return ResponseEntity.ok(ticketService.getMyTickets(auth));
    }

    // ✅ Recupera i ticket personali filtrati per stato
    @GetMapping("/my/status")
    @PreAuthorize("hasAnyRole('USER','ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<List<TicketResponseDTO>> getMyTicketsByStatus(@RequestParam TicketStatus status,
            Authentication auth) {
        return ResponseEntity.ok(ticketService.getMyTicketsByStatus(auth, status));
    }

    // ✅ Recupera le bozze dell'utente autenticato
    @GetMapping("/my/drafts")
    @PreAuthorize("hasRole('USER')")
    public ResponseEntity<List<TicketResponseDTO>> getDrafts(Authentication auth) {
        return ResponseEntity.ok(ticketService.getDrafts(auth));
    }

    // ✅ Elimina un ticket (permessi verificati dal service)
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('USER','ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<Void> deleteTicket(@PathVariable Long id, Authentication auth) {
        ticketService.deleteTicket(id, auth);
        return ResponseEntity.noContent().build();
    }

    // ✅ Aggiorna stato di un ticket (permessi verificati dal service)
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasAnyRole('ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<TicketResponseDTO> updateStatus(@PathVariable Long id,
            @RequestParam TicketStatus status,
            Authentication auth) {
        return ResponseEntity.ok(ticketService.updateStatus(id, status, auth));
    }

    // ✅ Assegna un ticket a un helper (solo Admin)
    @PatchMapping("/{id}/assign")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<TicketResponseDTO> assignTicket(@PathVariable Long id,
            @RequestParam String helperId,
            Authentication auth) {
        return ResponseEntity.ok(ticketService.assignTicket(id, helperId, auth));
    }

    // ✅ Conta riepilogativa dashboard
    @GetMapping("/dashboard/counts")
    @PreAuthorize("hasAnyRole('ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<DashboardCountsDTO> getCounts(Authentication auth) {
        return ResponseEntity.ok(ticketService.getCounts(auth));
    }

    // ✅ Recupera tickets con paginazione e specifica (per filtri avanzati)
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM','USER')")
    public ResponseEntity<Page<TicketResponseDTO>> getTickets(Pageable pageable, Authentication auth) {
        return ResponseEntity.ok(ticketService.getTickets(pageable, auth));
    }

    // ✅ Dettaglio completo di un ticket
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('USER','ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<TicketResponseDTO> getTicketDetails(@PathVariable Long id) {
        return ResponseEntity.ok(ticketService.getTicketDetails(id));
    }

    // ✅ Recupera i ticket assegnati all'helper autenticato
    @GetMapping("/assigned")
    @PreAuthorize("hasAnyRole('HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<List<TicketResponseDTO>> getAssignedTickets(Authentication auth) {
        return ResponseEntity.ok(ticketService.getAssignedTickets(auth));
    }

    // ✅ Recupera i ticket assegnati all'helper autenticato filtrati per stato
    @GetMapping("/assigned/status")
    @PreAuthorize("hasAnyRole('HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<List<TicketResponseDTO>> getAssignedTicketsByStatus(@RequestParam TicketStatus status,
            Authentication auth) {
        return ResponseEntity.ok(ticketService.getAssignedTicketsByStatus(auth, status));
    }

    @GetMapping("/helpers/available")
    @PreAuthorize("hasAnyRole('ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<List<UserDTO>> getAvailableHelpers() {
        List<User> helpers = ticketService.getAllHelpers();
        List<UserDTO> result = helpers.stream()
                .map(u -> new UserDTO(u.getId(), u.getFirstName(), u.getLastName(), u.getEmail(), u.getRole(), u.getFiscalCode(), u.getPhoneNumber()))
                .toList();
        return ResponseEntity.ok(result);
    }

}
