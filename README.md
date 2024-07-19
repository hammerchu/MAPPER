# MAPPER

UI & UX for editing OBB maps

---

## Features

- Paint edit the map
- Adding stations to the map
- Adding zones associate with zone_cmd detected and run by BOTs

## Manually download map data as JSON (outdated as BOT has a new script to do that)

run "node src/index.js" -> /Users/.../.../DEV/OBB/MAPPER/map_data.json

## Step 1 - Load Maps from bot/data/maps

run "./asset_update.sh" - it will skip maps that match exclude keywords in the script

It will copy map_marker.json marker_map.png if there is any

## Export modified Base maps to Navis

Download basemap from MAPPER, move the png to bot/data/maps/<map_name>, run bot/asset_manager.py -m <map_name>
