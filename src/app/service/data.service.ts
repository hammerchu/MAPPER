import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  // header mode
  headerModeList = ['setup', 'zone', 'station']
  headerMode = this.headerModeList[0]

  //storing saved map list from db
  save_map_list:any[] = []
  all_save_map_list: any[] = []
  save_map_list_display:any

  // current map
  is_saved = false
  current_map = ''
  map_list:string[] = [];
  map_header_list:string[] = [];
  map_preflix = 'assets/maps/'

  // map_fix (black and white)
  map_fix_obj:any[] = []

  // zone
  zone_obj:any[] = []

  // assit obj (not going into the final control map)
  assit_obj:any[] = []

  // station obj (not going into the final control map)
  station_obj:any[] = []



  constructor(
    private http: HttpClient
    ) {
      this.getSubfolderNames().subscribe((result)=>{
        this.map_header_list = result
        this.map_list = result
        console.log('map_header_list : ', this.map_header_list );
      })
  }

  getSubfolderNames(): Observable<string[]> {
    return this.http.get<string[]>('/assets/maps/map_list.json'); //Reading list of map from file
  }

  /* Load data into the second map list */
  selectLoadMap(event:any){
    // console.log('selected map_name : ', event.detail.value );
    this.save_map_list = []
    console.log(' this.all_save_map_list : ', this.all_save_map_list );
    this.all_save_map_list.forEach((map)=>{
      if(map.map_name === event.detail.value ){
        this.save_map_list.push(map)
      }
    })
  }



}
