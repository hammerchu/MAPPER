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

  list_obj(type:string){
    if (type === 'zone'){
      console.log(this.dataService.zone_obj)
    }
    if (type === 'map'){
      console.log(this.dataService.map_fix_obj)
    }
  }

}
