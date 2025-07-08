package com.sincon.ticketing_app.user;

import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import com.sincon.ticketing_app.enums.UserRole;

import java.util.*;

public interface UserRepository extends JpaRepository<User, String> {

    @Query("SELECT u FROM User u WHERE u.id <> :excludedId")
    List<User> findAllUsersExceptSelf(@Param("excludedId") String excludedId);

    List<User> findByRole(UserRole role);

    List<User> findByRoleIn(List<UserRole> roles);

    Optional<User> findByEmail(String email);

    Optional<User> findTopByRole(UserRole role);
}
