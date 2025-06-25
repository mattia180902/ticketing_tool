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

    public Ticket fromRequestDTO(TicketRequestDTO dto, User owner, Category category, SupportService service, User assignedTo) {
        return Ticket.builder()
                .title(dto.getTitle())
                .description(dto.getDescription())
                .priority(dto.getPriority())
                .status(dto.getStatus() != null ? dto.getStatus() : TicketStatus.OPEN)
                .owner(owner)
                .category(category)
                .service(service)
                .assignedTo(assignedTo)
                .email(dto.getEmail())
                .phoneNumber(dto.getPhoneNumber())
                .fiscalCode(dto.getFiscalCode())
                .build();
    }

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
                .categoryId(ticket.getCategory().getId())
                .categoryName(ticket.getCategory().getName())
                .supportServiceId(ticket.getService().getId())
                .supportServiceName(ticket.getService().getTitle())
                .assignedToId(ticket.getAssignedTo() != null ? ticket.getAssignedTo().getId() : null)
                .assignedToName(ticket.getAssignedTo() != null
                        ? ticket.getAssignedTo().getFirstName() + " " + ticket.getAssignedTo().getLastName()
                        : null)
                .createdOn(ticket.getCreatedDate())
                .updatedOn(ticket.getLastModifiedDate())
                .solvedOn(ticket.getSolveDate())
                .build();
    }
}

