import fiona
from shapely.geometry import shape
import sys
# Open the shapefile
with fiona.open("/Users/nilswitt/Downloads/hu_EPSG25832_Shape/hu_shp.shp") as shapefile:
    # Iterate over the records
    for record in shapefile:
        # Get the geometry from the record
        geometry = shape(record['geometry'])
        print(record)
        sys.exit(1)
        # Print the area of the geometry
        print(geometry.area)