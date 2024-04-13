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



  constructor() {
  }
}
