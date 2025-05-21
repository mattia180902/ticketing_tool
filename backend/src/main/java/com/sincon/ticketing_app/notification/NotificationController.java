package com.sincon.ticketing_app.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;

@RestController
@RequestMapping("/api/v1/notifications")
@RequiredArgsConstructor
@Tag(name = "Notification")
public class NotificationController {

    private final NotificationService service;
    private final NotificationMapper mapper;

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<NotificationDTO>> getUserNotifications(@PathVariable String userId) {
        List<NotificationDTO> notifications = service.getNotificationsForUser(userId)
                .stream()
                .map(mapper::toDTO)
                .toList();
        return ResponseEntity.ok(notifications);
    }

    @PostMapping
    public ResponseEntity<NotificationDTO> createNotification(@RequestBody NotificationDTO dto) {
        Notification notification = mapper.toEntity(dto);
        Notification saved = service.save(notification);
        return ResponseEntity.ok(mapper.toDTO(saved));
    }

    @PatchMapping("/{id}/read")
    public ResponseEntity<Void> markAsRead(@PathVariable Long id) {
        service.markAsRead(id);
        return ResponseEntity.noContent().build();
    }
}