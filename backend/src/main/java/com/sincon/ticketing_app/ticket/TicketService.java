package com.sincon.ticketing_app.ticket;

import lombok.RequiredArgsConstructor;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

import com.sincon.ticketing_app.common.PageResponse;
import com.sincon.ticketing_app.exception.ResourceNotFoundException;
import com.sincon.ticketing_app.exception.UnauthorizedException;

import jakarta.persistence.EntityNotFoundException;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketMapper ticketMapper;

    public Long createTicket(TicketDTO dto, Authentication connectedUser) {
        Ticket ticket = ticketMapper.toTicket(dto);
        ticket.setCreatedBy(connectedUser.getName());
        return ticketRepository.save(ticket).getId();
    }

    public PageResponse<TicketResponse> getTicketsForUser(int page, int size, Authentication connectedUser) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdDate").descending());
    
        boolean isAdmin = connectedUser.getAuthorities().stream()
                .anyMatch(auth -> auth.getAuthority().equals("ADMIN"));
    
        Page<Ticket> tickets;
    
        if (isAdmin) {
            tickets = ticketRepository.findAllTickets(pageable);
        } else {
            tickets = ticketRepository.findAllByCreatedBy(pageable, connectedUser.getName());
        }
    
        List<TicketResponse> ticketResponse = tickets.stream()
                .map(ticketMapper::toTicketResponse)
                .toList();
    
        return new PageResponse<>(
                ticketResponse,
                tickets.getNumber(),
                tickets.getSize(),
                tickets.getTotalElements(),
                tickets.getTotalPages(),
                tickets.isFirst(),
                tickets.isLast()
        );
    }
    

    public TicketResponse getTicketById(Long id) {
        return ticketRepository.findById(id)
                .map(ticketMapper::toTicketResponse)
                .orElseThrow(() -> new EntityNotFoundException("No ticket found with ID: " + id));
    }

    public Long updateTicket(Long id, TicketDTO ticketDTO, Authentication connectedUser) {
        Ticket existingTicket = ticketRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Ticket not found with id: " + id));

        if (!Objects.equals(existingTicket.getCreatedBy(), connectedUser.getName())) {
            throw new UnauthorizedException("You cannot modify others tickets");
        }
        existingTicket.setTitle(ticketDTO.title());
        existingTicket.setDescription(ticketDTO.description());
        existingTicket.setPriority(ticketDTO.priority());
        existingTicket.setStatus(ticketDTO.status());

        return ticketRepository.save(existingTicket).getId();
    }

    public void deleteTicket(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));
        ticketRepository.delete(ticket);
    }
}
