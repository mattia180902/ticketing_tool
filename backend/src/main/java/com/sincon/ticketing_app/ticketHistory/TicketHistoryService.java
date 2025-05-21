package com.sincon.ticketing_app.ticketHistory;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TicketHistoryService {

    private final TicketHistoryRepository ticketHistoryRepository;
    private final TicketHistoryMapper ticketHistoryMapper;

    public List<TicketHistoryDTO> getHistoryByTicketId(Long ticketId) {
        return ticketHistoryRepository.findByTicketIdOrderByCreatedByDesc(ticketId)
                .stream()
                .map(ticketHistoryMapper::toDTO)
                .collect(Collectors.toList());
    }

    public TicketHistoryDTO saveHistory(TicketHistoryDTO dto) {
        TicketHistory entity = ticketHistoryMapper.toEntity(dto);
        entity = ticketHistoryRepository.save(entity);
        return ticketHistoryMapper.toDTO(entity);
    }

    public void deleteById(Long id) {
        ticketHistoryRepository.deleteById(id);
    }
}
