import pandas as pd
import geojson
import os

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

def update_geojson_from_excel(excel_path, output_geojson_path, properties_columns, lat_col, lon_col, default_location_type=None):
    df = pd.read_excel(excel_path)
    df.fillna("", inplace=True)
    
    # For each expected property column, if it is missing, add it with a default value.
    for col in properties_columns:
        if col not in df.columns:
            if col == "location_type" and default_location_type is not None:
                df[col] = default_location_type
            else:
                df[col] = ""
    
    geojson_data = dataframe_to_geojson(df, properties_columns, lat_col, lon_col)
    with open(output_geojson_path, "w") as f:
        geojson.dump(geojson_data, f)
    print(f"GeoJSON file '{output_geojson_path}' has been updated from '{excel_path}'.")

if __name__ == "__main__":
    # Define common settings
    properties_columns = ['name', 'address', 'narcanlocation', 'hours', 'location_type']
    lat_col = 'latitude'
    lon_col = 'longitude'

    # Update Naloxbox GeoJSON – default location_type "naloxbox"
    nalox_excel = "P:/1887Building/Epidemiology/Personal Folders/DQ/Projects/NaloxBoxMap/Locations File for Naloxbox.xlsx"
    nalox_geojson = "P:/1887Building/Epidemiology/Personal Folders/DQ/Projects/NaloxBoxMap/Extended_GeoJSON_Locations.geojson"
    update_geojson_from_excel(nalox_excel, nalox_geojson, properties_columns, lat_col, lon_col, default_location_type="naloxbox")

    # Update OOPP Programs GeoJSON – default location_type "OPPP"
    oppp_excel = "P:/1887Building/Epidemiology/Personal Folders/DQ/Projects/NaloxBoxMap/Locations File for OOPP Programs.xlsx"
    oppp_geojson = "P:/1887Building/Epidemiology/Personal Folders/DQ/Projects/NaloxBoxMap/OOPP_Programs.geojson"
    update_geojson_from_excel(oppp_excel, oppp_geojson, properties_columns, lat_col, lon_col, default_location_type="OPPP")

