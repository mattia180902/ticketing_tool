/* tslint:disable */
/* eslint-disable */
/* Code generated by ng-openapi-gen DO NOT EDIT. */

import { HttpClient, HttpContext, HttpResponse } from '@angular/common/http';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { StrictHttpResponse } from '../../strict-http-response';
import { RequestBuilder } from '../../request-builder';

import { CategoryResponse } from '../../models/category-response';

export interface GetCategory$Params {
  id: number;
}

export function getCategory(http: HttpClient, rootUrl: string, params: GetCategory$Params, context?: HttpContext): Observable<StrictHttpResponse<CategoryResponse>> {
  const rb = new RequestBuilder(rootUrl, getCategory.PATH, 'get');
  if (params) {
    rb.path('id', params.id, {});
  }

  return http.request(
    rb.build({ responseType: 'json', accept: 'application/json', context })
  ).pipe(
    filter((r: any): r is HttpResponse<any> => r instanceof HttpResponse),
    map((r: HttpResponse<any>) => {
      return r as StrictHttpResponse<CategoryResponse>;
    })
  );
}

getCategory.PATH = '/api/v1/categories/{id}';
