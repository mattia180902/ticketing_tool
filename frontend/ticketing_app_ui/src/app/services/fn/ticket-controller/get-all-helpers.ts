/* tslint:disable */
/* eslint-disable */
/* Code generated by ng-openapi-gen DO NOT EDIT. */

import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';

import { UserDto } from '../../models/user-dto';

export interface GetAllHelpers$Params {
}

export function getAllHelpers(http: HttpClient, rootUrl: string, params?: GetAllHelpers$Params, context?: HttpContext): Observable<StrictHttpResponse<Array<UserDto>>> {
  const rb = new RequestBuilder(rootUrl, getAllHelpers.PATH, 'get');
  if (params) {
  }

  return http.request(
    rb.build({ responseType: 'json', accept: 'application/json', context })
  ).pipe(
    filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
    map((r: HttpResponse<any>) => {
      return r as StrictHttpResponse<Array<UserDto>>;
    })
  );
}

getAllHelpers.PATH = '/api/v1/tickets/helpers';
