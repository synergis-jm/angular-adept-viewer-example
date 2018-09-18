import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpRequest, HttpHandler } from '@angular/common/http';

import { Observable, throwError as observableThrowError, of } from 'rxjs';
import { catchError, mergeMap, switchMap, map, tap } from 'rxjs/operators';
import { User } from './user';
import { UserModel } from './user-model';
import { Router } from '@angular/router';
import { Global } from '../globals';

const httpOptions = {
  headers: new HttpHeaders({
    'Content-Type':  'application/x-www-form-urlencoded'
  })
};

@Injectable()
export class AuthService {
  tokenSubject: any;
  isRefreshingToken: any;

  // store the URL so we can redirect after logging in
  redirectUrl: string;
  accessToken: string;
  refreshToken: string;
  cachedRequests: Array<HttpRequest<any>> = [];
  autoLogin: boolean;
  user: UserModel;

  constructor(private http: HttpClient, private router: Router ) {
    this.refreshToken = localStorage.getItem('refresh_token');
    const user = localStorage.getItem('userModel');
    if (user) {
      this.user = JSON.parse(user) as UserModel;
    }
    this.connectSignalR();
  }

  login(user: User, forceLogin: boolean): Observable<Object> {
    // tslint:disable-next-line:max-line-length
    const credentials = `username=${user.loginName}&password=${user.password}&client_id=Adept&grant_type=password&forceLogin=${forceLogin}`;
    return this.http.post(`${Global.API_URL}/login`, credentials, httpOptions).pipe(switchMap(data => {
      this.accessToken = data['access_token'];
      this.refreshToken = data['refresh_token'];
      localStorage.setItem('refresh_token', this.refreshToken);
      return this.getUserInfo();
    }));
    // return Observable.of(true).delay(1000).do(val => this.isLoggedIn = true);
  }

  logOut(): Observable<any> {
    return this.http.get(`${Global.API_URL}/api/account/logout`).pipe(switchMap(result => {
      // clear the user and localstorage
      this.user = null;
      localStorage.setItem('UserModel', '');
      return this.router.navigate(['/login']);
    }));
  }

  getUserInfo(): Observable<UserModel> {
    return this.http.get(`${Global.API_URL}/api/account/userinfo`).pipe(map(data => {
      this.user = data as UserModel;
      localStorage.setItem('userModel', JSON.stringify(this.user));
      return data as UserModel;
    }));
  }

  getToken() {
    return this.accessToken;
  }

  setLongTermKey(): Observable<any> {
    return this.http.get(`${Global.API_URL}/api/account/longtermkey`).pipe(switchMap(resp => {
      const secret = resp['Secret'];
      const credentials = `username=${this.user.LoginName}&password=&client_secret=${secret}&client_id=LongTermKey&grant_type=password`;
      return this.http.post(`${Global.API_URL}/login`, credentials).pipe(map(data => {
        this.accessToken = data['access_token'];
      }));
    }));
  }

  removeLongTermKey() {
    this.accessToken = '';
  }

  checkLogin(): Observable<Object> {
    return this.http.get(`${Global.API_URL}/api/account/isloggedin`);
  }

  getAppVersion(): Observable<any> {
    return this.http.get(`${Global.API_URL}/api/configuration/appversion`);
  }

  public getNewToken(): Observable<any> {
    const refreshToken = atob(this.refreshToken);
    const credentials = `grant_type=refresh_token&refresh_token=${refreshToken}&client_id=Adept&client_secret=zd2345rtl`;
    return this.http.post(`${Global.API_URL}/login`, credentials, httpOptions).pipe(switchMap(data => {
        this.accessToken = data['access_token'];
        this.refreshToken = data['refresh_token'];
        localStorage.setItem('refresh_token', this.refreshToken);
        if (!this.user) {
          return this.getUserInfo();
        }
        return of(data['access_token']);
    }));
  }

  public connectSignalR() {

  }

}
