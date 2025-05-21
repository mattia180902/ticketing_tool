package com.sincon.ticketing_app.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository repository;

    public List<Notification> getNotificationsForUser(String userId) {
        return repository.findByUserId(userId);
    }

    public Notification save(Notification notification) {
        return repository.save(notification);
    }

    public void markAsRead(Long id) {
        Notification notification = repository.findById(id)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setIsRead(true);
        repository.save(notification);
    }
}
