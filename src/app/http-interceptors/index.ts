/* sample code found here https://angular.io/generated/live-examples/http/stackblitz.html */

/* Note the interceptors apply to all http calls and there is no way to easily customize the list
   for a specific call -- for example may want http on certain calls for efficiency. Follow this 
   thread to see if it ever got implement into angular https://github.com/angular/angular/issues/18155 */

/* Note on function of Interceptors from https://angular.io/guide/http#intercepting-requests-and-responses

HTTP Interception is a major feature of @angular/common/http. With interception, 
you declare interceptors that inspect and transform HTTP requests from your 
application to the server. The same interceptors may also inspect and transform 
the server's responses on their way back to the application. */

/* Angular guide https://angular.io/guide/http#provide-the-interceptor recommends
   creating a "barrel" file that gathers all the interceptor providers into
   an httpInterceptorProviders array */

/* "Barrel" of Http Interceptors */
import { HTTP_INTERCEPTORS } from '@angular/common/http';

import { EnsureHttpsInterceptor } from './ensure-https-interceptor';
import { AuthInterceptor } from './auth-interceptor';

/** Http interceptor providers in outside-in order */
/* As you create new interceptors, add them to the httpInterceptorProviders 
   array and you won't have to revisit the AppModule. */
export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: EnsureHttpsInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true }
  //,{ provide: HTTP_INTERCEPTORS, useClass: LoggingInterceptor, multi: true }
  //,{ provide: HTTP_INTERCEPTORS, useClass: CachingInterceptor, multi: true }
];
