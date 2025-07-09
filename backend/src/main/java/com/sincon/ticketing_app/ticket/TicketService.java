package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.category.CategoryService;
import com.sincon.ticketing_app.enums.TicketPriority;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.enums.UserRole;
import com.sincon.ticketing_app.exception.*;
import com.sincon.ticketing_app.notification.EmailService;
import com.sincon.ticketing_app.supportservice.SupportService;
import com.sincon.ticketing_app.supportservice.SupportServiceService;
import com.sincon.ticketing_app.user.User;
import com.sincon.ticketing_app.user.UserService;
import static com.sincon.ticketing_app.ticket.TicketSpecifications.*;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.data.jpa.domain.Specification;

import java.util.Comparator;
import java.util.Date;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketMapper ticketMapper;
    private final UserService userService;
    private final CategoryService categoryService;
    private final SupportServiceService supportServicesService;
    private final EmailService emailService;

   // --- Metodi di Utilità per l'Autenticazione ---

   private String getCurrentUserId(Authentication auth) {
    if (auth instanceof JwtAuthenticationToken jwtAuth) {
        String subject = jwtAuth.getToken().getSubject();
        log.debug("getCurrentUserId: JWT Subject (ID): {}", subject);
        return subject;
    }
    log.warn("getCurrentUserId: Authentication is not JwtAuthenticationToken. Using auth.getName() as user ID. Type: {}",
            auth.getClass().getName());
    return auth.getName();
}

private String getCurrentUserEmail(Authentication auth) {
    if (auth instanceof JwtAuthenticationToken jwtAuth) {
        String email = jwtAuth.getToken().getClaimAsString("email");
        log.debug("getCurrentUserEmail: JWT Email Claim: {}", email);
        if (email != null) {
            return email;
        }
        log.warn("getCurrentUserEmail: JWT token does not contain 'email' claim for user ID: {}", jwtAuth.getToken().getSubject());
    }
    log.warn(
            "getCurrentUserEmail: Authentication is not JwtAuthenticationToken or email claim not found. Using auth.getName() as user email. Type: {}",
            auth.getName());
    return auth.getName();
}

/**
 * Verifica se l'utente autenticato ha un determinato ruolo, leggendo i ruoli dai claim del JWT.
 * @param auth Dettagli dell'utente autenticato.
 * @param role Il ruolo da verificare (es. "ADMIN", "HELPER_JUNIOR").
 * @return true se l'utente ha il ruolo, false altrimenti.
 */
private boolean hasRole(Authentication auth, String role) {
    log.debug("hasRole: Checking role '{}'", role);

    if (!(auth instanceof JwtAuthenticationToken jwtAuth)) {
        log.warn("hasRole: Authentication is not JwtAuthenticationToken. Cannot extract roles from JWT claims for role '{}'. Falling back to GrantedAuthorities.", role);
        // Fallback per autenticazioni non JWT, meno affidabile per ruoli Keycloak
        Set<String> authorities = auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(a -> a.startsWith("ROLE_") ? a.substring(5) : a)
                .collect(Collectors.toSet());
        log.debug("hasRole: Processed GrantedAuthorities: {}", authorities);
        return authorities.contains(role);
    }

    Set<String> allRoles = new HashSet<>();

    // 1. Estrai ruoli da realm_access (ruoli a livello di realm)
    Map<String, Object> realmAccess = jwtAuth.getToken().getClaimAsMap("realm_access");
    if (realmAccess != null && realmAccess.containsKey("roles")) {
        List<String> realmRoles = (List<String>) realmAccess.get("roles");
        allRoles.addAll(realmRoles);
        log.debug("hasRole: Realm Roles from JWT: {}", realmRoles);
    }

    // 2. Estrai ruoli da resource_access (ruoli a livello di client)
    // Sostituisci "ticketing_tool" con l'ID effettivo del tuo client in Keycloak
    Map<String, Object> resourceAccess = jwtAuth.getToken().getClaimAsMap("resource_access");
    if (resourceAccess != null && resourceAccess.containsKey("ticketing_tool")) { // <--- VERIFICA QUESTO ID CLIENT!
        Map<String, Object> clientAccess = (Map<String, Object>) resourceAccess.get("ticketing_tool");
        if (clientAccess != null && clientAccess.containsKey("roles")) {
            List<String> clientRoles = (List<String>) clientAccess.get("roles");
            allRoles.addAll(clientRoles);
            log.debug("hasRole: Client Roles ('ticketing_tool') from JWT: {}", clientRoles);
        }
    }
    
    log.debug("hasRole: All extracted roles from JWT: {}", allRoles);
    boolean result = allRoles.contains(role);
    log.debug("hasRole: User has role '{}': {}", role, result);
    return result;
}

// Helper method for role checking
private boolean hasAnyHelperPmAdminRole(Authentication auth) {
    return hasRole(auth, UserRole.HELPER_JUNIOR.name()) ||
           hasRole(auth, UserRole.HELPER_SENIOR.name()) ||
           hasRole(auth, UserRole.PM.name()) ||
           hasRole(auth, UserRole.ADMIN.name());
}


// --- Metodi del Servizio Ticket ---

/**
 * Crea un nuovo ticket o aggiorna una bozza esistente.
 * La logica di creazione/aggiornamento varia in base al ruolo dell'utente e allo stato del ticket.
 *
 * @param dto DTO con i dati del ticket.
 * @param auth Dettagli dell'utente autenticato.
 * @param ticketId ID del ticket da aggiornare (opzionale, per le bozze o modifiche).
 * @return Il ticket creato o aggiornato.
 */
@Transactional
public TicketResponseDTO createOrUpdateTicket(TicketRequestDTO dto, Authentication auth, Long ticketId) {
    String currentUserId = getCurrentUserId(auth);
    String currentUserEmail = getCurrentUserEmail(auth);
    User currentUser = userService.findUserById(currentUserId)
            .orElseThrow(() -> new UserProfileNotFoundException("Utente autenticato non trovato: " + currentUserId));

    log.info("createOrUpdateTicket: Current User ID: {}, Email: {}", currentUserId, currentUserEmail);
    log.info("createOrUpdateTicket called. TicketId: {}", ticketId);
    log.info("createOrUpdateTicket: DTO Status received: {}", dto.getStatus());

    Ticket ticket;
    User ownerUser;
    User oldAssignee = null;
    TicketStatus oldStatus = null; // Store old status for transition check

    boolean isNewTicketRequest = (ticketId == null);
    boolean isUserOnlyRole = hasRole(auth, UserRole.USER.name()) && !hasAnyHelperPmAdminRole(auth);
    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());
    boolean isHelper = hasRole(auth, UserRole.HELPER_JUNIOR.name()) || hasRole(auth, UserRole.HELPER_SENIOR.name());
    boolean isAdminOrPm = isAdmin || isPm;
    boolean isHelperOrPmOrAdmin = isAdminOrPm || isHelper;


    // --- 1. Determinazione dell'Owner del Ticket ---
    // NUOVA LOGICA: L'email è obbligatoria solo se il ticket non è una bozza O se l'utente è un USER_ONLY
    if ((dto.getStatus() != TicketStatus.DRAFT || isUserOnlyRole) && (dto.getEmail() == null || dto.getEmail().isEmpty())) {
        throw new IllegalArgumentException("L'email dell'utente proprietario del ticket è obbligatoria.");
    }
    
    // Se è un Admin/PM/Helper che crea una bozza e l'email non è stata specificata, usa la propria email come owner temporaneo
    if (isNewTicketRequest && dto.getStatus() == TicketStatus.DRAFT && isHelperOrPmOrAdmin && (dto.getEmail() == null || dto.getEmail().isEmpty())) {
        ownerUser = currentUser; // L'Admin/PM/Helper è il proprietario della bozza
        dto.setEmail(currentUserEmail); // Aggiorna il DTO con l'email dell'utente corrente
        log.info("createOrUpdateTicket: Admin/PM/Helper creating DRAFT with no specified email. Setting current user ({}) as owner.", currentUserEmail);
    } else {
        ownerUser = userService.findUserByEmail(dto.getEmail())
                .orElseThrow(() -> new UserProfileNotFoundException("Utente con email " + dto.getEmail() + " non trovato nel sistema. Non è possibile creare un ticket per un utente inesistente."));
        log.info("createOrUpdateTicket: Ticket owner set to: {}", ownerUser.getEmail());

        // NUOVA VALIDAZIONE: Se l'utente corrente non è un USER_ONLY, l'owner del ticket deve essere un USER
        if (!isUserOnlyRole && ownerUser.getRole() != UserRole.USER) {
            throw new InvalidTicketOwnerException("Un ticket creato da un Admin/PM/Helper deve avere come proprietario un utente con ruolo USER.");
        }
    }


    // --- 2. Aggiornamento dei dati utente (codice fiscale, telefono) nel profilo dell'owner ---
    boolean ownerDataUpdated = false;
    if (dto.getFiscalCode() != null && !dto.getFiscalCode().isEmpty() && !dto.getFiscalCode().equals(ownerUser.getFiscalCode())) {
        ownerUser.setFiscalCode(dto.getFiscalCode());
        ownerDataUpdated = true;
    }
    if (dto.getPhoneNumber() != null && !dto.getPhoneNumber().isEmpty() && !dto.getPhoneNumber().equals(ownerUser.getPhoneNumber())) {
        ownerUser.setPhoneNumber(dto.getPhoneNumber());
        ownerDataUpdated = true;
    }
    if (ownerDataUpdated) {
        userService.save(ownerUser);
        log.info("createOrUpdateTicket: Updated owner user details: {}", ownerUser.getEmail());
    }

    // --- 3. Inizializzazione dell'oggetto Ticket (nuovo o esistente) ---
    if (!isNewTicketRequest) {
        log.info("createOrUpdateTicket: Updating existing ticket with ID: {}", ticketId);
        ticket = ticketRepository.findDetailedById(ticketId)
                .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));
        
        oldAssignee = ticket.getAssignedTo();
        oldStatus = ticket.getStatus(); // Store old status

        boolean isTicketOwner = ticket.getOwner().getId().equals(currentUserId);
        boolean isAssignedToMe = ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(currentUserId);

        // NUOVA LOGICA: Impedisci a chiunque tranne l'owner di modificare una bozza
        if (ticket.getStatus() == TicketStatus.DRAFT && !isTicketOwner) {
            throw new UnauthorizedTicketActionException("Non autorizzato a modificare questa bozza. Solo il proprietario può modificare le bozze.");
        }

        if (isUserOnlyRole) {
            // User can only modify their own DRAFTs (this is now covered by the new logic above for DRAFTs)
            // For non-DRAFT tickets, a USER cannot modify them.
            if (!isTicketOwner || ticket.getStatus() != TicketStatus.DRAFT) {
                // This condition will mainly apply to non-DRAFT tickets for USERs,
                // as DRAFTs are already handled by the specific check above.
                throw new UnauthorizedTicketActionException("Non autorizzato a modificare questo ticket. Gli utenti possono modificare solo le proprie bozze.");
            }
        } else if (isHelperOrPmOrAdmin) {
            if (ticket.getStatus() == TicketStatus.SOLVED && !isAdminOrPm) {
                throw new UnauthorizedTicketActionException("Non autorizzato a modificare un ticket SOLVED (solo Admin/PM).");
            }
            // For non-DRAFT tickets, Helper/PM/Admin can modify if assigned or if Admin/PM
            if (ticket.getStatus() != TicketStatus.DRAFT && !isAdminOrPm && !isAssignedToMe && !isTicketOwner) {
                 throw new UnauthorizedTicketActionException("Non autorizzato a modificare questo ticket.");
            }
        }
    } else {
        log.info("createOrUpdateTicket: Creating new ticket object.");
        ticket = new Ticket();
        ticket.setOwner(ownerUser); // Ora ownerUser è sempre impostato
        ticket.setCreatedDate(new Date());
        // For new tickets, if status is not explicitly DRAFT, it's OPEN by default for USERs
        // This is handled below in section 5.
    }

    // --- 4. Impostazione dei campi comuni del Ticket ---
    ticket.setTitle(dto.getTitle());
    ticket.setDescription(dto.getDescription());
    ticket.setPriority(dto.getPriority() != null ? dto.getPriority() : TicketPriority.MEDIUM);
    ticket.setEmail(dto.getEmail());
    ticket.setFiscalCode(dto.getFiscalCode());
    ticket.setPhoneNumber(dto.getPhoneNumber());

    Category category = categoryService.findById(dto.getCategoryId())
            .orElseThrow(() -> new RuntimeException("Categoria non trovata con ID: " + dto.getCategoryId()));
    ticket.setCategory(category);
    log.info("createOrUpdateTicket: Category set to: {}", category.getName());

    SupportService supportService = supportServicesService.findById(dto.getSupportServiceId())
            .orElseThrow(() -> new RuntimeException(
                    "Servizio di supporto non trovato con ID: " + dto.getSupportServiceId()));
    ticket.setService(supportService);
    log.info("createOrUpdateTicket: Support Service set to: {}", supportService.getTitle());

    // --- 5. Logica di Stato e Assegnazione ---
    TicketStatus desiredStatus = dto.getStatus();
    String desiredAssignedToId = dto.getAssignedToId();

    if (isNewTicketRequest) {
        if (isUserOnlyRole) {
            if (desiredStatus == TicketStatus.OPEN) {
                ticket.setStatus(TicketStatus.OPEN);
                assignTicketAutomatically(ticket); // Automatic assignment for new OPEN tickets by USER
                log.info("createOrUpdateTicket: New ticket created by USER (only), status OPEN, assigned automatically.");
            } else { // Status is DRAFT
                ticket.setStatus(TicketStatus.DRAFT);
                log.info("createOrUpdateTicket: New ticket created by USER (only), status DRAFT.");
            }
        } else { // Helper/PM/Admin create ticket:
            // They can create DRAFTs or OPEN tickets. If DRAFT, no auto-assignment.
            // If OPEN and no assignee specified, auto-assign.
            ticket.setStatus(desiredStatus != null ? desiredStatus : TicketStatus.OPEN); // Accept DRAFT if sent

            if (ticket.getStatus() == TicketStatus.OPEN) { // Only assign if the final status is OPEN
                if (desiredAssignedToId != null) {
                    User assignedToUser = userService.findUserById(desiredAssignedToId)
                            .orElseThrow(() -> new UserProfileNotFoundException("Assegnatario specificato non trovato: " + desiredAssignedToId));
                    if (!(hasRole(auth, UserRole.HELPER_JUNIOR.name()) || hasRole(auth, UserRole.HELPER_SENIOR.name()) ||
                            hasRole(auth, UserRole.PM.name()) || hasRole(auth, UserRole.ADMIN.name()))) {
                        throw new InvalidAssigneeRoleException("L'assegnatario deve essere un helper, PM o admin.");
                    }
                    ticket.setAssignedTo(assignedToUser);
                    ticket.setAssignedDate(new Date());
                    log.info("createOrUpdateTicket: New ticket created by Admin/Helper. Assigned to specified user: {}", assignedToUser.getEmail());
                    
                    // NUOVA LOGICA: Se Admin/PM/Helper assegna a se stesso, lo stato diventa ANSWERED
                    if (assignedToUser.getId().equals(currentUserId)) {
                        ticket.setStatus(TicketStatus.ANSWERED);
                        log.info("createOrUpdateTicket: Admin/Helper/PM assigned ticket to self. Status set to ANSWERED.");
                    }
                } else { // No assignee specified, auto-assign for Helper/PM/Admin creating OPEN ticket
                    assignTicketAutomatically(ticket); // Auto-assign for non-USER roles creating OPEN tickets
                    log.info("createOrUpdateTicket: New ticket created by Helper/PM/Admin. No assignee specified, assigned automatically.");
                    // L'assegnazione automatica non porta ad ANSWERED, rimane OPEN
                }
            } else { // If it's a DRAFT, ensure no assignee
                ticket.setAssignedTo(null);
                ticket.setAssignedDate(null);
                log.info("createOrUpdateTicket: New ticket created by Helper/PM/Admin. Status DRAFT, no assignee.");
            }
        }
    } else { // Aggiornamento di ticket esistente
        // Check for DRAFT to OPEN transition for automatic assignment
        if (oldStatus == TicketStatus.DRAFT && desiredStatus == TicketStatus.OPEN) {
            if (ticket.getAssignedTo() == null) { // Only assign automatically if not already assigned
                assignTicketAutomatically(ticket);
                log.info("createOrUpdateTicket: Existing DRAFT ticket {} updated to OPEN, assigned automatically.", ticket.getId());
            } else {
                log.info("createOrUpdateTicket: Existing DRAFT ticket {} updated to OPEN, but already assigned. Skipping automatic assignment.", ticket.getId());
            }
            // Se una bozza viene finalizzata a OPEN, e l'assegnatario è l'utente corrente (Admin/PM/Helper), diventa ANSWERED
            if (ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(currentUserId) && isHelperOrPmOrAdmin) {
                ticket.setStatus(TicketStatus.ANSWERED);
                log.info("createOrUpdateTicket: DRAFT finalized to OPEN by Admin/Helper/PM to self. Status set to ANSWERED.");
            }
        }
        
        if (desiredStatus != null && ticket.getStatus() != desiredStatus) {
            if (ticket.getStatus() == TicketStatus.DRAFT && desiredStatus != TicketStatus.OPEN) {
                throw new InvalidTicketStatusException("Una bozza può essere finalizzata solo a OPEN.");
            }
            ticket.setStatus(desiredStatus);
            log.info("createOrUpdateTicket: Ticket status updated to {}", desiredStatus);
        }

        if (isAdminOrPm) {
            if (desiredAssignedToId != null) {
                User assignedToUser = userService.findUserById(desiredAssignedToId)
                        .orElseThrow(() -> new UserProfileNotFoundException("Assegnatario specificato non trovato: " + desiredAssignedToId));
                if (!(assignedToUser.getRole() == UserRole.HELPER_JUNIOR || assignedToUser.getRole() == UserRole.HELPER_SENIOR ||
                        assignedToUser.getRole() == UserRole.PM || assignedToUser.getRole() == UserRole.ADMIN)) {
                    throw new InvalidAssigneeRoleException("L'assegnatario deve essere un helper, PM o admin.");
                }
                ticket.setAssignedTo(assignedToUser);
                ticket.setAssignedDate(new Date());
                log.info("createOrUpdateTicket: Admin/PM updated assignedTo to: {}", assignedToUser.getEmail());
            } else {
                ticket.setAssignedTo(null);
                ticket.setAssignedDate(null);
                log.info("createOrUpdateTicket: Admin/PM de-assigned ticket.");
            }
        }
    }

    // --- 6. Gestione della data di risoluzione ---
    if (ticket.getStatus() != TicketStatus.SOLVED && dto.getStatus() == TicketStatus.SOLVED) {
        ticket.setSolveDate(new Date());
        log.info("createOrUpdateTicket: Ticket status changed to SOLVED. Setting solveDate.");
    } else if (ticket.getStatus() == TicketStatus.SOLVED && dto.getStatus() != TicketStatus.SOLVED) {
        ticket.setSolveDate(null);
        log.info("createOrUpdateTicket: Ticket status changed from SOLVED. Clearing solveDate.");
    }

    // --- 7. Salva il ticket ---
    Ticket savedTicket = ticketRepository.save(ticket);
    log.info("Ticket saved successfully. New/Updated Ticket ID: {}", savedTicket.getId());

    // --- 8. Invio Email ---
    if (emailService.isValidEmailProvider(savedTicket.getEmail())) {
        if (isNewTicketRequest) {
            emailService.sendTicketCreationEmail(savedTicket);
            if (savedTicket.getAssignedTo() != null) {
                emailService.sendTicketAssignedEmail(savedTicket, savedTicket.getAssignedTo());
            }
        } else {
            emailService.sendTicketStatusUpdateEmail(savedTicket);
            if (oldAssignee != null && savedTicket.getAssignedTo() != null && !savedTicket.getAssignedTo().equals(oldAssignee)) {
                emailService.sendTicketReassignedEmail(savedTicket, oldAssignee, savedTicket.getAssignedTo());
            } else if (oldAssignee == null && savedTicket.getAssignedTo() != null) {
                emailService.sendTicketAssignedEmail(savedTicket, savedTicket.getAssignedTo());
            } else if (oldAssignee != null && savedTicket.getAssignedTo() == null) {
                emailService.sendTicketDeassignedEmail(savedTicket, oldAssignee);
            }
        }
    } else {
        log.warn("Email domain for ticket {} is not valid. Skipping email sending for: {}", savedTicket.getId(), savedTicket.getEmail());
    }

    return ticketMapper.toResponseDTO(savedTicket);
}

/**
 * Recupera i dettagli di un singolo ticket, con controlli di autorizzazione.
 *
 * @param ticketId ID del ticket.
 * @param auth Dettagli dell'utente autenticato.
 * @return Dettagli del ticket.
 */
public TicketResponseDTO getTicketDetails(Long ticketId, Authentication auth) {
    Ticket ticket = ticketRepository.findDetailedById(ticketId)
            .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));

    String currentUserId = getCurrentUserId(auth);
    String currentUserEmail = getCurrentUserEmail(auth);

    log.info("getTicketDetails: Current User ID: {}, Email: {}", currentUserId, currentUserEmail);

    boolean isOwner = ticket.getOwner().getId().equals(currentUserId);
    boolean isAssignedToMe = ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(currentUserId);
    boolean isAssociatedByEmail = ticket.getEmail().equals(currentUserEmail);
    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());
    boolean isHelper = hasRole(auth, UserRole.HELPER_JUNIOR.name()) || hasRole(auth, UserRole.HELPER_SENIOR.name());
    boolean isUser = hasRole(auth, UserRole.USER.name());

    if (isAdmin || isPm) {
        log.info("getTicketDetails: Admin/PM {} authorized to view ticket {}", currentUserId, ticketId);
        return ticketMapper.toResponseDTO(ticket);
    } else if (isHelper) {
        if (isAssignedToMe || (isOwner && ticket.getStatus() == TicketStatus.DRAFT)) {
            log.info("getTicketDetails: Helper {} authorized to view assigned/draft ticket {}", currentUserId, ticketId);
            return ticketMapper.toResponseDTO(ticket);
        }
    } else if (isUser) {
        if (isOwner || isAssociatedByEmail) {
            log.info("getTicketDetails: User {} authorized to view owned/associated ticket {}", currentUserId, ticketId);
            return ticketMapper.toResponseDTO(ticket);
        }
    }

    log.warn("getTicketDetails: User {} (email: {}) not authorized to view ticket {}. Owner: {}, AssignedTo: {}, Ticket Email: {}",
            currentUserId, currentUserEmail, ticketId, ticket.getOwner().getId(),
            ticket.getAssignedTo() != null ? ticket.getAssignedTo().getId() : "N/A", ticket.getEmail());
    throw new UnauthorizedTicketActionException("Non autorizzato a visualizzare questo ticket.");
}

/**
 * Elimina un ticket, con controlli di autorizzazione.
 *
 * @param ticketId ID del ticket.
 * @param auth Dettagli dell'utente autenticato.
 */
@Transactional
public void deleteTicket(Long ticketId, Authentication auth) {
    Ticket ticket = ticketRepository.findById(ticketId)
            .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));

    String currentUserId = getCurrentUserId(auth);
    String currentUserEmail = getCurrentUserEmail(auth);

    log.info("deleteTicket: Current User ID: {}, Email: {}", currentUserId, currentUserEmail);

    boolean isOwner = ticket.getOwner().getId().equals(currentUserId);
    boolean isAssociatedByEmail = ticket.getEmail().equals(currentUserEmail);
    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isHelperOrPm = hasRole(auth, UserRole.HELPER_JUNIOR.name()) || hasRole(auth, UserRole.HELPER_SENIOR.name()) || hasRole(auth, UserRole.PM.name());
    boolean isAssignedToMe = ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(currentUserId);

    if (isAdmin) {
        log.info("deleteTicket: Admin {} deleting ticket {}", currentUserId, ticketId);
        ticketRepository.delete(ticket);
        emailService.sendTicketDeletedEmail(ticket);
        return;
    } else if (hasRole(auth, UserRole.USER.name())) {
        if ((isOwner && ticket.getStatus() == TicketStatus.DRAFT) || isAssociatedByEmail) {
            log.info("deleteTicket: User {} deleting own DRAFT or associated ticket {}", currentUserId, ticketId);
            ticketRepository.delete(ticket);
            emailService.sendTicketDeletedEmail(ticket);
            return;
        }
    } else if (isHelperOrPm) {
        if (isAssignedToMe && ticket.getStatus() != TicketStatus.SOLVED) {
            log.info("deleteTicket: Helper/PM {} deleting assigned ticket {}", currentUserId, ticketId);
            ticketRepository.delete(ticket);
            emailService.sendTicketDeletedEmail(ticket);
            return;
        }
    }

    log.warn("deleteTicket: User {} (email: {}) not authorized to delete ticket {}. Owner: {}, AssignedTo: {}, Status: {}",
            currentUserId, currentUserEmail, ticketId, ticket.getOwner().getId(),
            ticket.getAssignedTo() != null ? ticket.getAssignedTo().getId() : "N/A", ticket.getStatus());
    throw new UnauthorizedTicketActionException("Non autorizzato a eliminare questo ticket.");
}

/**
 * Accetta un ticket assegnato all'utente corrente (solo per HELPER, PM, ADMIN).
 * Lo stato del ticket passa da OPEN a ANSWERED.
 *
 * @param ticketId ID del ticket.
 * @param auth Dettagli dell'utente autenticato.
 * @return Il ticket aggiornato.
 */
@Transactional
public TicketResponseDTO acceptTicket(Long ticketId, Authentication auth) {
    Ticket ticket = ticketRepository.findDetailedById(ticketId)
            .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));

    String currentUserId = getCurrentUserId(auth);
    log.info("acceptTicket: Current User ID: {}", currentUserId);

    boolean isAssignedToMe = ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(currentUserId);
    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());

    if (!isAssignedToMe && !isAdmin && !isPm) {
        throw new UnauthorizedTicketActionException("Non autorizzato ad accettare questo ticket.");
    }
    if (ticket.getStatus() != TicketStatus.OPEN) {
        throw new InvalidTicketStatusException("Il ticket deve essere in stato OPEN per essere accettato.");
    }

    if (ticket.getAssignedTo() == null || !ticket.getAssignedTo().getId().equals(currentUserId)) {
        User currentUser = userService.findUserById(currentUserId)
                .orElseThrow(() -> new UserProfileNotFoundException("Utente corrente non trovato."));
        ticket.setAssignedTo(currentUser);
        ticket.setAssignedDate(new Date());
        log.info("acceptTicket: Ticket {} assigned to user {} (self) and assignedDate set.", ticketId, currentUserId);
    }

    ticket.setStatus(TicketStatus.ANSWERED);
    Ticket savedTicket = ticketRepository.save(ticket);
    log.info("acceptTicket: Ticket {} accepted and saved. New status: {}", ticketId, savedTicket.getStatus());

    if (emailService.isValidEmailProvider(savedTicket.getEmail())) {
        emailService.sendTicketStatusUpdateEmail(savedTicket);
        emailService.sendTicketAssignedEmail(savedTicket, savedTicket.getAssignedTo());
    }

    return ticketMapper.toResponseDTO(savedTicket);
}

/**
 * Rifiuta un ticket assegnato all'utente corrente e lo riassegna a un altro non `USER` e diverso da loro stessi.
 * Il ticket deve essere in stato OPEN.
 *
 * @param ticketId ID del ticket.
 * @param newAssignedToId ID del nuovo utente a cui assegnare il ticket.
 * @param auth Dettagli dell'utente autenticato.
 * @return Il ticket aggiornato.
 */
@Transactional
public TicketResponseDTO rejectTicket(Long ticketId, String newAssignedToId, Authentication auth) {
    Ticket ticket = ticketRepository.findDetailedById(ticketId)
            .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));

    String currentUserId = getCurrentUserId(auth);
    log.info("rejectTicket: Current User ID: {}", currentUserId);
    User oldAssignee = ticket.getAssignedTo();

    boolean isAssignedToMe = oldAssignee != null && oldAssignee.getId().equals(currentUserId);
    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());

    if (!isAssignedToMe && !isAdmin && !isPm) {
        throw new UnauthorizedTicketActionException("Non autorizzato a rifiutare questo ticket.");
    }
    if (ticket.getStatus() != TicketStatus.OPEN) {
        throw new InvalidTicketStatusException("Il ticket deve essere in stato OPEN per essere rifiutato.");
    }

    User newAssignee = userService.findUserById(newAssignedToId)
            .orElseThrow(() -> new UserProfileNotFoundException("Nuovo assegnatario non trovato con ID: " + newAssignedToId));

    if (!(newAssignee.getRole() == UserRole.HELPER_JUNIOR || newAssignee.getRole() == UserRole.HELPER_SENIOR ||
            newAssignee.getRole() == UserRole.PM || newAssignee.getRole() == UserRole.ADMIN)) {
        throw new InvalidAssigneeRoleException("Il nuovo assegnatario deve essere un helper, PM o admin.");
    }
    if (newAssignedToId.equals(currentUserId)) {
        throw new IllegalArgumentException("Non puoi rifiutare e riassegnare a te stesso.");
    }

    ticket.setAssignedTo(newAssignee);
    ticket.setAssignedDate(new Date());
    ticket.setStatus(TicketStatus.OPEN);
    Ticket savedTicket = ticketRepository.save(ticket);
    log.info("rejectTicket: Ticket {} rejected and reassigned to {}. New status: {}", ticketId, newAssignee.getEmail(), savedTicket.getStatus());

    if (emailService.isValidEmailProvider(savedTicket.getEmail())) {
        emailService.sendTicketRejectedEmail(savedTicket, oldAssignee, newAssignee);
    }

    return ticketMapper.toResponseDTO(savedTicket);
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
@Transactional
public TicketResponseDTO escalateTicket(Long ticketId, String newAssignedToId, Authentication auth) {
    Ticket ticket = ticketRepository.findDetailedById(ticketId)
            .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));

    String currentUserId = getCurrentUserId(auth);
    log.info("escalateTicket: Current User ID: {}", currentUserId);
    User oldAssignee = ticket.getAssignedTo();

    boolean isAssignedToMe = oldAssignee != null && oldAssignee.getId().equals(currentUserId);
    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());

    if (!isAssignedToMe && !isAdmin && !isPm) {
        throw new UnauthorizedTicketActionException("Non autorizzato a escalare questo ticket.");
    }
    if (ticket.getStatus() != TicketStatus.ANSWERED) {
        throw new InvalidTicketStatusException("Il ticket deve essere in stato ANSWERED per essere escalato.");
    }
    if (ticket.getStatus() == TicketStatus.SOLVED) {
        throw new InvalidTicketStatusException("Non è possibile escalare un ticket SOLVED.");
    }

    User newAssignee = userService.findUserById(newAssignedToId)
            .orElseThrow(() -> new UserProfileNotFoundException("Nuovo assegnatario non trovato con ID: " + newAssignedToId));

    if (!(newAssignee.getRole() == UserRole.HELPER_JUNIOR || newAssignee.getRole() == UserRole.HELPER_SENIOR ||
            newAssignee.getRole() == UserRole.PM || newAssignee.getRole() == UserRole.ADMIN)) {
        throw new InvalidAssigneeRoleException("Il nuovo assegnatario deve essere un helper, PM o admin.");
    }
    if (newAssignedToId.equals(currentUserId)) {
        throw new IllegalArgumentException("Non puoi escalare e riassegnare a te stesso.");
    }

    ticket.setAssignedTo(newAssignee);
    ticket.setAssignedDate(new Date());
    ticket.setStatus(TicketStatus.OPEN);
    Ticket savedTicket = ticketRepository.save(ticket);
    log.info("escalateTicket: Ticket {} escalated and reassigned to {}. New status: {}", ticketId, newAssignee.getEmail(), savedTicket.getStatus());

    if (emailService.isValidEmailProvider(savedTicket.getEmail())) {
        emailService.sendTicketReassignedEmail(savedTicket, oldAssignee, newAssignee);
    }

    return ticketMapper.toResponseDTO(savedTicket);
}

/**
 * Aggiorna lo stato di un ticket (solo per ADMIN, HELPER, PM).
 * Le bozze non possono essere aggiornate direttamente tramite questo endpoint.
 * Un ticket SOLVED non può essere riaperto tramite questo endpoint (solo da Admin/PM che modificano il ticket).
 *
 * @param ticketId ID del ticket.
 * @param newStatus Il nuovo stato desiderato.
 * @param auth Dettagli dell'utente autenticato.
 * @return Il ticket aggiornato.
 */
@Transactional
public TicketResponseDTO updateStatus(Long ticketId, TicketStatus newStatus, Authentication auth) {
    Ticket ticket = ticketRepository.findDetailedById(ticketId)
            .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));

    String currentUserId = getCurrentUserId(auth);
    log.info("updateStatus: Current User ID: {}", currentUserId);

    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());
    boolean isHelper = hasRole(auth, UserRole.HELPER_JUNIOR.name()) || hasRole(auth, UserRole.HELPER_SENIOR.name());
    boolean isAssignedToMe = ticket.getAssignedTo() != null
            && ticket.getAssignedTo().getId().equals(currentUserId);

    if (!isAdmin && !isPm && (!isHelper || !isAssignedToMe)) {
        throw new UnauthorizedTicketActionException("Non autorizzato a cambiare lo stato di questo ticket.");
    }
    if (ticket.getStatus() == TicketStatus.DRAFT) {
        throw new InvalidTicketStatusException(
            "Non è possibile aggiornare lo stato di una bozza direttamente tramite questo endpoint.");
    }
    if (ticket.getStatus() == TicketStatus.SOLVED && newStatus != TicketStatus.SOLVED) {
        throw new InvalidTicketStatusException("Un ticket SOLVED non può essere riaperto tramite questo endpoint.");
    }

    if (ticket.getStatus() != TicketStatus.SOLVED && newStatus == TicketStatus.SOLVED) {
        ticket.setSolveDate(new Date());
        log.info("updateStatus: Ticket {} status changed to SOLVED. Setting solveDate.");
    } else if (ticket.getStatus() == TicketStatus.SOLVED && newStatus != TicketStatus.SOLVED) {
        ticket.setSolveDate(null);
        log.info("updateStatus: Ticket {} status changed from SOLVED. Clearing solveDate.");
    }

    ticket.setStatus(newStatus);
    Ticket savedTicket = ticketRepository.save(ticket);
    log.info("updateStatus: Ticket {} status updated to {}.", ticketId, savedTicket.getStatus());

    if (emailService.isValidEmailProvider(savedTicket.getEmail())) {
        emailService.sendTicketStatusUpdateEmail(savedTicket);
    }

    return ticketMapper.toResponseDTO(savedTicket);
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
@Transactional
public TicketResponseDTO assignTicket(Long ticketId, String helperId, Authentication auth) {
    Ticket ticket = ticketRepository.findDetailedById(ticketId)
            .orElseThrow(() -> new TicketNotFoundException("Ticket non trovato con ID: " + ticketId));

    String currentUserId = getCurrentUserId(auth);
    log.info("assignTicket: Current User ID: {}", currentUserId);

    if (!hasRole(auth, UserRole.ADMIN.name()) && !hasRole(auth, UserRole.PM.name())) {
        throw new UnauthorizedTicketActionException("Non autorizzato ad assegnare ticket.");
    }
    if (ticket.getStatus() == TicketStatus.DRAFT) {
        throw new InvalidTicketStatusException("Non è possibile assegnare una bozza.");
    }
    if (ticket.getStatus() == TicketStatus.SOLVED) {
        throw new InvalidTicketStatusException("Non è possibile riassegnare un ticket SOLVED.");
    }

    User assignee = userService.findUserById(helperId)
            .orElseThrow(() -> new UserProfileNotFoundException("Assegnatario non trovato con ID: " + helperId));

    if (!(assignee.getRole() == UserRole.HELPER_JUNIOR || assignee.getRole() == UserRole.HELPER_SENIOR ||
            assignee.getRole() == UserRole.PM || assignee.getRole() == UserRole.ADMIN)) {
        throw new InvalidAssigneeRoleException("L'assegnatario deve essere un helper, PM o admin.");
    }
    if (ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(helperId)) {
        throw new IllegalArgumentException("Il ticket è già assegnato a questo utente.");
    }

    User oldAssignee = ticket.getAssignedTo();
    ticket.setAssignedTo(assignee);
    ticket.setAssignedDate(new Date());
    Ticket savedTicket = ticketRepository.save(ticket);
    log.info("assignTicket: Ticket {} assigned to {}. Old assignee: {}", ticketId, assignee.getEmail(), oldAssignee != null ? oldAssignee.getEmail() : "N/A");

    if (emailService.isValidEmailProvider(savedTicket.getEmail())) {
        emailService.sendTicketReassignedEmail(savedTicket, oldAssignee, assignee);
    }

    return ticketMapper.toResponseDTO(savedTicket);
}

/**
 * Recupera tutti i ticket con paginazione, filtrati per ruolo utente.
 * ADMIN/PM vedono tutti i ticket (incluse bozze).
 * HELPER vedono solo i ticket a loro assegnati e le proprie bozze.
 * USER vede tutti i ticket associati alla propria email (owner o email del ticket).
 *
 * @param pageable Oggetto per la paginazione e ordinamento.
 * @param auth Dettagli dell'utente autenticato.
 * @param status Filtro per stato del ticket (opzionale).
 * @param priority Filtro per priorità del ticket (opzionale).
 * @param search Termine di ricerca per titolo/descrizione/categoria/servizio (opzionale).
 * @return Una pagina di ticket.
 */
public Page<TicketResponseDTO> getTickets(Pageable pageable, Authentication auth,
                                          TicketStatus status, TicketPriority priority, String search) {
    String currentUserId = getCurrentUserId(auth);
    String currentUserEmail = getCurrentUserEmail(auth);
    
    // Crea un nuovo Pageable con l'ordinamento forzato in DESC
    Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "createdDate"));
    
    Specification<Ticket> spec = Specification.where(null); // Default: nessuna restrizione

    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());
    boolean isHelper = hasRole(auth, UserRole.HELPER_JUNIOR.name()) || hasRole(auth, UserRole.HELPER_SENIOR.name());
    boolean isUser = hasRole(auth, UserRole.USER.name());

    if (isAdmin || isPm) {
        log.info("getTickets: Fetching ALL tickets for ADMIN/PM.");
        // spec rimane null, quindi findAll recupererà tutto
    } else if (isHelper) {
        spec = Specification.where(byAssignedToId(currentUserId))
                .or(byOwnerIdAndStatus(currentUserId, TicketStatus.DRAFT));
        log.info("getTickets: Fetching assigned tickets and own drafts for HELPER: {}", currentUserId);
    } else if (isUser) {
        spec = byOwnerIdOrTicketEmail(currentUserId, currentUserEmail);
        log.info("getTickets: Fetching all tickets (including drafts) for USER: {} or email: {}", currentUserId,
                currentUserEmail);
    } else {
        log.warn("getTickets: Unauthorized access attempt to getTickets by user: {}", currentUserId);
        return Page.empty(pageable); // Nessun ruolo riconosciuto, restituisci pagina vuota
    }

    // --- Applicazione dei filtri aggiuntivi ---
    if (status != null) {
        spec = spec.and(byStatus(status));
        log.info("getTickets: Applying status filter: {}", status);
    }
    if (priority != null) {
        spec = spec.and(byPriority(priority)); // Usa la nuova specifica byPriority
        log.info("getTickets: Applying priority filter: {}", priority);
    }
    if (search != null && !search.trim().isEmpty()) {
        spec = spec.and(byKeywordInTicketDetails(search.trim())); // Usa la nuova specifica byKeywordInTicketDetails
        log.info("getTickets: Applying search filter: '{}'", search.trim());
    }

    Page<Ticket> ticketsPage = ticketRepository.findAll(spec, sortedPageable); // Usa sortedPageable
    log.info("getTickets: Found {} tickets for user {}. Role: {}. Total elements in page: {}", ticketsPage.getTotalElements(), currentUserId, auth.getAuthorities(), ticketsPage.getContent().size());
    return ticketsPage.map(ticketMapper::toResponseDTO);
}

/**
 * Recupera tutti i ticket dove l'utente è l'owner O la sua email corrisponde all'email del ticket.
 * Questo endpoint è pensato per i ruoli USER che devono vedere ticket creati da altri ma a loro associati via email.
 *
 * @param pageable Oggetto per la paginazione e ordinamento.
 * @param auth Dettagli dell'utente autenticato.
 * @param status Filtro per stato del ticket (opzionale).
 * @param priority Filtro per priorità del ticket (opzionale).
 * @param search Termine di ricerca per titolo/descrizione/categoria/servizio (opzionale).
 * @return Una pagina di ticket.
 */
public Page<TicketResponseDTO> getMyTicketsAndAssociatedByEmail(Pageable pageable, Authentication auth,
                                                                TicketStatus status, TicketPriority priority, String search) {
    String userId = getCurrentUserId(auth);
    String userEmail = getCurrentUserEmail(auth);
    log.info("getMyTicketsAndAssociatedByEmail: Fetching my tickets and associated by email for user ID: {} or email: {}", userId,
            userEmail);

    // Crea un nuovo Pageable con l'ordinamento forzato in DESC
    Pageable sortedPageable = PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), Sort.by(Sort.Direction.DESC, "createdDate"));

    Specification<Ticket> spec = byOwnerIdOrTicketEmail(userId, userEmail);
    
    // --- Applicazione dei filtri aggiuntivi ---
    if (status != null) {
        spec = spec.and(byStatus(status));
        log.info("getMyTicketsAndAssociatedByEmail: Applying status filter: {}", status);
    }
    if (priority != null) {
        spec = spec.and(byPriority(priority)); // Usa la nuova specifica byPriority
        log.info("getMyTicketsAndAssociatedByEmail: Applying priority filter: {}", priority);
    }
    if (search != null && !search.trim().isEmpty()) {
        spec = spec.and(byKeywordInTicketDetails(search.trim())); // Usa la nuova specifica byKeywordInTicketDetails
        log.info("getMyTicketsAndAssociatedByEmail: Applying search filter: '{}'", search.trim());
    }

    Page<Ticket> ticketsPage = ticketRepository.findAll(spec, sortedPageable); // Usa sortedPageable
    return ticketsPage.map(ticketMapper::toResponseDTO);
}

/**
 * Recupera tutte le bozze create dall'utente corrente.
 *
 * @param auth Dettagli dell'utente autenticato.
 * @return Lista di bozze.
 */
public List<TicketResponseDTO> getDrafts(Authentication auth) {
    String userId = getCurrentUserId(auth);
    log.info("getDrafts: Fetching drafts for user ID: {}", userId);

    Specification<Ticket> spec = byOwnerIdAndStatus(userId, TicketStatus.DRAFT);

    List<Ticket> drafts = ticketRepository.findAll(spec);
    return drafts.stream()
            .map(ticketMapper::toResponseDTO)
            .toList();
}

// Metodi per i conteggi della dashboard
public DashboardCountsDTO getDashboardCounts(Authentication auth) {
    String userId = getCurrentUserId(auth);
    String userEmail = getCurrentUserEmail(auth);

    log.info("getDashboardCounts: User {} has authorities: {}", userId, auth.getAuthorities());

    DashboardCountsDTO counts = new DashboardCountsDTO();

    boolean isUserRole = hasRole(auth, UserRole.USER.name());
    boolean isAdmin = hasRole(auth, UserRole.ADMIN.name());
    boolean isPm = hasRole(auth, UserRole.PM.name());
    boolean isHelper = hasRole(auth, UserRole.HELPER_JUNIOR.name()) || hasRole(auth, UserRole.HELPER_SENIOR.name());

    if (isAdmin || isPm) {
        log.info("getDashboardCounts: Processing for ADMIN/PM role. User ID: {}", userId);
        counts.setTotalTickets(ticketRepository.count());
        counts.setOpenTickets(ticketRepository.countByStatus(TicketStatus.OPEN));
        counts.setAnsweredTickets(ticketRepository.countByStatus(TicketStatus.ANSWERED));
        counts.setSolvedTickets(ticketRepository.countByStatus(TicketStatus.SOLVED));
        counts.setDraftTickets(ticketRepository.countByStatus(TicketStatus.DRAFT));
    } else if (isHelper) {
        log.info("getDashboardCounts: Processing for HELPER role. User ID: {}", userId);
        Specification<Ticket> helperSpec = Specification.where(byAssignedToId(userId))
                                                .or(byOwnerIdAndStatus(userId, TicketStatus.DRAFT));
        counts.setTotalTickets(ticketRepository.count(helperSpec));
        counts.setOpenTickets(
                ticketRepository.count(Specification.where(byAssignedToId(userId)).and(byStatus(TicketStatus.OPEN))));
        counts.setAnsweredTickets(
                ticketRepository.count(Specification.where(byAssignedToId(userId)).and(byStatus(TicketStatus.ANSWERED))));
        counts.setSolvedTickets(
                ticketRepository.count(Specification.where(byAssignedToId(userId)).and(byStatus(TicketStatus.SOLVED))));
        counts.setDraftTickets(ticketRepository.countByOwner_IdAndStatus(userId, TicketStatus.DRAFT));
    } else if (isUserRole) {
        log.info("getDashboardCounts: Processing for USER role. User ID: {}, Email: {}", userId, userEmail);
        Specification<Ticket> userTicketsSpec = byOwnerIdOrTicketEmail(userId, userEmail);
        counts.setTotalTickets(ticketRepository.count(userTicketsSpec));
        counts.setOpenTickets(
                ticketRepository.count(Specification.where(userTicketsSpec).and(byStatus(TicketStatus.OPEN))));
        counts.setAnsweredTickets(
                ticketRepository.count(Specification.where(userTicketsSpec).and(byStatus(TicketStatus.ANSWERED))));
        counts.setSolvedTickets(
                ticketRepository.count(Specification.where(userTicketsSpec).and(byStatus(TicketStatus.SOLVED))));
        counts.setDraftTickets(ticketRepository.countByOwner_IdAndStatus(userId, TicketStatus.DRAFT));
    } else {
        log.warn("getDashboardCounts: Unauthorized access attempt to getDashboardCounts by user: {}", userId);
        return new DashboardCountsDTO(0, 0, 0, 0, 0);
    }
    log.info("getDashboardCounts for {}: Total={}, Open={}, Answered={}, Solved={}, Draft={}",
            isUserRole ? "USER" : (isAdmin || isPm ? "ADMIN/PM" : "HELPER"),
            counts.getTotalTickets(), counts.getOpenTickets(), counts.getAnsweredTickets(),
            counts.getSolvedTickets(), counts.getDraftTickets());
    return counts;
}

/**
 * Assegnazione automatica del ticket a Helper_Junior, Helper_Senior, PM, o Admin
 * in base al minor numero di ticket OPEN o ANSWERED assegnati.
 *
 * @param ticket Il ticket da assegnare.
 */
private void assignTicketAutomatically(Ticket ticket) {
    log.info("assignTicketAutomatically: Attempting automatic assignment for ticket ID: {}", ticket.getId());
    
    // Recupera tutti gli utenti che possono essere assegnatari
    List<User> potentialAssignees = userService.getUsersEntitiesByRoles(List.of(
        UserRole.HELPER_JUNIOR,
        UserRole.HELPER_SENIOR,
        UserRole.PM,
        UserRole.ADMIN
    ));

    if (potentialAssignees.isEmpty()) {
        log.error("assignTicketAutomatically: Nessun helper, PM o admin disponibile per l'assegnazione automatica per ticket ID: {}. Il ticket rimarrà non assegnato.", ticket.getId());
        ticket.setAssignedTo(null);
        ticket.setAssignedDate(null);
        return;
    }

    // Mappa gli assegnatari potenziali al loro carico di lavoro attuale
    Map<User, Long> assigneesLoad = potentialAssignees.stream()
        .collect(Collectors.toMap(
            user -> user,
            user -> ticketRepository.count(
                Specification.where(byAssignedToId(user.getId()))
                    .and(byStatus(TicketStatus.OPEN))
                    .or(byAssignedToId(user.getId()).and(byStatus(TicketStatus.ANSWERED)))
            )
        ));

    // Trova l'utente con il minor numero di ticket in carico
    User assignedUser = assigneesLoad.entrySet().stream()
        .min(Comparator.comparingLong(Map.Entry::getValue))
        .map(Map.Entry::getKey)
        .orElse(null); // Dovrebbe sempre trovare uno se potentialAssignees non è vuoto

    if (assignedUser != null) {
        ticket.setAssignedTo(assignedUser);
        if (ticket.getAssignedDate() == null) {
            ticket.setAssignedDate(new Date());
        }
        log.info("assignTicketAutomatically: Ticket {} assigned to {} (Role: {}, Load: {}).",
                 ticket.getId(), assignedUser.getEmail(), assignedUser.getRole(), assigneesLoad.get(assignedUser));
    } else {
        // Questo blocco dovrebbe essere raggiunto solo se potentialAssignees era vuoto,
        // ma è un fallback di sicurezza.
        log.error("assignTicketAutomatically: Fallback: Nessun utente idoneo trovato per l'assegnazione automatica per ticket ID: {}. Il ticket rimarrà non assegnato.", ticket.getId());
        ticket.setAssignedTo(null);
        ticket.setAssignedDate(null);
    }
}
}
