import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import Keycloak from 'keycloak-js';

@Injectable({
  providedIn: 'root',
})
export class KeycloakService {

  private _keycloak: Keycloak | undefined;

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
}
