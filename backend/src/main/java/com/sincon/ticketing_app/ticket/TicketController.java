package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.enums.TicketStatus;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/tickets")
@RequiredArgsConstructor
@Tag(name = "Ticket Management", description = "API per la gestione dei ticket")
public class TicketController {

    private final TicketService ticketService;

    /**
     * Crea un nuovo ticket o aggiorna una bozza esistente.
     * Un utente USER crea sempre un ticket con la sua email.
     * ADMIN e HELPER possono specificare l'email di un altro utente.
     *
     * @param dto DTO con i dati del ticket.
     * @param auth Dettagli dell'utente autenticato.
     * @param ticketId ID del ticket da aggiornare (opzionale, per le bozze).
     * @return Il ticket creato o aggiornato.
     */
    @PostMapping
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Crea un nuovo ticket o aggiorna una bozza esistente",
               description = "Permette a USER, HELPER, PM e ADMIN di creare un nuovo ticket o di salvare/finalizzare una bozza.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "201", description = "Ticket creato/aggiornato con successo."),
        @ApiResponse(responseCode = "400", description = "Dati di input non validi."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato."),
        @ApiResponse(responseCode = "404", description = "Risorsa non trovata (es. categoria, servizio).")
    })
    public ResponseEntity<TicketResponseDTO> createOrUpdateTicket(
            @Valid @RequestBody TicketRequestDTO dto,
            Authentication auth,
            @RequestParam(required = false) @Parameter(description = "ID del ticket da aggiornare (solo per le bozze)", example = "1") Long ticketId) {
        TicketResponseDTO response = ticketService.createOrUpdateTicket(dto, auth, ticketId);
        // Se è una creazione, restituisci HttpStatus.CREATED
        return ticketId == null ? new ResponseEntity<>(response, HttpStatus.CREATED) : ResponseEntity.ok(response);
    }

    /**
     * Accetta un ticket assegnato all'utente corrente (solo per HELPER, PM, ADMIN).
     * Lo stato del ticket passa da OPEN a ANSWERED.
     *
     * @param ticketId ID del ticket.
     * @param auth Dettagli dell'utente autenticato.
     * @return Il ticket aggiornato.
     */
    @PatchMapping("/{ticketId}/accept")
    @PreAuthorize("hasAnyAuthority('HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Accetta un ticket",
               description = "Un helper/PM/admin accetta un ticket assegnatogli, portandolo da OPEN ad ANSWERED.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket accettato con successo."),
        @ApiResponse(responseCode = "400", description = "Stato del ticket non valido per l'accettazione."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (non sei l'assegnatario)."),
        @ApiResponse(responseCode = "404", description = "Ticket non trovato.")
    })
    public ResponseEntity<TicketResponseDTO> acceptTicket(
            @PathVariable @Parameter(description = "ID del ticket da accettare", example = "1") Long ticketId,
            Authentication auth) {
        TicketResponseDTO response = ticketService.acceptTicket(ticketId, auth);
        return ResponseEntity.ok(response);
    }

    /**
     * Rifiuta un ticket assegnato all'utente corrente e lo riassegna (solo per HELPER, PM, ADMIN).
     * Il ticket deve essere in stato OPEN.
     *
     * @param ticketId ID del ticket.
     * @param newAssignedToId ID del nuovo utente a cui assegnare il ticket.
     * @param auth Dettagli dell'utente autenticato.
     * @return Il ticket aggiornato.
     */
    @PatchMapping("/{ticketId}/reject")
    @PreAuthorize("hasAnyAuthority('HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Rifiuta e riassegna un ticket",
               description = "Un helper/PM/admin rifiuta un ticket e lo riassegna a un altro helper/admin. Il ticket deve essere in stato OPEN.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket rifiutato e riassegnato con successo."),
        @ApiResponse(responseCode = "400", description = "Stato del ticket o nuovo assegnatario non validi."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (non sei l'assegnatario)."),
        @ApiResponse(responseCode = "404", description = "Ticket o nuovo assegnatario non trovato.")
    })
    public ResponseEntity<TicketResponseDTO> rejectTicket(
            @PathVariable @Parameter(description = "ID del ticket da rifiutare", example = "1") Long ticketId,
            @RequestParam @Parameter(description = "ID del nuovo utente (helper/admin) a cui assegnare il ticket", example = "uuid-helper-2") String newAssignedToId,
            Authentication auth) {
        TicketResponseDTO response = ticketService.rejectTicket(ticketId, newAssignedToId, auth);
        return ResponseEntity.ok(response);
    }

    /**
     * Escala un ticket assegnato all'utente corrente, riassegnandolo a un altro helper/admin
     * e riportandolo allo stato OPEN (solo per HELPER, PM, ADMIN).
     * Il ticket deve essere in stato ANSWERED.
     *
     * @param ticketId ID del ticket.
     * @param newAssignedToId ID del nuovo utente a cui assegnare il ticket.
     * @param auth Dettagli dell'utente autenticato.
     * @return Il ticket aggiornato.
     */
    @PatchMapping("/{ticketId}/escalate")
    @PreAuthorize("hasAnyAuthority('HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Escala un ticket",
               description = "Un helper/PM/admin scala un ticket (portandolo da ANSWERED a OPEN) e lo riassegna a un altro helper/admin.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket escalato con successo."),
        @ApiResponse(responseCode = "400", description = "Stato del ticket o nuovo assegnatario non validi."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (non sei l'assegnatario)."),
        @ApiResponse(responseCode = "404", description = "Ticket o nuovo assegnatario non trovato.")
    })
    public ResponseEntity<TicketResponseDTO> escalateTicket(
            @PathVariable @Parameter(description = "ID del ticket da escalare", example = "1") Long ticketId,
            @RequestParam @Parameter(description = "ID del nuovo utente (helper/admin) a cui assegnare il ticket", example = "uuid-admin-1") String newAssignedToId,
            Authentication auth) {
        TicketResponseDTO response = ticketService.escalateTicket(ticketId, newAssignedToId, auth);
        return ResponseEntity.ok(response);
    }

    /**
     * Aggiorna lo stato di un ticket (solo per ADMIN, HELPER, PM).
     * Le bozze non possono essere aggiornate direttamente tramite questo endpoint.
     *
     * @param ticketId ID del ticket.
     * @param newStatus Il nuovo stato desiderato.
     * @param auth Dettagli dell'utente autenticato.
     * @return Il ticket aggiornato.
     */
    @PatchMapping("/{ticketId}/status")
    @PreAuthorize("hasAnyAuthority('HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Aggiorna lo stato di un ticket",
               description = "Permette a HELPER, PM e ADMIN di cambiare lo stato di un ticket. Le bozze non possono essere modificate qui.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Stato del ticket aggiornato."),
        @ApiResponse(responseCode = "400", description = "Stato non valido o tentativo di modificare una bozza."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato."),
        @ApiResponse(responseCode = "404", description = "Ticket non trovato.")
    })
    public ResponseEntity<TicketResponseDTO> updateTicketStatus(
            @PathVariable @Parameter(description = "ID del ticket da aggiornare", example = "1") Long ticketId,
            @RequestParam @Parameter(description = "Nuovo stato del ticket", example = "SOLVED") TicketStatus newStatus,
            Authentication auth) {
        TicketResponseDTO response = ticketService.updateStatus(ticketId, newStatus, auth);
        return ResponseEntity.ok(response);
    }

    /**
     * Assegna un ticket a un utente specifico (solo per ADMIN, PM).
     * Non applicabile alle bozze.
     *
     * @param ticketId ID del ticket.
     * @param helperId ID dell'utente (helper/admin) a cui assegnare il ticket.
     * @param auth Dettagli dell'utente autenticato.
     * @return Il ticket aggiornato.
     */
    @PatchMapping("/{ticketId}/assign")
    @PreAuthorize("hasAnyAuthority('PM', 'ADMIN')")
    @Operation(summary = "Assegna un ticket a un helper/admin",
               description = "Permette a PM e ADMIN di assegnare manualmente un ticket a un utente specifico (solo helper/admin).")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket assegnato con successo."),
        @ApiResponse(responseCode = "400", description = "ID helper non valido o tentativo di assegnare una bozza."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato."),
        @ApiResponse(responseCode = "404", description = "Ticket o helper non trovato.")
    })
    public ResponseEntity<TicketResponseDTO> assignTicket(
            @PathVariable @Parameter(description = "ID del ticket da assegnare", example = "1") Long ticketId,
            @RequestParam @Parameter(description = "ID dell'helper/admin a cui assegnare il ticket", example = "uuid-helper-3") String helperId,
            Authentication auth) {
        TicketResponseDTO response = ticketService.assignTicket(ticketId, helperId, auth);
        return ResponseEntity.ok(response);
    }

    /**
     * Recupera tutti i ticket con paginazione, filtrati per ruolo utente.
     * ADMIN vede tutti i ticket.
     * HELPER/PM vedono i ticket a loro assegnati o da loro creati (non bozze).
     * USER vede solo i propri ticket (non bozze).
     *
     * @param pageable Oggetto per la paginazione e ordinamento.
     * @param auth Dettagli dell'utente autenticato.
     * @return Una pagina di ticket.
     */
    @GetMapping
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera tutti i ticket (paginati e filtrati per ruolo)",
               description = "Recupera una lista paginata di ticket in base al ruolo dell'utente autenticato.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Lista di ticket recuperata con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (ruolo non supportato).")
    })
    public ResponseEntity<Page<TicketResponseDTO>> getTickets(
            @Parameter(description = "Parametri di paginazione e ordinamento") Pageable pageable,
            Authentication auth) {
        Page<TicketResponseDTO> tickets = ticketService.getTickets(pageable, auth);
        return ResponseEntity.ok(tickets);
    }

    /**
     * Recupera i dettagli di un singolo ticket.
     *
     * @param ticketId ID del ticket.
     * @return Dettagli del ticket.
     */
    @GetMapping("/{ticketId}")
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera i dettagli di un ticket specifico",
               description = "Recupera i dettagli completi di un ticket tramite il suo ID.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Dettagli del ticket recuperati con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (non sei owner, assegnatario o admin)."),
        @ApiResponse(responseCode = "404", description = "Ticket non trovato.")
    })
    public ResponseEntity<TicketResponseDTO> getTicketDetails(
            @PathVariable @Parameter(description = "ID del ticket", example = "1") Long ticketId) {
        TicketResponseDTO ticket = ticketService.getTicketDetails(ticketId);
        return ResponseEntity.ok(ticket);
    }

    /**
     * Recupera tutte le bozze create dall'utente corrente (solo per USER, HELPER, PM, ADMIN).
     *
     * @param auth Dettagli dell'utente autenticato.
     * @return Lista di bozze.
     */
    @GetMapping("/my-drafts")
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera tutte le bozze dell'utente corrente",
               description = "Recupera tutti i ticket in stato DRAFT creati dall'utente autenticato.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Bozze recuperate con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<List<TicketResponseDTO>> getMyDrafts(Authentication auth) {
        List<TicketResponseDTO> drafts = ticketService.getDrafts(auth);
        return ResponseEntity.ok(drafts);
    }

    /**
     * Recupera tutti i ticket di proprietà dell'utente corrente, escluse le bozze (solo per USER, HELPER, PM, ADMIN).
     *
     * @param auth Dettagli dell'utente autenticato.
     * @return Lista dei propri ticket.
     */
    @GetMapping("/my-tickets")
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera tutti i ticket di proprietà dell'utente corrente",
               description = "Recupera tutti i ticket creati dall'utente autenticato, escluse le bozze.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket recuperati con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<List<TicketResponseDTO>> getMyTickets(Authentication auth) {
        List<TicketResponseDTO> tickets = ticketService.getMyTickets(auth);
        return ResponseEntity.ok(tickets);
    }

    /**
     * Recupera i ticket di proprietà dell'utente corrente in base a uno stato specifico (solo per USER, HELPER, PM, ADMIN).
     *
     * @param status Lo stato dei ticket da filtrare.
     * @param auth Dettagli dell'utente autenticato.
     * @return Lista dei propri ticket filtrati per stato.
     */
    @GetMapping("/my-tickets/status/{status}")
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera i ticket di proprietà dell'utente per stato",
               description = "Recupera i ticket creati dall'utente autenticato, filtrati per uno stato specifico.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket recuperati con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<List<TicketResponseDTO>> getMyTicketsByStatus(
            @PathVariable @Parameter(description = "Stato del ticket", example = "OPEN") TicketStatus status,
            Authentication auth) {
        List<TicketResponseDTO> tickets = ticketService.getMyTicketsByStatus(status, auth);
        return ResponseEntity.ok(tickets);
    }

    /**
     * Recupera tutti i ticket assegnati all'utente corrente, escluse le bozze (solo per HELPER, PM, ADMIN).
     *
     * @param auth Dettagli dell'utente autenticato.
     * @return Lista dei ticket assegnati.
     */
    @GetMapping("/assigned-to-me")
    @PreAuthorize("hasAnyAuthority('HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera i ticket assegnati all'utente corrente",
               description = "Recupera tutti i ticket assegnati all'utente autenticato, escluse le bozze.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket assegnati recuperati con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<List<TicketResponseDTO>> getAssignedTickets(Authentication auth) {
        List<TicketResponseDTO> tickets = ticketService.getAssignedTickets(auth);
        return ResponseEntity.ok(tickets);
    }

    /**
     * Recupera i ticket assegnati all'utente corrente in base a uno stato specifico (solo per HELPER, PM, ADMIN).
     *
     * @param status Lo stato dei ticket da filtrare.
     * @param auth Dettagli dell'utente autenticato.
     * @return Lista dei ticket assegnati filtrati per stato.
     */
    @GetMapping("/assigned-to-me/status/{status}")
    @PreAuthorize("hasAnyAuthority('HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera i ticket assegnati all'utente per stato",
               description = "Recupera i ticket assegnati all'utente autenticato, filtrati per uno stato specifico.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ticket assegnati recuperati con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<List<TicketResponseDTO>> getAssignedTicketsByStatus(
            @PathVariable @Parameter(description = "Stato del ticket", example = "ANSWERED") TicketStatus status,
            Authentication auth) {
        List<TicketResponseDTO> tickets = ticketService.getAssignedTicketsByStatus(auth, status);
        return ResponseEntity.ok(tickets);
    }


    /**
     * Elimina un ticket. Solo l'owner di una bozza o un ADMIN possono eliminare.
     *
     * @param ticketId ID del ticket da eliminare.
     * @param auth Dettagli dell'utente autenticato.
     * @return Risposta di successo.
     */
    @DeleteMapping("/{ticketId}")
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Elimina un ticket",
               description = "Permette all'owner di eliminare le proprie bozze, e agli ADMIN di eliminare qualsiasi ticket.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Ticket eliminato con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato."),
        @ApiResponse(responseCode = "404", description = "Ticket non trovato.")
    })
    public ResponseEntity<Void> deleteTicket(
            @PathVariable @Parameter(description = "ID del ticket da eliminare", example = "1") Long ticketId,
            Authentication auth) {
        ticketService.deleteTicket(ticketId, auth);
        return ResponseEntity.noContent().build();
    }

    /**
     * Recupera i conteggi dei ticket per la dashboard.
     * I conteggi sono filtrati in base al ruolo dell'utente autenticato.
     *
     * @param auth Dettagli dell'utente autenticato.
     * @return DTO con i conteggi.
     */
    @GetMapping("/dashboard/counts")
    @PreAuthorize("hasAnyAuthority('USER', 'HELPER_JUNIOR', 'HELPER_SENIOR', 'PM', 'ADMIN')")
    @Operation(summary = "Recupera i conteggi dei ticket per la dashboard",
               description = "Fornisce i conteggi aggregati dei ticket (totali, aperti, risolti, bozze) in base al ruolo dell'utente.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Conteggi recuperati con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<DashboardCountsDTO> getDashboardCounts(Authentication auth) {
        DashboardCountsDTO counts = ticketService.getCounts(auth);
        return ResponseEntity.ok(counts);
    }
}