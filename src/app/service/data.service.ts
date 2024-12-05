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
      // get all map names
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

  check_convex_polygon(points:any[]){
    // Check if a polygon is convex by verifying that all interior angles are less than 180 degrees
    // Returns true if convex, false if concave
    let n = points.length;
    if (n < 3) return true; // A polygon must have at least 3 points

    for (let i = 0; i < n; i++) {
      let p1 = points[i];
      let p2 = points[(i + 1) % n];
      let p3 = points[(i + 2) % n];

      // Calculate cross product to determine if points make a right or left turn
      let crossProduct = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);

      // If cross product changes sign, the polygon is concave
      if (i === 0) {
        if (crossProduct < 0) return false;
      } else {
        if (crossProduct < 0) return false;
      }
    }
    return true;
  }



}
