package com.sincon.ticketing_app.ticket;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import com.sincon.ticketing_app.exception.ResourceNotFoundException;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TicketService {

    private final TicketRepository ticketRepository;
    private final TicketMapper ticketMapper;

    public List<TicketDTO> getAllTickets() {
        return ticketRepository.findAll()
                .stream()
                .map(ticketMapper::toDTO)
                .toList();
    }

    public TicketDTO getTicketById(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));
        return ticketMapper.toDTO(ticket);
    }

    public TicketDTO createTicket(TicketDTO ticketDTO) {
        Ticket ticket = ticketMapper.toEntity(ticketDTO);
        return ticketMapper.toDTO(ticketRepository.save(ticket));
    }

    public TicketDTO updateTicket(Long id, TicketDTO ticketDTO) {
        Ticket existingTicket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));

        existingTicket.setTitle(ticketDTO.getTitle());
        existingTicket.setDescription(ticketDTO.getDescription());
        existingTicket.setPriority(ticketDTO.getPriority());
        existingTicket.setStatus(ticketDTO.getStatus());
        // gestione assegnazione category e user se necessario

        return ticketMapper.toDTO(ticketRepository.save(existingTicket));
    }

    public void deleteTicket(Long id) {
        Ticket ticket = ticketRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Ticket not found with id: " + id));
        ticketRepository.delete(ticket);
    }
}
