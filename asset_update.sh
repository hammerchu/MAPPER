#!/bin/bash
#
# Use this script to copy maps from the bot/data/maps folder to the MAPPER folder
#
source_folder="/Users/hammerchu/Desktop/DEV/OBB/bot/data/maps/"
destination_folder="/Users/hammerchu/Desktop/DEV/OBB/MAPPER/src/assets/maps"
exclusion_list=("BACKUP" "T00" )
json_file="$destination_folder/map_list.json"

# Create an empty array to store sub-folder names
subfolders=()

# Loop through each sub-folder in the source folder
for subfolder in "$source_folder"/*; do
    # Extract the sub-folder name
    folder_name=$(basename "$subfolder")

    # Flag to track if the sub-folder should be excluded
    exclude_subfolder=false

    # Check if any key in the exclusion list is a substring of the sub-folder name
    for exclusion in "${exclusion_list[@]}"; do
        if [[ "$folder_name" == *"$exclusion"* ]]; then
            exclude_subfolder=true
            echo "Excluding sub-folder '$folder_name' (matched exclusion keyword: '$exclusion')."
            break
        fi
    done

    # Add the sub-folder name to the array if it should not be excluded
    if ! "$exclude_subfolder"; then
        subfolders+=("$folder_name")
        cp -r "$subfolder" "$destination_folder"
    fi
done

# Convert the array to JSON format and save it to a file
json_data=$(printf '%s\n' "${subfolders[@]}" | jq -R . | jq -s .)
echo "$json_data" > "$json_file"

echo "Sub-folders copied and JSON file created: $json_file"
