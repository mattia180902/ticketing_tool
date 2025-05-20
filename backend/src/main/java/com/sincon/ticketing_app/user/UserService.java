package com.sincon.ticketing_app.user;

import java.util.List;

import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import lombok.RequiredArgsConstructor;

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
}