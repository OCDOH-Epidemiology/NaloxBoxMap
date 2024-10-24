import pandas as pd
import geojson
import os

# Load Excel File
excel_file_path = "P:/1887Building/Epidemiology/Personal Folders/DQ/Projects/NaloxBoxMap/Locations File for Naloxbox.xlsx"
df = pd.read_excel(excel_file_path)

# Handle NaN values by filling them with empty strings
df.fillna("", inplace=True)

# Function to convert DataFrame to GeoJSON
def dataframe_to_geojson(df, properties_columns, lat_col, lon_col):
    features = []
    for _, row in df.iterrows():
        try:
            # Skip rows with missing coordinates
            if pd.isna(row[lat_col]) or pd.isna(row[lon_col]):
                continue

            feature = geojson.Feature(
                geometry=geojson.Point((float(row[lon_col]), float(row[lat_col]))),
                properties={col: row[col] for col in properties_columns}
            )
            features.append(feature)
        except ValueError as e:
            print(f"Skipping row {_} due to error: {e}")
            continue

    return geojson.FeatureCollection(features)

# Define columns
properties_columns = ['name', 'address', 'narcanlocation', 'hours']  # Replace with the actual column names
lat_col = 'latitude'  # Replace with actual latitude column name
lon_col = 'longitude'  # Replace with actual longitude column name

# Create GeoJSON
geojson_data = dataframe_to_geojson(df, properties_columns, lat_col, lon_col)

# Write to file
geojson_file_path = "P:/1887Building/Epidemiology/Personal Folders/DQ/Projects/NaloxBoxMap/Extended_GeoJSON_Locations.geojson"
with open(geojson_file_path, "w") as f:
    geojson.dump(geojson_data, f)

print("GeoJSON file has been updated.")
