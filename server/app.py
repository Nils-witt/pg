from flask import Flask, request

from elevation_profile import get_elevation_profile

app = Flask(__name__)

@app.route("/")
def hello_world():
    latitude1: str = request.args.get('latitude1', '')
    longitude1: str = request.args.get('longitude1', '')
    latitude2: str = request.args.get('latitude2', '')
    longitude2: str = request.args.get('longitude2', '')
    coord1= (longitude1,latitude1)
    coord2 = (longitude2,latitude2)

    elevation_profile = get_elevation_profile(coord1, coord2,spacing_m=1)

    return elevation_profile

if __name__ == "__main__":
    app.run(debug=True, port=5001)