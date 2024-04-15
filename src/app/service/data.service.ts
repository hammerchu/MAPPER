import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class DataService {

  // header mode
  headerModeList = ['setup', 'zone', 'station']
  headerMode = this.headerModeList[0]



  // current map
  current_map = undefined
  map_list = [ // manual work for now
    'Elements04.png',
    'WKCD02.png',
    'WKCD03.png',
  ]
  map_preflix = 'assets/maps/'

  // map_fix (black and white)
  map_fix_obj:any[] = []

  // zone
  zone_obj:any[] = []

  // assit obj (not going into the final control map)
  assit_obj:any[] = []

  // station obj (not going into the final control map)
  station_obj:any[] = []



  constructor() {
  }
}
