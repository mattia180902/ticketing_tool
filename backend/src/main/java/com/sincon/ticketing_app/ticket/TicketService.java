package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.category.CategoryRepository;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.enums.UserRole;
import com.sincon.ticketing_app.exception.ResourceNotFoundException;
import com.sincon.ticketing_app.exception.ValidationException;
import com.sincon.ticketing_app.notification.NotificationService;
import com.sincon.ticketing_app.supportservice.SupportService;
import com.sincon.ticketing_app.supportservice.SupportServiceRepository;
import com.sincon.ticketing_app.ticketHistory.TicketHistoryService;
import com.sincon.ticketing_app.user.User;
import com.sincon.ticketing_app.user.UserRepository;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketMapper ticketMapper;
    private final UserRepository userRepository;
    private final CategoryRepository categoryRepository;
    private final SupportServiceRepository supportServiceRepository;
    private final NotificationService notificationService;
    private final TicketHistoryService ticketHistoryService;

    // Pattern per la validazione dell'email
    private static final Pattern EMAIL_PATTERN = Pattern.compile("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,6}$");

    /**
     * Valida il formato di un'email.
     * @param email L'email da validare.
     * @return true se il formato è valido, false altrimenti.
     */
    private boolean isValidEmailFormat(String email) {
        return email != null && EMAIL_PATTERN.matcher(email).matches();
    }

    /**
     * Recupera l'utente corrente autenticato.
     * @param auth Oggetto Authentication contenente i dettagli dell'utente.
     * @return L'entità User dell'utente corrente.
     * @throws ResourceNotFoundException se l'utente non viene trovato.
     */
    private User getCurrentUser(Authentication auth) {
        return userRepository.findById(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + auth.getName()));
    }

    /**
     * Crea o aggiorna un ticket. Gestisce la logica per le bozze, l'assegnazione automatica e le validazioni basate sul ruolo.
     * @param dto DTO di richiesta contenente i dati del ticket.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @param ticketId ID del ticket da aggiornare (null per la creazione).
     * @return DTO di risposta del ticket creato o aggiornato.
     * @throws ResourceNotFoundException se il ticket, categoria, servizio o utente non vengono trovati.
     * @throws AccessDeniedException se l'utente non è autorizzato ad aggiornare il ticket.
     * @throws ValidationException se i dati forniti non sono validi.
     */
    @Transactional
    public TicketResponseDTO createOrUpdateTicket(TicketRequestDTO dto, Authentication auth, Long ticketId) {
        User creator = getCurrentUser(auth);
        Ticket existingTicket = null;
        TicketStatus oldStatus = null; // Inizializza oldStatus

        // Logica per l'aggiornamento di un ticket esistente
        if (ticketId != null) {
            existingTicket = ticketRepository.findById(ticketId)
                    .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with ID: " + ticketId));
            oldStatus = existingTicket.getStatus(); // Salva lo stato precedente per la history

            // Permetti l'aggiornamento delle bozze solo al creatore o a un ADMIN
            if (existingTicket.getStatus() == TicketStatus.DRAFT && !existingTicket.getOwner().getId().equals(creator.getId()) && creator.getRole() != UserRole.ADMIN) {
                throw new AccessDeniedException("You are not authorized to update this draft ticket.");
            }
            // Per ticket non-bozza, solo ADMIN o l'assegnatario possono aggiornare (non lo stato direttamente qui)
            if (existingTicket.getStatus() != TicketStatus.DRAFT && creator.getRole() != UserRole.ADMIN &&
                (existingTicket.getAssignedTo() == null || !existingTicket.getAssignedTo().getId().equals(creator.getId()))) {
                throw new AccessDeniedException("You are not authorized to update this ticket.");
            }
        }

        // Determina lo stato desiderato (default OPEN se non specificato)
        TicketStatus desiredStatus = dto.getStatus() != null ? dto.getStatus() : TicketStatus.OPEN;

        String ticketEmail = dto.getEmail();
        String ticketPhoneNumber = dto.getPhoneNumber();
        String ticketFiscalCode = dto.getFiscalCode();

        // Validazione formato email se fornita
        if (ticketEmail != null && !ticketEmail.isBlank() && !isValidEmailFormat(ticketEmail)) {
            throw new ValidationException("Invalid email format provided for the ticket.");
        }

        // Logica per utenti di ruolo USER: l'email è sempre la loro, e i dati di contatto possono essere aggiornati
        if (creator.getRole() == UserRole.USER) {
            ticketEmail = creator.getEmail(); // L'email del ticket è quella del creatore
            if (desiredStatus != TicketStatus.DRAFT) { // Se non è una bozza, aggiorna i dati dell'utente
                if (ticketPhoneNumber != null && !ticketPhoneNumber.isBlank()) creator.setPhoneNumber(ticketPhoneNumber);
                if (ticketFiscalCode != null && !ticketFiscalCode.isBlank()) creator.setFiscalCode(ticketFiscalCode);
                userRepository.save(creator); // Salva l'utente con i dati aggiornati
            }
        } else {
            // Per ruoli non-USER (es. ADMIN, HELPER), l'email deve essere fornita e valida se non è una bozza
            if (desiredStatus != TicketStatus.DRAFT) {
                if (ticketEmail == null || ticketEmail.isBlank()) {
                    throw new ValidationException("Email is required for non-user roles creating a final ticket.");
                }
                // Tenta di trovare e aggiornare un utente esistente con l'email fornita
                Optional<User> existingUserOpt = userRepository.findByEmail(ticketEmail);
                if (existingUserOpt.isPresent()) {
                    User targetUser = existingUserOpt.get();
                    if (ticketPhoneNumber != null && !ticketPhoneNumber.isBlank()) targetUser.setPhoneNumber(ticketPhoneNumber);
                    if (ticketFiscalCode != null && !ticketFiscalCode.isBlank()) targetUser.setFiscalCode(ticketFiscalCode);
                    userRepository.save(targetUser);
                }
            }
        }

        // Validazione per ticket finali (non bozze)
        if (desiredStatus == TicketStatus.OPEN) {
            validateFinalTicket(dto); // Valida campi obbligatori del DTO
            if (ticketEmail == null || ticketEmail.isBlank()) throw new ValidationException("Email is required for final tickets.");
            if (ticketPhoneNumber == null || ticketPhoneNumber.isBlank()) throw new ValidationException("Phone Number is required for final tickets.");
            if (ticketFiscalCode == null || ticketFiscalCode.isBlank()) throw new ValidationException("Fiscal Code is required for final tickets.");
        }

        // Recupero Categoria
        Category category = null;
        if (dto.getCategoryId() != null) {
            category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found with ID: " + dto.getCategoryId()));
        } else if (desiredStatus == TicketStatus.OPEN) {
             throw new ValidationException("Category is required for non-draft tickets.");
        }

        // Recupero Servizio di Supporto
        SupportService service = null;
        if (dto.getSupportServiceId() != null) {
            service = supportServiceRepository.findById(dto.getSupportServiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Service not found with ID: " + dto.getSupportServiceId()));
        } else if (desiredStatus == TicketStatus.OPEN) {
            throw new ValidationException("Support Service is required for non-draft tickets.");
        }

        // Logica di Assegnazione
        User assignedTo = null;
        if (dto.getAssignedToId() != null && !dto.getAssignedToId().isBlank()) {
            // Se un assignedToId è fornito, cerca l'utente e validane il ruolo
            assignedTo = userRepository.findById(dto.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("Helper not found with ID: " + dto.getAssignedToId()));
            if (!List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN).contains(assignedTo.getRole())) {
                throw new ValidationException("The assigned user must be a helper, PM or an admin.");
            }
        } else if (desiredStatus == TicketStatus.OPEN && creator.getRole() == UserRole.USER) {
            // Assegnazione automatica solo se un USER crea un ticket OPEN e non ha specificato assignedToId
            assignedTo = findAvailableHelperOrAdmin();
        }

        Ticket ticketToSave;
        if (existingTicket != null) {
            // Aggiorna il ticket esistente
            ticketToSave = existingTicket;
            ticketToSave.setTitle(dto.getTitle());
            ticketToSave.setDescription(dto.getDescription());
            ticketToSave.setPriority(dto.getPriority());
            ticketToSave.setCategory(category);
            ticketToSave.setService(service);
            ticketToSave.setEmail(ticketEmail);
            ticketToSave.setPhoneNumber(ticketPhoneNumber);
            ticketToSave.setFiscalCode(ticketFiscalCode);

            // Aggiorna l'assegnatario solo se esplicitamente fornito o se la logica automatica lo ha impostato
            if (dto.getAssignedToId() != null || (desiredStatus == TicketStatus.OPEN && creator.getRole() == UserRole.USER && assignedTo != null)) {
                ticketToSave.setAssignedTo(assignedTo);
            }
            ticketToSave.setStatus(desiredStatus); // Aggiorna lo stato

        } else {
            // Crea un nuovo ticket
            ticketToSave = ticketMapper.fromRequestDTO(dto, creator, category, service, assignedTo);
            ticketToSave.setStatus(desiredStatus);
            ticketToSave.setEmail(ticketEmail);
            ticketToSave.setPhoneNumber(ticketPhoneNumber);
            ticketToSave.setFiscalCode(ticketFiscalCode);
            ticketToSave.setOwner(creator); // Imposta l'owner (popola il campo owner nella Ticket entity)
            // createdDate, lastModifiedDate, createdBy, lastModifiedBy sono gestiti da Auditable
        }

        Ticket savedTicket = ticketRepository.save(ticketToSave);

        // Notifiche e registrazione della storia del ticket solo se non è una bozza
        if (desiredStatus != TicketStatus.DRAFT) {
            // Notifica al creatore (owner) del ticket
            if (savedTicket.getOwner() != null && isValidEmailFormat(savedTicket.getOwner().getEmail())) {
                notificationService.sendTicketCreationEmail(savedTicket);
            } else {
                log.warn("Skipping ticket creation email for ID {} due to invalid email format: {}", savedTicket.getId(), savedTicket.getOwner() != null ? savedTicket.getOwner().getEmail() : "N/A");
            }

            // Notifica all'assegnatario se presente e valido
            if (savedTicket.getAssignedTo() != null && isValidEmailFormat(savedTicket.getAssignedTo().getEmail())) {
                notificationService.sendTicketAssignedEmail(savedTicket);
            } else if (savedTicket.getAssignedTo() != null) {
                log.warn("Skipping ticket assigned email for ID {} to helper {} due to invalid email format: {}", savedTicket.getId(), savedTicket.getAssignedTo().getId(), savedTicket.getAssignedTo().getEmail());
            }

            // Registra la storia solo se è una nuova creazione o se una bozza diventa un ticket finale
            if (existingTicket == null || oldStatus == TicketStatus.DRAFT) {
                 ticketHistoryService.recordHistory(savedTicket, TicketStatus.DRAFT, savedTicket.getStatus(), creator, null);
            }
        }
        return ticketMapper.toResponseDTO(savedTicket);
    }

    /**
     * Trova un helper junior disponibile o, in assenza, un admin per l'assegnazione automatica.
     * @return L'utente helper o admin disponibile.
     * @throws IllegalStateException se nessun helper junior o admin è disponibile.
     */
    private User findAvailableHelperOrAdmin() {
        // Cerca un HELPER_JUNIOR
        List<User> helperJuniors = userRepository.findByRole(UserRole.HELPER_JUNIOR);
        if (!helperJuniors.isEmpty()) {
            // Puoi implementare una logica di bilanciamento del carico qui (es. il meno occupato)
            return helperJuniors.get(0);
        }

        // Se nessun HELPER_JUNIOR, cerca un ADMIN
        List<User> admins = userRepository.findByRole(UserRole.ADMIN);
        if (!admins.isEmpty()) {
            return admins.get(0); // Prendi il primo admin disponibile
        }

        throw new IllegalStateException("No helper junior or admin available for automatic assignment.");
    }

    /**
     * Accetta un ticket assegnato all'utente corrente, cambiando il suo stato in ANSWERED.
     * @param ticketId ID del ticket da accettare.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return DTO di risposta del ticket aggiornato.
     * @throws ResourceNotFoundException se il ticket non viene trovato.
     * @throws AccessDeniedException se l'utente non è l'assegnatario del ticket.
     * @throws ValidationException se il ticket non è nello stato OPEN.
     */
    @Transactional
    public TicketResponseDTO acceptTicket(Long ticketId, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with ID: " + ticketId));

        User currentUser = getCurrentUser(auth);

        if (ticket.getAssignedTo() == null || !ticket.getAssignedTo().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not authorized to accept this ticket, as you are not the assigned helper.");
        }

        if (ticket.getStatus() != TicketStatus.OPEN) {
            throw new ValidationException("Only tickets with status OPEN can be accepted.");
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setStatus(TicketStatus.ANSWERED);
        Ticket savedTicket = ticketRepository.save(ticket);

        ticketHistoryService.recordHistory(savedTicket, oldStatus, savedTicket.getStatus(), currentUser, null);

        if (savedTicket.getOwner() != null && isValidEmailFormat(savedTicket.getOwner().getEmail())) {
            notificationService.sendTicketStatusUpdateEmail(savedTicket);
        } else if (savedTicket.getOwner() != null) {
            log.warn("Skipping ticket status update email for ID {} to owner {} due to invalid email format: {}", savedTicket.getId(), savedTicket.getOwner().getId(), savedTicket.getOwner().getEmail());
        }

        return ticketMapper.toResponseDTO(savedTicket);
    }

    /**
     * Rifiuta un ticket assegnato all'utente corrente e lo riassegna a un nuovo helper/admin.
     * @param ticketId ID del ticket da rifiutare.
     * @param newAssignedToId ID del nuovo utente a cui assegnare il ticket.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return DTO di risposta del ticket aggiornato.
     * @throws ResourceNotFoundException se il ticket o il nuovo assegnatario non vengono trovati.
     * @throws AccessDeniedException se l'utente non è l'assegnatario del ticket.
     * @throws ValidationException se il ticket non è nello stato OPEN o il nuovo assegnatario non è un helper/admin.
     */
    @Transactional
    public TicketResponseDTO rejectTicket(Long ticketId, String newAssignedToId, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with ID: " + ticketId));

        User currentUser = getCurrentUser(auth);

        if (ticket.getAssignedTo() == null || !ticket.getAssignedTo().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not authorized to reject this ticket, as you are not the assigned helper.");
        }

        if (ticket.getStatus() != TicketStatus.OPEN) {
            throw new ValidationException("Only tickets with status OPEN can be rejected.");
        }

        User newAssignedTo = userRepository.findById(newAssignedToId)
                .orElseThrow(() -> new ResourceNotFoundException("New assigned helper not found with ID: " + newAssignedToId));

        if (!List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN).contains(newAssignedTo.getRole())) {
            throw new ValidationException("The new assigned user must be a helper or an admin.");
        }

        TicketStatus oldStatus = ticket.getStatus();
        User oldAssignedTo = ticket.getAssignedTo();

        ticket.setAssignedTo(newAssignedTo);
        Ticket savedTicket = ticketRepository.save(ticket);

        ticketHistoryService.recordHistory(savedTicket, oldStatus, savedTicket.getStatus(), currentUser, "Ticket rejected and reassigned from " + (oldAssignedTo != null ? oldAssignedTo.getFullName() : "N/A") + " to " + newAssignedTo.getFullName());

        if (newAssignedTo != null && isValidEmailFormat(newAssignedTo.getEmail())) {
            notificationService.sendTicketReassignedEmail(savedTicket);
        } else if (newAssignedTo != null) {
             log.warn("Skipping ticket reassigned email for ID {} to new helper {} due to invalid email format: {}", savedTicket.getId(), newAssignedTo.getId(), newAssignedTo.getEmail());
        }

        return ticketMapper.toResponseDTO(savedTicket);
    }

    /**
     * Escala un ticket assegnato all'utente corrente, riassegnandolo a un nuovo helper/admin e riportandolo allo stato OPEN.
     * @param ticketId ID del ticket da escalare.
     * @param newAssignedToId ID del nuovo utente a cui assegnare il ticket.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return DTO di risposta del ticket aggiornato.
     * @throws ResourceNotFoundException se il ticket o il nuovo assegnatario non vengono trovati.
     * @throws AccessDeniedException se l'utente non è l'assegnatario del ticket.
     * @throws ValidationException se il ticket non è nello stato ANSWERED o il nuovo assegnatario non è un helper/admin.
     */
    @Transactional
    public TicketResponseDTO escalateTicket(Long ticketId, String newAssignedToId, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with ID: " + ticketId));

        User currentUser = getCurrentUser(auth);

        if (ticket.getAssignedTo() == null || !ticket.getAssignedTo().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You are not authorized to escalate this ticket, as you are not the assigned helper.");
        }

        if (ticket.getStatus() != TicketStatus.ANSWERED) {
            throw new ValidationException("Only tickets with status ANSWERED can be escalated.");
        }

        User newAssignedTo = userRepository.findById(newAssignedToId)
                .orElseThrow(() -> new ResourceNotFoundException("New assigned helper not found with ID: " + newAssignedToId));

        if (!List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN).contains(newAssignedTo.getRole())) {
            throw new ValidationException("The new assigned user must be a helper or an admin.");
        }

        TicketStatus oldStatus = ticket.getStatus();
        User oldAssignedTo = ticket.getAssignedTo();

        ticket.setAssignedTo(newAssignedTo);
        ticket.setStatus(TicketStatus.OPEN); // Dopo l'escalation torna OPEN
        Ticket savedTicket = ticketRepository.save(ticket);

        ticketHistoryService.recordHistory(savedTicket, oldStatus, savedTicket.getStatus(), currentUser, "Ticket escalated and reassigned from " + (oldAssignedTo != null ? oldAssignedTo.getFullName() : "N/A") + " to " + newAssignedTo.getFullName());

        if (newAssignedTo != null && isValidEmailFormat(newAssignedTo.getEmail())) {
            notificationService.sendTicketReassignedEmail(savedTicket);
        } else {
            log.warn("Skipping ticket reassigned email for ID {} to new helper {} due to invalid email format: {}", savedTicket.getId(), newAssignedTo.getId(), newAssignedTo.getEmail());
        }

        return ticketMapper.toResponseDTO(savedTicket);
    }

    /**
     * Valida i campi obbligatori per un ticket che non è una bozza.
     * @param dto DTO del ticket da validare.
     * @throws ValidationException se mancano campi obbligatori.
     */
    private void validateFinalTicket(TicketRequestDTO dto) {
        if (dto.getTitle() == null || dto.getTitle().isBlank()) throw new ValidationException("Il titolo del ticket è obbligatorio.");
        if (dto.getDescription() == null || dto.getDescription().isBlank()) throw new ValidationException("La descrizione del ticket è obbligatoria.");
        if (dto.getPriority() == null) throw new ValidationException("La priorità del ticket è obbligatoria.");
        if (dto.getCategoryId() == null) throw new ValidationException("È obbligatorio selezionare una categoria.");
        if (dto.getSupportServiceId() == null) throw new ValidationException("È obbligatorio selezionare un servizio di supporto.");
    }

    /**
     * Recupera tutti gli utenti con un ruolo specifico.
     * @param role Il ruolo da cercare.
     * @return Una lista di utenti con il ruolo specificato.
     */
    public List<User> getHelpersByRole(UserRole role) {
        return userRepository.findByRole(role);
    }

    /**
     * Recupera tutti gli utenti che possono essere considerati "helper" (JUNIOR, SENIOR, PM, ADMIN).
     * @return Una lista di tutti gli helper.
     */
    public List<User> getAllHelpers() {
        return userRepository.findByRoleIn(List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN));
    }

    /**
     * Recupera tutti i ticket di proprietà dell'utente corrente, escluse le bozze.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return Una lista di DTO dei ticket.
     */
    public List<TicketResponseDTO> getMyTickets(Authentication auth) {
        String userId = getCurrentUser(auth).getId();
        return ticketRepository.findByOwner_IdAndStatusNot(userId, TicketStatus.DRAFT)
                .stream()
                .map(ticketMapper::toResponseDTO)
                .toList();
    }

    /**
     * Recupera i ticket di proprietà dell'utente corrente in base a uno stato specifico.
     * @param status Lo stato dei ticket da cercare.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return Una lista di DTO dei ticket.
     */
    public List<TicketResponseDTO> getMyTicketsByStatus(TicketStatus status, Authentication auth) {
        String userId = getCurrentUser(auth).getId();
        return ticketRepository.findByOwner_IdAndStatus(userId, status)
                .stream()
                .map(ticketMapper::toResponseDTO)
                .toList();
    }

    /**
     * Recupera tutte le bozze create dall'utente corrente.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return Una lista di DTO dei ticket in stato DRAFT.
     */
    public List<TicketResponseDTO> getDrafts(Authentication auth) {
        String userId = getCurrentUser(auth).getId();
        return ticketRepository.findByOwner_IdAndStatus(userId, TicketStatus.DRAFT)
                .stream()
                .map(ticketMapper::toResponseDTO)
                .toList();
    }

    /**
     * Elimina un ticket. Solo l'owner di una bozza o un ADMIN possono eliminare.
     * @param ticketId ID del ticket da eliminare.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @throws ResourceNotFoundException se il ticket non viene trovato.
     * @throws AccessDeniedException se l'utente non è autorizzato a eliminare il ticket.
     */
    @Transactional
    public void deleteTicket(Long ticketId, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        User user = getCurrentUser(auth);

        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        boolean isOwner = ticket.getOwner().getId().equals(user.getId());

        if (ticket.getStatus() == TicketStatus.DRAFT && !isOwner && !isAdmin) {
             throw new AccessDeniedException("You cannot delete this draft ticket.");
        } else if (ticket.getStatus() != TicketStatus.DRAFT && !isAdmin) {
             throw new AccessDeniedException("You cannot delete this ticket.");
        }
        ticketRepository.delete(ticket);
    }

    /**
     * Aggiorna lo stato di un ticket. Accessibile solo a ADMIN o all'assegnatario.
     * @param ticketId ID del ticket da aggiornare.
     * @param newStatus Il nuovo stato desiderato.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return DTO di risposta del ticket aggiornato.
     * @throws ResourceNotFoundException se il ticket non viene trovato.
     * @throws ValidationException se si tenta di aggiornare una bozza direttamente o di cambiare stato da SOLVED.
     * @throws AccessDeniedException se l'utente non è autorizzato.
     */
    @Transactional
    public TicketResponseDTO updateStatus(Long ticketId, TicketStatus newStatus, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        User user = getCurrentUser(auth);

        if (ticket.getStatus() == TicketStatus.DRAFT) {
            throw new ValidationException("Cannot update status of a DRAFT ticket directly. Use create/update endpoint to finalize it.");
        }

        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        boolean isAssignedTo = ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(user.getId());

        if (!isAdmin && !isAssignedTo) {
            throw new AccessDeniedException("You are not authorized to update this ticket's status.");
        }

        if (ticket.getStatus() == TicketStatus.SOLVED && newStatus != TicketStatus.SOLVED) {
            throw new ValidationException("Cannot change status from SOLVED.");
        }

        // Permetti solo agli ADMIN di forzare transizioni particolari (es. da ANSWERED a OPEN se non escalation)
        if (ticket.getStatus() == TicketStatus.ANSWERED && newStatus == TicketStatus.OPEN && user.getRole() != UserRole.ADMIN) {
            throw new ValidationException("Direct transition from ANSWERED to OPEN is not allowed outside of escalation process for non-admin users.");
        }

        TicketStatus oldStatus = ticket.getStatus();
        ticket.setStatus(newStatus);
        Ticket saved = ticketRepository.save(ticket);

        ticketHistoryService.recordHistory(saved, oldStatus, newStatus, user, null);
        if (saved.getOwner() != null && isValidEmailFormat(saved.getOwner().getEmail())) {
            notificationService.sendTicketStatusUpdateEmail(saved);
        } else {
             log.warn("Skipping ticket status update email for ID {} to owner {} due to invalid email format: {}", saved.getId(), saved.getOwner() != null ? saved.getOwner().getId() : "N/A", saved.getOwner() != null ? saved.getOwner().getEmail() : "N/A");
        }

        return ticketMapper.toResponseDTO(saved);
    }

    /**
     * Assegna un ticket a un helper/admin specifico. Solo ADMIN o PM possono eseguire questa operazione.
     * @param ticketId ID del ticket da assegnare.
     * @param helperId ID dell'utente a cui assegnare il ticket.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return DTO di risposta del ticket aggiornato.
     * @throws ResourceNotFoundException se il ticket o l'helper non vengono trovati.
     * @throws AccessDeniedException se l'utente non è autorizzato.
     * @throws ValidationException se si tenta di assegnare una bozza o un utente non idoneo.
     */
    @Transactional
    public TicketResponseDTO assignTicket(Long ticketId, String helperId, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        User assigner = getCurrentUser(auth);
        User assignee = userRepository.findById(helperId)
                .orElseThrow(() -> new ResourceNotFoundException("Helper not found"));

        if (!List.of(UserRole.ADMIN, UserRole.PM).contains(assigner.getRole())) {
            throw new AccessDeniedException("You cannot assign this ticket.");
        }
        if (ticket.getStatus() == TicketStatus.DRAFT) {
            throw new ValidationException("Cannot assign a DRAFT ticket.");
        }
        
        if (!List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN).contains(assignee.getRole())) {
            throw new ValidationException("Only helpers or admins can be assigned a ticket.");
        }

        ticket.setAssignedTo(assignee);
        // Se un ticket OPEN viene assegnato manualmente, il suo stato può diventare ANSWERED
        if (ticket.getStatus() == TicketStatus.OPEN) {
            ticket.setStatus(TicketStatus.ANSWERED);
        }

        Ticket saved = ticketRepository.save(ticket);
        
        if (assignee != null && isValidEmailFormat(assignee.getEmail())) {
            notificationService.sendTicketAssignedEmail(saved);
        } else {
            log.warn("Skipping ticket assigned email for ID {} to helper {} due to invalid email format: {}", saved.getId(), assignee != null ? assignee.getId() : "N/A", assignee != null ? assignee.getEmail() : "N/A");
        }

        return ticketMapper.toResponseDTO(saved);
    }

    /**
     * Recupera i conteggi dei ticket per la dashboard, filtrati per ruolo dell'utente corrente.
     * @param connectedUser Oggetto Authentication dell'utente corrente.
     * @return DTO con i conteggi dei ticket.
     */
    public DashboardCountsDTO getCounts(Authentication connectedUser) {
        User user = getCurrentUser(connectedUser);
        UserRole userRole = user.getRole();

        long totalTickets;
        long openTickets;
        long answeredTickets;
        long solvedTickets;
        long draftTickets;

        if (userRole == UserRole.ADMIN) {
            totalTickets = ticketRepository.count();
            openTickets = ticketRepository.countByStatus(TicketStatus.OPEN);
            answeredTickets = ticketRepository.countByStatus(TicketStatus.ANSWERED);
            solvedTickets = ticketRepository.countByStatus(TicketStatus.SOLVED);
            draftTickets = ticketRepository.countByStatus(TicketStatus.DRAFT);
        } else if (userRole == UserRole.USER) {
            // Per USER: conteggi solo sui propri ticket creati
            totalTickets = ticketRepository.countByOwner_Id(user.getId());
            openTickets = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.OPEN);
            answeredTickets = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.ANSWERED);
            solvedTickets = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.SOLVED);
            draftTickets = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.DRAFT);
        } else { // HELPER_JUNIOR, HELPER_SENIOR, PM: conteggi sui ticket a loro assegnati O che hanno creato
            totalTickets = ticketRepository.countByAssignedTo_IdOrOwner_Id(user.getId(), user.getId());
            openTickets = ticketRepository.countByAssignedTo_IdAndStatusOrOwner_IdAndStatus(user.getId(), TicketStatus.OPEN, user.getId(), TicketStatus.OPEN);
            answeredTickets = ticketRepository.countByAssignedTo_IdAndStatusOrOwner_IdAndStatus(user.getId(), TicketStatus.ANSWERED, user.getId(), TicketStatus.ANSWERED);
            solvedTickets = ticketRepository.countByAssignedTo_IdAndStatusOrOwner_IdAndStatus(user.getId(), TicketStatus.SOLVED, user.getId(), TicketStatus.SOLVED);
            draftTickets = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.DRAFT); // Gli helper/PM possono anche avere bozze da loro create
        }

        return DashboardCountsDTO.builder()
                .totalTickets(totalTickets)
                .openTickets(openTickets)
                .answeredTickets(answeredTickets)
                .solvedTickets(solvedTickets)
                .draftTickets(draftTickets)
                .build();
    }

    /**
     * Recupera una pagina di ticket in base al ruolo dell'utente corrente.
     * @param pageable Oggetto Pageable per paginazione.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return Una pagina di DTO dei ticket.
     * @throws AccessDeniedException se il ruolo non è autorizzato.
     */
    public Page<TicketResponseDTO> getTickets(Pageable pageable, Authentication auth) {
        User user = getCurrentUser(auth);
        UserRole role = user.getRole();

        Page<Ticket> tickets;

        switch (role) {
            case ADMIN -> tickets = ticketRepository.findAll(pageable); // L'admin vede tutto
            case HELPER_JUNIOR, HELPER_SENIOR, PM ->
                // Helper/PM vedono ticket assegnati a loro O creati da loro (escludendo bozze)
                tickets = ticketRepository.findByAssignedTo_IdOrOwner_IdAndStatusNot(user.getId(), user.getId(), TicketStatus.DRAFT, pageable);
            case USER ->
                // User vede solo i propri ticket (escludendo bozze)
                tickets = ticketRepository.findByOwner_IdAndStatusNot(user.getId(), TicketStatus.DRAFT, pageable);
            default ->
                throw new AccessDeniedException("Ruolo non autorizzato.");
        }
        return tickets.map(ticketMapper::toResponseDTO);
    }

    /**
     * Recupera i dettagli completi di un ticket specifico.
     * @param ticketId ID del ticket.
     * @return DTO di risposta del ticket.
     * @throws ResourceNotFoundException se il ticket non viene trovato.
     */
    public TicketResponseDTO getTicketDetails(Long ticketId) {
        Ticket ticket = ticketRepository.findDetailedById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        return ticketMapper.toResponseDTO(ticket);
    }

    /**
     * Recupera tutti i ticket assegnati all'utente corrente, escluse le bozze.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @return Una lista di DTO dei ticket assegnati.
     */
    public List<TicketResponseDTO> getAssignedTickets(Authentication auth) {
        String helperId = getCurrentUser(auth).getId();
        return ticketRepository.findByAssignedTo_IdAndStatusNot(helperId, TicketStatus.DRAFT)
            .stream()
            .map(ticketMapper::toResponseDTO)
            .toList();
    }

    /**
     * Recupera i ticket assegnati all'utente corrente in base a uno stato specifico.
     * @param auth Oggetto Authentication dell'utente corrente.
     * @param status Lo stato dei ticket da cercare.
     * @return Una lista di DTO dei ticket assegnati.
     */
    public List<TicketResponseDTO> getAssignedTicketsByStatus(Authentication auth, TicketStatus status) {
        String helperId = getCurrentUser(auth).getId();
        // I ticket DRAFT non sono assegnati, quindi restituisci una lista vuota se richiesto per lo stato DRAFT
        if (status == TicketStatus.DRAFT) {
            return List.of();
        }
        return ticketRepository.findByAssignedTo_IdAndStatus(helperId, status)
            .stream()
            .map(ticketMapper::toResponseDTO)
            .toList();
    }
}