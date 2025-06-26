
import { Injectable } from '@angular/core';
import { KeycloakService } from '../../../utils/keycloak/keycloak.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(public keycloak: KeycloakService) {}

  /**
   * Controlla se l'utente ha uno o più ruoli specificati.
   * Utilizza il metodo `getUserRoles()` del tuo KeycloakService.
   */
  hasRole(role: string | string[]): boolean {
    const userRoles = this.keycloak.getUserRoles();

    if (Array.isArray(role)) {
      // Se 'role' è un array, controlla se l'utente ha ALMENO UNO di quei ruoli
      return role.some(r => userRoles.includes(r));
    }
    // Se 'role' è una stringa singola, controlla se l'utente ha quel ruolo
    return userRoles.includes(role);
  }

  getUserId(): string {
    return this.keycloak.userId;
  }

  getUserEmail(): string {
    return this.keycloak.userProfile?.email || '';
  }

  getUserFullName(): string {
    return this.keycloak.fullName;
  }

  isUser(): boolean {
    return this.hasRole('USER');
  }

  isHelperJunior(): boolean {
    return this.hasRole('HELPER_JUNIOR');
  }

  isAdminOrPM(): boolean {
    return this.hasRole(['ADMIN', 'PM', 'HELPER_SENIOR']);
  }

  isHelperOrPm(): boolean {
    return this.hasRole(['HELPER_JUNIOR', 'HELPER_SENIOR', 'PM']);
  }
}