import { Component } from '@angular/core';
import {DataService} from './service/data.service'

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent {

  constructor(public dataService: DataService) {}


  set_header_mode(mode:string){
    console.log(' mode : ', mode );
    this.dataService.headerMode = mode
  }

}
