import { Injectable } from '@angular/core';
import { KeycloakService } from '../../../utils/keycloak/keycloak.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  constructor(private keycloak: KeycloakService) {}

  getUserRole(): string {
    const roles = this.keycloak.getUserRoles();
    return roles.length > 0 ? roles[0] : 'UNKNOWN';
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
    return this.getUserRole() === 'USER';
  }

  isHelperJunior(): boolean {
    return this.getUserRole() === 'HELPER_JUNIOR';
  }

  isAdminOrPM(): boolean {
    const role = this.getUserRole();
    return role === 'ADMIN' || role === 'PM' || role === 'HELPER_SENIOR';
  }
}
