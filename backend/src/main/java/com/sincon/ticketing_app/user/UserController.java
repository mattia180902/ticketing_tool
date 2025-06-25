package com.sincon.ticketing_app.user;

import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@RequiredArgsConstructor
@Tag(name = "User")
public class UserController {

    private final UserService service;

    @GetMapping
    public ResponseEntity<List<UserDTO>> getAllUsers(Authentication authentication) {
        return ResponseEntity.ok(service.getAllUsersExceptSelf(authentication));
    }

    @GetMapping("/helpers")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDTO>> getHelpers() {
        return ResponseEntity.ok(service.getHelpers());
    }

    @GetMapping("/helpers-junior")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<UserDTO>> getHelpersJunior() {
        return ResponseEntity.ok(service.getHelpersJunior());
    }

    @GetMapping("/helpers-and-admins")
    @PreAuthorize("hasAnyRole('ADMIN','HELPER_JUNIOR','HELPER_SENIOR','PM')")
    public ResponseEntity<List<UserDTO>> getHelpersAndAdmins(Authentication authentication) {
        return ResponseEntity.ok(service.getHelpersAndAdmins(authentication));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getMe(Authentication authentication) {
        return ResponseEntity.ok(service.getMe(authentication));
    }

    @PutMapping("/contact-info")
    public ResponseEntity<UserDTO> updateContactInfo(Authentication authentication,
            @RequestBody @Valid UserContactUpdateRequest request) {
        return ResponseEntity.ok(service.updateContactInfo(authentication.getName(), request));
    }
}
