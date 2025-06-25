package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.category.CategoryRepository;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.enums.UserRole;
import com.sincon.ticketing_app.exception.ResourceNotFoundException;
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

    // Creazione ticket (anche bozza)
    @Transactional
    public TicketResponseDTO createTicket(TicketRequestDTO dto, Authentication auth) {
        User creator = getCurrentUser(auth);
    
        Category category = categoryRepository.findById(dto.getCategoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Category not found"));
    
        SupportService service = supportServiceRepository.findById(dto.getSupportServiceId())
                .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
    
        User assignedTo;
    
        if (dto.getAssignedToId() != null) {
            assignedTo = userRepository.findById(dto.getAssignedToId())
                    .orElseThrow(() -> new ResourceNotFoundException("Helper not found"));
        } else {
            // Se manca assignedToId → cerco un HELPER_JUNIOR disponibile
            List<User> availableHelpers = userRepository.findByRole(UserRole.HELPER_JUNIOR);
            if (!availableHelpers.isEmpty()) {
                assignedTo = availableHelpers.get(0);
            } else {
                // fallback su admin
                assignedTo = userRepository.findByRole(UserRole.ADMIN)
                        .stream()
                        .findFirst()
                        .orElseThrow(() -> new ResourceNotFoundException("No helper or admin available"));
            }
        }
    
        // Se USER → email e dati personali presi dal proprio profilo
        if (creator.getRole() == UserRole.USER) {
            dto.setEmail(creator.getEmail());
            dto.setPhoneNumber(creator.getPhoneNumber());
            dto.setFiscalCode(creator.getFiscalCode());
        }
    
        Ticket ticket = ticketMapper.fromRequestDTO(dto, creator, category, service, assignedTo);
        Ticket saved = ticketRepository.save(ticket);
    
        if (!saved.getStatus().equals(TicketStatus.DRAFT)) {
            notificationService.sendTicketCreationEmail(saved);
            notificationService.sendTicketAssignedEmail(saved);
        }
    
        return ticketMapper.toResponseDTO(saved);
    }
    
    public List<User> getHelpersByRole(UserRole role) {
        return userRepository.findByRole(role);
    }
    
    public List<User> getAllHelpers() {
        return userRepository.findByRoleIn(List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM, UserRole.ADMIN));
    }
    

    // Recupera i propri ticket
    public List<TicketResponseDTO> getMyTickets(Authentication auth) {
        String userId = auth.getName();
        return ticketRepository.findByOwner_Id(userId)
                .stream()
                .map(ticketMapper::toResponseDTO)
                .toList();
    }

    // Recupera ticket personale filtrato per stato
    public List<TicketResponseDTO> getMyTicketsByStatus(Authentication auth, TicketStatus status) {
        String userId = auth.getName();
        return ticketRepository.findByOwner_IdAndStatus(userId, status)
                .stream()
                .map(ticketMapper::toResponseDTO)
                .toList();
    }

    // Recupera le bozze dell'utente
    public List<TicketResponseDTO> getDrafts(Authentication auth) {
        String userId = auth.getName();
        return ticketRepository.findByOwner_IdAndStatus(userId, TicketStatus.DRAFT)
                .stream()
                .map(ticketMapper::toResponseDTO)
                .toList();
    }

    // Elimina ticket (con controllo permessi)
    @Transactional
    public void deleteTicket(Long ticketId, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));

        User user = getCurrentUser(auth);

        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        boolean isOwner = ticket.getOwner().getId().equals(user.getId());
        boolean isAssignedTo = ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(user.getId());

        if (isAdmin || isOwner || isAssignedTo) {
            ticketRepository.delete(ticket);
        } else {
            throw new AccessDeniedException("You cannot delete this ticket.");
        }
    }

    // Aggiorna stato ticket
    @Transactional
    public TicketResponseDTO updateStatus(Long ticketId, TicketStatus newStatus, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));

        User user = getCurrentUser(auth);

        boolean isAdmin = user.getRole() == UserRole.ADMIN;
        boolean isAssignedTo = ticket.getAssignedTo() != null && ticket.getAssignedTo().getId().equals(user.getId());

        if (!isAdmin && !isAssignedTo) {
            throw new AccessDeniedException("You are not authorized to update this ticket.");
        }

        ticket.setStatus(newStatus);
        Ticket saved = ticketRepository.save(ticket);

        ticketHistoryService.recordHistory(saved, newStatus, newStatus, user, null);
        notificationService.sendTicketStatusUpdateEmail(saved);

        return ticketMapper.toResponseDTO(saved);
    }

    // Assegna ticket a un helper
    @Transactional
    public TicketResponseDTO assignTicket(Long ticketId, String helperId, Authentication auth) {
        Ticket ticket = ticketRepository.findById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));

        User assigner = getCurrentUser(auth);
        User assignee = userRepository.findById(helperId)
                .orElseThrow(() -> new ResourceNotFoundException("Helper not found"));

        // Solo Admin può assegnare ticket
        if (assigner.getRole() != UserRole.ADMIN) {
            throw new AccessDeniedException("You cannot assign this ticket.");
        }

        ticket.setAssignedTo(assignee);
        ticket.setStatus(TicketStatus.ANSWERED);

        Ticket saved = ticketRepository.save(ticket);

        notificationService.sendTicketCreationEmail(saved);

        return ticketMapper.toResponseDTO(saved);
    }

    // Dashboard counts
    public DashboardCountsDTO getCounts(Authentication auth) {
        User user = getCurrentUser(auth);
        UserRole role = user.getRole();
    
        long total, open, solved, answered, draft;
    
        switch (role) {
            case ADMIN -> {
                total = ticketRepository.count();
                open = ticketRepository.countByStatus(TicketStatus.OPEN);
                solved = ticketRepository.countByStatus(TicketStatus.SOLVED);
                answered = ticketRepository.countByStatus(TicketStatus.ANSWERED);
                draft = ticketRepository.countByStatus(TicketStatus.DRAFT);
            }
            case HELPER_JUNIOR, HELPER_SENIOR, PM -> {
                total = ticketRepository.countByAssignedTo_Id(user.getId());
                open = ticketRepository.countByAssignedTo_IdAndStatus(user.getId(), TicketStatus.OPEN);
                solved = ticketRepository.countByAssignedTo_IdAndStatus(user.getId(), TicketStatus.SOLVED);
                answered = ticketRepository.countByAssignedTo_IdAndStatus(user.getId(), TicketStatus.ANSWERED);
                draft = ticketRepository.countByAssignedTo_IdAndStatus(user.getId(), TicketStatus.DRAFT);
            }
            case USER -> {
                total = ticketRepository.countByOwner_Id(user.getId());
                open = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.OPEN);
                solved = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.SOLVED);
                answered = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.ANSWERED);
                draft = ticketRepository.countByOwner_IdAndStatus(user.getId(), TicketStatus.DRAFT);
            }
            default -> throw new AccessDeniedException("Ruolo non autorizzato.");
        }
    
        return DashboardCountsDTO.builder()
            .totalTickets(total)
            .openTickets(open)
            .solvedTickets(solved)
            .answeredTickets(answered)
            .draftTickets(draft)
            .build();
    }
    

    public Page<TicketResponseDTO> getTickets(Pageable pageable, Authentication auth) {
        User user = getCurrentUser(auth);
        UserRole role = user.getRole();
    
        Page<Ticket> tickets;
    
        switch (role) {
            case ADMIN -> tickets = ticketRepository.findAll(pageable);
            case HELPER_JUNIOR, HELPER_SENIOR, PM ->
                tickets = ticketRepository.findByAssignedTo_Id(user.getId(), pageable);
            case USER ->
                tickets = ticketRepository.findByOwner_Id(user.getId(), pageable);
            default ->
                throw new AccessDeniedException("Ruolo non autorizzato.");
        }
    
        return tickets.map(ticketMapper::toResponseDTO);
    }

    // Dettaglio ticket
    public TicketResponseDTO getTicketDetails(Long ticketId) {
        Ticket ticket = ticketRepository.findDetailedById(ticketId)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found"));
        return ticketMapper.toResponseDTO(ticket);
    }

    // Recupero user autenticato
    private User getCurrentUser(Authentication auth) {
        return userRepository.findById(auth.getName())
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
    }

    public List<TicketResponseDTO> getAssignedTickets(Authentication auth) {
        String helperId = auth.getName();
        return ticketRepository.findByAssignedTo_Id(helperId)
            .stream()
            .map(ticketMapper::toResponseDTO)
            .toList();
    }

    public List<TicketResponseDTO> getAssignedTicketsByStatus(Authentication auth, TicketStatus status) {
        String helperId = auth.getName();
        return ticketRepository.findByAssignedTo_IdAndStatus(helperId, status)
            .stream()
            .map(ticketMapper::toResponseDTO)
            .toList();
    }
}
