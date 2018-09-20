import { Component, OnInit } from '@angular/core';
import { SearchTerm, SearchParams } from '../classes/search-params';
import { AdeptDataTable } from '../classes/get-data-params';
import { HttpClient } from '@angular/common/http';
import { Global } from '../globals';
import { share, map, retryWhen, flatMap, delay, take, switchMap, catchError } from 'rxjs/operators';
import { Observable, of, concat, interval, throwError } from 'rxjs';
import { UserModel } from '../login/user-model';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.css']
})
export class HomeComponent implements OnInit {
  private VIEWERURL: string;
  constructor(private http: HttpClient) {
    const port = window.location.protocol === 'http:' ? '3922' : '3923';
    this.VIEWERURL = `${window.location.protocol}//localhost:${port}`;
  }
  public records: any;
  public term: SearchTerm = new SearchTerm();
  public searchValue = '';
  public currentRecord: any;
  private viewerOptions: Map<string, string>;
  ngOnInit() {
    // hard coded filename as the search schemaid
    this.term.schemaID = 'SCHEMA_S_LONGNAME';
  }

  search() {
    const params = new SearchParams();
    this.term.valueStr = this.searchValue;
    params.searchCriteria = [ this.term ];
    params.AdeptDataTable = new AdeptDataTable();
    params.AdeptDataTable.Skip = 0;
    params.AdeptDataTable.Take = 1000;
    params.CountOperation = false;
    let results: SearchParams;
    return this.http.post(`${Global.API_URL}/api/document/byfields`, JSON.stringify(params))
    .pipe(share(), map(d => results = d as SearchParams )).subscribe(data => {
      this.records = data.AdeptDataTable.TableRecords;
    });
  }

  recordSelected(record) {
    this.records.forEach(element => {
      element.selected = false;
    });
    record.selected = true;
    this.currentRecord = record;
  }

  view() {
    // get viewer options first
    this.getViewerOptions().subscribe(options => {
      const userModel = JSON.parse(localStorage.getItem('userModel')) as UserModel;
      let isParent = false;
      if (this.currentRecord['SCHEMA_S_PARENT'] === 'T' && this.currentRecord['SCHEMA_S_PARENT'] === 't') {
        isParent = true;
      }
      // create a string with all the paramaters for the file
      let documentString = `TableNumber=${this.currentRecord['SCHEMA_S_SRCDB']}:`;
      documentString += `FileId=${this.currentRecord['SCHEMA_S_FILEID']}:`;
      documentString += `MinRev=${this.currentRecord['SCHEMA_S_MINREV']}:`;
      documentString += `MajRev=${this.currentRecord['SCHEMA_S_MAJREV']}:`;
      documentString += `FileNE=${encodeURIComponent(this.currentRecord['SCHEMA_S_LONGNAME'])}:`;
      documentString += `Size=${this.currentRecord['SCHEMA_S_FILESIZE']}:`;
      documentString += `IsParent=${isParent}:`;
      documentString += `LoginName=${userModel.Id}:`;
      documentString += `UserName=${userModel.LoginName}:`;
      // process date
      const fileDate = this.currentRecord['SCHEMA_S_FILEUTC'];
      const posSpace = fileDate.indexOf(' ');
      documentString += `Date=${fileDate.substring(0, posSpace)}:`;

      // init parameters for the viewer
      const init_params = {
        'GUIFile': 'AdeptConvertPrintRedline.gui',
        'CodeBase': options['Codebase'],
        'FileName': documentString,
        'JVueServer': options['JVueServer'],
        'DMS': options['DMS'],
        'UserName': userModel.LoginName,
        'Locale': userModel.cultureName,
        'WebApiURL': Global.API_URL
      };

      const viewerURL = this.VIEWERURL;

      this.checkViewer().subscribe(resp => {
        this.http.post(`${viewerURL}/openfile`, JSON.stringify(init_params)).subscribe(result => {
          console.log('hey there');
        });
      }, error => {
        alert('Viewer failed to launch');
      });

    });

  }

  getViewerOptions(): Observable<Map<string, string>> {
    if (!this.viewerOptions) {
      return this.http.get(`${Global.API_URL}/api/configuration/vieweroptions`)
      .pipe(map(resp => this.viewerOptions = resp as Map<string, string>));
    } else {
      return of(this.viewerOptions);
    }
  }

  checkViewer(): Observable<any> {
    // see if viewer is running
    return this.http.get(this.VIEWERURL,  {responseType: 'text'} ).pipe(switchMap(resp => {
      // return true
      return of(true);
    }), catchError(error => {
      // if it isn't running we use the URI scheme to launch it, the jnlp is generated on the server
      const secure = window.location.protocol === 'http:' ? 'false' : 'true';
      window.location.href = `jnlp:${Global.API_URL}/api/view/jnlp?secure=${secure}&webapiurl=${Global.API_URL}`;
      // wait for the viewer to come alive
      return this.waitForViewer();
    }));
  }

  waitForViewer(): Observable<any> {
    // checks if the viewer is running, it retries every 2 seconds on failure
    return this.http.get(this.VIEWERURL, { responseType: 'text' })
    .pipe(retryWhen(_ => {
        return interval(2000).pipe(
          flatMap(count => {
            if (count === 10) {
              throwError('Giving up');
            } else {
              return of(count);
            }
          })
        );
      }));
  }

}
