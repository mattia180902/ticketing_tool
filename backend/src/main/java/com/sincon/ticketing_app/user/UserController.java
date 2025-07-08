package com.sincon.ticketing_app.user;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import com.sincon.ticketing_app.enums.UserRole;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User Management", description = "API per la gestione degli utenti")
public class UserController {

    private final UserService service;

    /**
     * Recupera la lista di tutti gli utenti nel DB, escluso l'utente corrente.
     * Solo per ADMIN.
     *
     * @param authentication Dettagli dell'utente autenticato.
     * @return Lista di UserResponseDTO.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Recupera tutti gli utenti (tranne se stessi)",
               description = "Permette agli ADMIN di visualizzare tutti gli utenti registrati nel sistema, escluso il proprio account.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Lista utenti recuperata con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (solo ADMIN).")
    })
    public ResponseEntity<List<UserDTO>> getAllUsers(Authentication authentication) {
        // Ho rinominato UserDTO in UserResponseDTO per coerenza con le best practice DTO
        return ResponseEntity.ok(service.getAllUsersExceptSelf(authentication));
    }

    /**
     * Recupera la lista degli utenti con ruolo Helper_Junior, Helper_Senior o PM.
     * Solo per ADMIN.
     *
     * @return Lista di UserResponseDTO.
     */
    @GetMapping("/helpers")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Recupera tutti gli Helper (Junior, Senior) e PM",
               description = "Permette agli ADMIN di visualizzare tutti gli utenti con ruolo Helper_Junior, Helper_Senior o PM.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Lista Helper/PM recuperata con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (solo ADMIN).")
    })
    public ResponseEntity<List<UserDTO>> getHelpers() {
        return ResponseEntity.ok(service.getUsersByRoles(List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM)));
    }

    /**
     * Recupera la lista degli utenti con ruolo Helper_Junior.
     * Solo per ADMIN.
     *
     * @return Lista di UserResponseDTO.
     */
    @GetMapping("/helpers-junior")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Recupera tutti gli Helper Junior",
               description = "Permette agli ADMIN di visualizzare tutti gli utenti con ruolo Helper_Junior.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Lista Helper Junior recuperata con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (solo ADMIN).")
    })
    public ResponseEntity<List<UserDTO>> getHelpersJunior() {
        return ResponseEntity.ok(service.getUsersByRoles(List.of(UserRole.HELPER_JUNIOR)));
    }

    /**
     * Recupera la lista degli utenti con ruolo Helper_Junior, Helper_Senior, PM o Admin.
     * Per ADMIN, HELPER, PM.
     *
     * @return Lista di UserResponseDTO.
     */
    @GetMapping("/helpers-and-admins")
    @PreAuthorize("hasAnyAuthority('ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    @Operation(summary = "Recupera tutti gli Helper, PM e Admin",
               description = "Permette a Helper, PM e Admin di visualizzare tutti gli utenti con ruolo Helper, PM o Admin.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Lista Helper/PM/Admin recuperata con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato.")
    })
    public ResponseEntity<List<UserDTO>> getHelpersAndAdmins() {
        return ResponseEntity.ok(service.getUsersByRoles(List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN)));
    }

    /**
     * Recupera i dettagli dell'utente corrente.
     *
     * @param authentication Dettagli dell'utente autenticato.
     * @return UserResponseDTO dell'utente corrente.
     */
    @GetMapping("/me")
    @Operation(summary = "Recupera i dettagli dell'utente corrente",
               description = "Recupera le informazioni del profilo dell'utente autenticato.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Dettagli utente recuperati con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<UserDTO> getMe(Authentication authentication) {
        return ResponseEntity.ok(service.getMe(authentication));
    }

    /**
     * Aggiorna le informazioni di contatto (numero di telefono, codice fiscale) dell'utente corrente.
     * Accessibile a tutti i ruoli.
     *
     * @param authentication Dettagli dell'utente autenticato.
     * @param request DTO con le informazioni di contatto da aggiornare.
     * @return UserResponseDTO aggiornato.
     */
    @PutMapping("/me/contact-info")
    @PreAuthorize("hasAnyAuthority('USER','HELPER_JUNIOR','HELPER_SENIOR','PM','ADMIN')")
    @Operation(summary = "Aggiorna le informazioni di contatto dell'utente corrente",
               description = "Permette all'utente di aggiornare il proprio numero di telefono e codice fiscale.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Informazioni di contatto aggiornate con successo."),
        @ApiResponse(responseCode = "400", description = "Dati di input non validi."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<UserDTO> updateContactInfo(Authentication authentication,
                                                     @Valid @RequestBody UserContactUpdateRequest request) {
        return ResponseEntity.ok(service.updateContactInfo(authentication.getName(), request));
    }

    /**
     * Aggiorna il ruolo di un utente specifico.
     * Solo per ADMIN. Non può modificare altri ADMIN.
     *
     * @param userId ID dell'utente da aggiornare.
     * @param newRole Il nuovo ruolo da assegnare.
     * @param authentication Dettagli dell'utente autenticato (per verificare il ruolo dell'admin).
     * @return L'utente con il ruolo aggiornato.
     */
    @PatchMapping("/{userId}/role")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Aggiorna il ruolo di un utente",
               description = "Permette agli ADMIN di modificare il ruolo di un utente esistente. Non è possibile modificare il ruolo di altri ADMIN.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "200", description = "Ruolo utente aggiornato con successo."),
        @ApiResponse(responseCode = "400", description = "Dati di input non validi (es. ruolo già presente)."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (solo ADMIN o tentativo di modificare un altro ADMIN)."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<UserDTO> updateUserRole(
            @PathVariable @Parameter(description = "ID dell'utente da aggiornare", example = "uuid-user-1") String userId,
            @RequestParam @Parameter(description = "Il nuovo ruolo da assegnare", example = "HELPER_JUNIOR") UserRole newRole,
            Authentication authentication) {
        String currentAdminId = service.getCurrentUserId(authentication); // Metodo da aggiungere a UserService
        UserDTO response = service.updateUserRole(userId, newRole, currentAdminId);
        return ResponseEntity.ok(response);
    }

    /**
     * Elimina un account utente e tutti i ticket associati.
     * Solo per ADMIN. Non può eliminare altri ADMIN.
     *
     * @param userId ID dell'utente da eliminare.
     * @param authentication Dettagli dell'utente autenticato (per verificare il ruolo dell'admin).
     * @return ResponseEntity vuoto con stato 204 (No Content).
     */
    @DeleteMapping("/{userId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "Elimina un account utente",
               description = "Permette agli ADMIN di eliminare un account utente e tutti i ticket associati. Non è possibile eliminare altri ADMIN.")
    @ApiResponses(value = {
        @ApiResponse(responseCode = "204", description = "Account utente eliminato con successo."),
        @ApiResponse(responseCode = "401", description = "Non autenticato."),
        @ApiResponse(responseCode = "403", description = "Non autorizzato (solo ADMIN o tentativo di eliminare un altro ADMIN)."),
        @ApiResponse(responseCode = "404", description = "Utente non trovato.")
    })
    public ResponseEntity<Void> deleteUser(
            @PathVariable @Parameter(description = "ID dell'utente da eliminare", example = "uuid-user-1") String userId,
            Authentication authentication) {
        String currentAdminId = service.getCurrentUserId(authentication); // Metodo da aggiungere a UserService
        service.deleteUser(userId, currentAdminId);
        return ResponseEntity.noContent().build();
    }
}

