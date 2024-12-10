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
  
  check_convex_polygon(points: any[]) {
    // Check if a polygon is convex by verifying that all interior angles are less than 180 degrees
    // Returns true if convex, false if concave
    // Works for both clockwise and counterclockwise polygons
    let n = points.length;
    if (n < 3) return true; // A polygon must have at least 3 points

    // First determine if polygon is clockwise or counterclockwise
    let isCCW = this.check_ccw(points);

    let lastSign = 0;

    for (let i = 0; i < n; i++) {
        let p1 = points[i];
        let p2 = points[(i + 1) % n];
        let p3 = points[(i + 2) % n];

        // Calculate cross product to determine if points make a right or left turn
        let crossProduct = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);

        // Skip if cross product is 0 (collinear points)
        if (crossProduct === 0) continue;

        let currentSign = Math.sign(crossProduct);

        // If we have a previous sign to compare with
        if (lastSign !== 0) {
            // If signs don't match, we have a concave polygon
            if (currentSign !== lastSign) {
                return false;
            }
        }
        
        lastSign = currentSign;
    }

    return true;
  }

  check_ccw(points:any[]){
    // Check if a polygon is counterclockwise by verifying that all interior angles are less than 180 degrees
    // Returns true if counterclockwise, false if clockwise
    // Calculate the signed area using the shoelace formula
    // Positive area indicates CCW, negative indicates CW
    let area = 0;
    const n = points.length;

    for (let i = 0; i < n; i++) {
      let j = (i + 1) % n;
      area += points[i].x * points[j].y;
      area -= points[j].x * points[i].y;
    }

    // Area will be positive for CCW, negative for CW
    // Divide by 2 to get actual area (not needed for just checking orientation)
    return area > 0;
  }



}
