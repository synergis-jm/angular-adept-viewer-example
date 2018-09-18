
import { throwError as observableThrowError, Observable, BehaviorSubject, of } from 'rxjs';
import { switchMap, map, catchError, finalize, tap, filter, take, timeout } from 'rxjs/operators';

import { Injectable, Injector } from '@angular/core';

import {
    HttpRequest,
    HttpHandler,
    HttpEvent,
    HttpInterceptor,
    HttpErrorResponse,
    HttpResponse,
    HttpSentEvent,
    HttpHeaderResponse,
    HttpProgressEvent,
    HttpUserEvent
} from '@angular/common/http';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';
import { Global } from '../globals';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

    private auth: AuthService;

    isRefreshingToken = false;
    tokenSubject: BehaviorSubject<string> = new BehaviorSubject<string>(null);
    errorSubject: BehaviorSubject<string> = new BehaviorSubject<string>(null);

    constructor(private inj: Injector, private router: Router ) {
        this.auth = this.inj.get(AuthService);
    }

    addToken(req: HttpRequest<any>, token: string): HttpRequest<any> {
        return req.clone({ setHeaders: { Authorization: 'Bearer ' + this.auth.getToken(), 'Content-Type': 'application/json' } });
    }
    addACSToken(req: HttpRequest<any>): HttpRequest<any> {
        // console.log("adding token to:", req.url);
        if (req.url.indexOf('token') !== -1) {
            return req.clone({ setHeaders: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        }
    }

    // tslint:disable-next-line:max-line-length
    intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpSentEvent | HttpHeaderResponse | HttpProgressEvent | HttpResponse<any> | HttpUserEvent<any>> {
        if (!req.url.includes('localhost')) {
            return next.handle(this.addToken(req, this.auth.getToken()))
            .pipe(catchError(err => {
                console.log('error thrown status:', (<HttpErrorResponse>err).status);
                switch ((<HttpErrorResponse>err).status) {
                    case 400:
                        return this.handle400Error(err);
                    case 401:
                        return this.handle401Error(req, next);
                    default:
                        return this.handleOtherErrors(err);
                }
            }));
        }
        return next.handle(req);
    }

    handle401Error(req: HttpRequest<any>, next: HttpHandler) {
        console.log('Handling 401');
        if (!this.isRefreshingToken) {
            this.isRefreshingToken = true;

            // Reset here so that the following requests wait until the token
            // comes back from the refreshToken call.
            this.tokenSubject.next(null);

            return this.auth.getNewToken().pipe(switchMap((newToken: string) => {
                if (newToken) {
                    this.tokenSubject.next(newToken);
                    return next.handle(this.addToken(req, newToken));
                }
                // If we don't get a new token, we are in trouble so logout.
                return this.logoutUser('no token');
            }), catchError(error => {
                // If there is an exception calling 'refreshToken', bad news so logout.
                if (error.status === 400) {
                    return this.logoutUser(error);
                }
                return this.handleOtherErrors(error);
            }), finalize(() => {
                console.log('no longer refreshing token');
                this.isRefreshingToken = false;
            }));
        } else {
            return this.tokenSubject.pipe(filter(token => token != null), take(1), switchMap(token => {
                return next.handle(this.addToken(req, token));
            }));
        }
    }

    handle400Error(error) {
        console.log('handling 400');
        if (error && error.status === 400 && error.error && error.error.error === 'invalid_grant') {
            // If we get a 400 and the error message is 'invalid_grant', the token is no longer valid so logout.
            return this.logoutUser(error);
        }

        return observableThrowError(error);
    }

    handleOtherErrors(resp) {
        // console.log("handling other errors");
        // console.log(resp);
        let error = '';
        if (resp.error.Message) {
            error = resp.error.Message;
        }
        if (resp.error.ExceptionMessage) {
            error = resp.error.ExceptionMessage;
        }
        return observableThrowError(resp);
    }

    logoutUser(err) {
        console.log('log out user');
        // Route to the login page
        this.router.navigate(['login']);
        localStorage.setItem('userModel', '');
        if (err) {
            if (err.error) {
                if (err.error.error_description) {
                    err = err.error.error_description;
                }
            }
        }

        return observableThrowError(err);
    }
}
