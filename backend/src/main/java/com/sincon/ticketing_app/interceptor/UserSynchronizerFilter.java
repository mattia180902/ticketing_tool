package com.sincon.ticketing_app.interceptor;

import java.io.IOException;

import org.springframework.lang.NonNull;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import com.sincon.ticketing_app.user.UserSynchronizer;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class UserSynchronizerFilter extends OncePerRequestFilter{

    private final UserSynchronizer userSynchronizer;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
    
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    
        if (auth instanceof JwtAuthenticationToken token && auth.isAuthenticated()) {
            userSynchronizer.synchronizeWithIdp(token.getToken());
        }
    
        filterChain.doFilter(request, response);
    }
}
