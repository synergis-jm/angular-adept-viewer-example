import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { User } from '../user';

@Component({
  selector: 'app-login-page',
  templateUrl: './login-page.component.html',
  styleUrls: ['./login-page.component.css']
})
export class LoginPageComponent implements OnInit {

  constructor(private router: Router, private authService: AuthService) { }

  public user: User = { loginName: '', password: '' };
  processing = false;

  ngOnInit() {
  }

  login() {
    this.processing = true;
    this.authService.login(this.user, true).subscribe(() => {
      this.router.navigate(['/home']);
    }, error => {
      alert(error);
    }, () => {
      this.processing = false;
    });
  }
}
