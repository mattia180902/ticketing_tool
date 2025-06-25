package com.sincon.ticketing_app.user;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import com.sincon.ticketing_app.enums.UserRole;

import java.util.List;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository repository;
    private final UserMapper mapper;

    public List<UserDTO> getAllUsersExceptSelf(Authentication connectedUser) {
        return repository.findAllUsersExceptSelf(connectedUser.getName())
                .stream()
                .map(mapper::toUserDTO)
                .toList();
    }

    public List<UserDTO> getHelpers() {
        return repository.findByRoleIn(
                List.of(UserRole.HELPER_JUNIOR, UserRole.HELPER_SENIOR, UserRole.PM)
            ).stream()
            .map(mapper::toUserDTO)
            .toList();
    }

    public List<UserDTO> getHelpersJunior() {
        return repository.findByRole(
                UserRole.HELPER_JUNIOR
            ).stream()
            .map(mapper::toUserDTO)
            .toList();
    }

    public List<UserDTO> getHelpersAndAdmins(Authentication authentication) {
        User currentUser = repository.findById(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + authentication.getName()));

        return repository.findAll().stream()
                .filter(u -> u.getRole() == UserRole.HELPER_JUNIOR ||
                             u.getRole() == UserRole.HELPER_SENIOR ||
                             u.getRole() == UserRole.PM ||
                             u.getRole() == UserRole.ADMIN ||
                             u.getId().equals(currentUser.getId())) // include admin corrente
                .map(mapper::toUserDTO)
                .toList();
    }

    public UserDTO getMe(Authentication authentication) {
        User user = repository.findById(authentication.getName())
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + authentication.getName()));
        return mapper.toUserDTO(user);
    }

    public UserDTO updateContactInfo(String userId, UserContactUpdateRequest request) {
        User user = repository.findById(userId)
                .orElseThrow(() -> new RuntimeException("User not found with ID: " + userId));

        user.setFiscalCode(request.getFiscalCode());
        user.setPhoneNumber(request.getPhoneNumber());

        repository.save(user);

        return mapper.toUserDTO(user);
    }
}
