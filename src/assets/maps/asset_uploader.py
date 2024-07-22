import os
import sys
import argparse
import shutil
import json
import time
import glob
import subprocess
from datetime import datetime
from subprocess import Popen, PIPE, STDOUT
from bot.tools import io, profiles
from bot.classes import connection
# import firebase_admin
# from firebase_admin import credentials
from google.cloud import storage

from bot.tools.profiles import MAP_FOLDER_PATH, MAP_DATA_JSON, LOAD_FB_JS, FB_KEY

'''
Download assets from firebase DB and storage, require LOAD_FB_JS from the local MAPPER folder

python asset_manager.py -u Elements041 -d

-u : str -> map name to upload to navis

-d : bool -> True if we want to download map data and control maps
'''

def download_control_map():
    '''
    download all the control map from firebase storage
    '''
    bucket_name = 'onbotbot-61640.appspot.com'   # Replace with your Firebase Storage bucket name
    filename = 'canvas.png'  # Replace with the filename of the content you want to download
    destination_directory = MAP_FOLDER_PATH
    # Create a storage client
    client = storage.Client.from_service_account_json(FB_KEY)

    # Retrieve the bucket
    bucket = client.get_bucket(bucket_name)

    # List blobs in the specified folder
    blobs = bucket.list_blobs(prefix='control_maps/')

    # Print the list of files
    list_maps = []
    for blob in blobs:
        filename = os.path.basename(blob.name)
        if filename:
          # blob = bucket.blob(filename)
          destination_path = os.path.join(destination_directory, filename.replace('_control', ''), filename+'.png')
          # destination_path = os.path.join(destination_directory.replace('_control', ''), filename+'.png')
          print(f"download {filename}.png to destination_path : { destination_path.replace('_control', '')} ")
          print('--')
          try:
              blob.download_to_filename(destination_path)
          except Exception as err:
              print(f'Unable to load map - {filename}.png - {err}')

    print('-'*10)
    print('All control maps downloaded successfully!')
    print('-'*10)

def download_map_data_json():
    '''
    Download map_data.json from DB and replace the existing one
    '''
    print('Processing Map Data')

    # remove map_data.json if there is any
    if os.path.exists('map_data.json'):
        os.remove('map_data.json')

    # run node src/index.js to download map_data from DB
    print('Download Map Data from Firebase DB')
    p = Popen(['node', LOAD_FB_JS], stdout=PIPE, stderr=STDOUT)
    time.sleep(2)
    if os.path.exists('map_data.json'):
        print('Map data download successfully')
    else:
        print('-'*10)
        print('Map data download failed')
        print('-'*10)
        return

    
    # adding timestamp to the json file
    with open('./map_data.json', 'r') as ff:
        data = json.load(ff)
    new_data = {'last_update': datetime.now().strftime("%Y-%m-%d_%H-%M-%S")}
    data.update(new_data)

    with open('./map_data.json', 'w') as file:
        json.dump(data, file, indent=4)

        
    # copy map_data to /bot/data/map_data.json
    try:
        shutil.copy2('map_data.json', MAP_DATA_JSON) # type: ignore
        os.remove('map_data.json')
    except Exception as e:
        print('Fail to copy file to data/map/')
        return

def download_updated_base_map():
    '''
    download base_maps from firebase storage
    '''
    ...

def upload_base_map_to_navis(map_name):
    '''
    upload base_maps to navis to replace the original one.

    1 - create a copy of the map folder, rename the modified base map to replace the original base map
    2 - zip all the file in the map folder
    3 - send the zip file to navis (detect if navis is available)

    '''
    print("Finding maps at ", os.getcwd())
    map_folder = os.path.join(os.getcwd(), map_name)
    tmp_map_folder = os.path.join(os.getcwd(), 'tmp_'+ map_name)
    zip_file_path = os.path.join(os.getcwd(), f'{map_name}.zip')

    include_ext_list = ['png', 'pcd', 'csv', 'yaml']

    if not os.path.exists(map_folder):
        print('-'*10)
        print(f'Error - Map package {map_name} not found')
        print('-'*10)
        return False

    if not os.path.exists(tmp_map_folder):
        os.makedirs(tmp_map_folder)


    # copy files from map folder to tmp map folder

    '''
    1 - Create a shadow copy of the map folder
    '''
    for ext in include_ext_list:
        for file_path in (glob.glob(map_folder+f'/*.{ext}')):
            
            if 'base_map' in os.path.basename(file_path):
                print('copying ', file_path, f' <--- modified base map, rename to {map_name}.png')
                shutil.copy(file_path, os.path.join(tmp_map_folder, f'{map_name}.png'))
            elif 'marker' in os.path.basename(file_path):
                pass
            elif os.path.splitext(os.path.basename(file_path))[0] and os.path.splitext(file_path)[-1] == '.png':
                pass
            else:
                print('copying ', file_path)
                shutil.copy(file_path, tmp_map_folder)

            # shutil.copy(file_path, tmp_map_folder)
        print('-'*20)


    '''
    2 - Create zip files
    '''

    cmd_list = ['zip', '-j', zip_file_path]

    # for ext in include_ext_list:
    #     cmd_list = cmd_list + (glob.glob(tmp_map_folder+f'/*.{ext}'))

    cmd_list = cmd_list + (glob.glob(tmp_map_folder+'/*'))
    
    result = subprocess.run(cmd_list, capture_output=True, text=True)

    print('result', result.stdout)

    '''
    3 - send it to Navis
    '''

    conn = connection.Connect(profiles.NAVIS_IP)
    if conn:
        try:
            with open(zip_file_path, 'rb') as f:
                print(f'Uploading file {os.path.basename(zip_file_path)} to Navis')
                # print(f' os.path.basename(zip_file_path) : { os.path.basename(zip_file_path)} ')
                conn.upload_map(os.path.basename(zip_file_path), f)
            
        except:
            print('Unable to upload zip file to Navis')
        finally:
            # remove the left over
            os.remove(zip_file_path)
            shutil.rmtree(tmp_map_folder)

    else:
        print('Unable to connect to Navis')

    '''
    4 - Cleaning things up
    '''

    ...
    



if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("-u", "--upload", required = False, help = "map_name of the package to upload to Navis")
    parser.add_argument("-d", "--download", action='store_true', help = " If you want to download map_data & control maps to bot") # store_true is a built-in snippet
    args = parser.parse_args()

    if args.download:
        download_map_data_json()
        download_control_map()
    if args.upload:
        upload_base_map_to_navis(args.upload)