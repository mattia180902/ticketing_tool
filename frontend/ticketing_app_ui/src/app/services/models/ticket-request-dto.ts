/* tslint:disable */
/* eslint-disable */
/* Code generated by ng-openapi-gen DO NOT EDIT. */

export interface TicketRequestDto {
  assignedToId?: string;
  categoryId?: number;
  description?: string;
  email?: string;
  fiscalCode?: string;
  phoneNumber?: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status?: 'OPEN' | 'ANSWERED' | 'SOLVED' | 'DRAFT';
  supportServiceId?: number;
  title: string;
}
