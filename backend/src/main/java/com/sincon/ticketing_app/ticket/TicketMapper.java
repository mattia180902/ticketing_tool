package com.sincon.ticketing_app.ticket;

import com.sincon.ticketing_app.category.Category;
import com.sincon.ticketing_app.enums.TicketStatus;
import com.sincon.ticketing_app.supportservice.SupportService;
import com.sincon.ticketing_app.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class TicketMapper {

    // Mappa dal DTO di richiesta all'entità Ticket (usato per NUOVE CREAZIONI)
    public Ticket fromRequestDTO(TicketRequestDTO dto, User owner, Category category, SupportService service, User assignedTo) {
        return Ticket.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .priority(dto.getPriority())
                .status(dto.getStatus() != null ? dto.getStatus() : TicketStatus.OPEN)
                .owner(owner) // Owner è obbligatorio, passato da TicketService
                .category(category)
                .service(service)
                .assignedTo(assignedTo)
                .email(dto.getEmail())
                .phoneNumber(dto.getPhoneNumber())
                .fiscalCode(dto.getFiscalCode())
                // createdDate, lastModifiedDate, createdBy, lastModifiedBy sono gestiti da Auditable
                .build();
    }

    // Mappa dall'entità Ticket al DTO di risposta
    public TicketResponseDTO toResponseDTO(Ticket ticket) {
        return TicketResponseDTO.builder()
                .id(ticket.getId())
                .title(ticket.getTitle())
                .description(ticket.getDescription())
                .status(ticket.getStatus())
                .priority(ticket.getPriority())
                .userId(ticket.getOwner().getId())
                .userFirstName(ticket.getOwner().getFirstName())
                .userLastName(ticket.getOwner().getLastName())
                .userEmail(ticket.getOwner().getEmail())
                .userPhoneNumber(ticket.getOwner().getPhoneNumber())
                .userFiscalCode(ticket.getOwner().getFiscalCode())
                .categoryId(ticket.getCategory() != null ? ticket.getCategory().getId() : null)
                .categoryName(ticket.getCategory() != null ? ticket.getCategory().getName() : null)
                .supportServiceId(ticket.getService() != null ? ticket.getService().getId() : null)
                .supportServiceName(ticket.getService() != null ? ticket.getService().getTitle() : null)
                .assignedToId(ticket.getAssignedTo() != null ? ticket.getAssignedTo().getId() : null)
                .assignedToName(ticket.getAssignedTo() != null
                        ? ticket.getAssignedTo().getFirstName() + " " + ticket.getAssignedTo().getLastName()
                        : null)
                .createdOn(ticket.getCreatedDate()) // Direttamente la Date
                .updatedOn(ticket.getLastModifiedDate()) // Direttamente la Date
                .solvedOn(ticket.getSolveDate()) // Direttamente la Date
                .build();
    }
}
