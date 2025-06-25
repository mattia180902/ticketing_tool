/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import Keycloak from 'keycloak-js';
import { UserProfile } from './user-profile';

@Injectable({
  providedIn: 'root',
})
export class KeycloakService {

  private _keycloak: Keycloak | undefined;
  private _profile: UserProfile | undefined;

  constructor(
    private router: Router
  ) {}

  get keycloak() {
    if (!this._keycloak) {
      this._keycloak = new Keycloak({
        url: 'http://localhost:9090',
        realm: 'ticket_tool',
        clientId: 'ticketing_tool',
      });
    }
    return this._keycloak;
  }

  async init() {
    const authenticated = await this.keycloak.init({
      onLoad: 'login-required',
    });

    if (authenticated) {
      this._profile = (await this.keycloak.loadUserProfile()) as UserProfile;
      this._profile.token = this.keycloak.token;
    }
  }

  get userProfile(): UserProfile | undefined {
    return this._profile;
  }

  async login() {
    await this.keycloak.login();
  }

  get userId() {
    return this.keycloak?.tokenParsed?.sub as string;
  }

  get isTokenValid() {
    return !this.keycloak.isTokenExpired();
  }

  get fullName(): string {
    return this.keycloak.tokenParsed?.['name'] as string;
  }

  logout() {
    return this.keycloak.logout({ redirectUri: 'http://localhost:4200' });
  }

  accountManagement() {
    return this.keycloak.accountManagement();
  }

  /**
   * Recupera i ruoli dell'utente loggato dal token di Keycloak.
   */
  getUserRoles(): string[] {
    const tokenParsed: any = this.keycloak.tokenParsed;
    const realmRoles = tokenParsed?.realm_access?.roles || [];

    let clientRoles: string[] = [];
    // Aggiungiamo un controllo per assicurarci che this.keycloak.clientId e tokenParsed?.resource_access siano disponibili
    if (this.keycloak.clientId && tokenParsed?.resource_access) {
      // Ora TypeScript sa che this.keycloak.clientId è una stringa valida
      clientRoles = tokenParsed.resource_access[this.keycloak.clientId]?.roles || [];
    }
    
    return [...realmRoles, ...clientRoles];
  }
}
