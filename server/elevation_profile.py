import argparse
import os.path
from typing import Iterable, Literal, Tuple, Dict, Any, Optional

import numpy as np
import pyproj
import rasterio
from affine import Affine
from pyproj import CRS, Transformer, Geod


def get_elevation_profile(
        start_xy: tuple[float, float],
        end_xy: tuple[float, float],
        input_crs: str | int = "EPSG:4326",
        spacing_m: Optional[float] = None,
        num_samples: Optional[int] = 800,
        method: Literal["nearest", "bilinear"] = "bilinear",
) -> list[tuple[float, float]]:
    if num_samples is not None and num_samples < 2:
        raise ValueError("num_samples must be >= 2")
    if method not in ("nearest", "bilinear"):
        raise ValueError("method must be 'nearest' or 'bilinear'")

    transformer = pyproj.Transformer.from_crs("EPSG:4326", "EPSG:25832", always_xy=True)
    tif_folder = "/dgm1_tiff_kacheln"
    tiffs_to_check = []

    start_file = [x / 1000 for x in transformer.transform(start_xy[0], start_xy[1])]
    end_file = [x / 1000 for x in transformer.transform(end_xy[0], end_xy[1])]
    tiffs_to_check.append(start_file)
    tiffs_to_check.append(end_file)
    results_array = []
    for x in range(int(start_file[0]), int(end_file[0]) + 1):
        for y in range(int(start_file[1]), int(end_file[1]) + 1):
            tiffs_to_check.append([x, y])

    for tiff in tiffs_to_check:
        try:
            with rasterio.open(
                    os.path.join(tif_folder, f'dgm1_32_{int(tiff[0])}_{int(tiff[1])}_1_nw_2021.tif')) as ds:
                ds_crs = ds.crs if ds.crs else CRS.from_epsg(4326)
                raster_crs = CRS.from_user_input(ds_crs)
                in_crs = CRS.from_user_input(input_crs)

                # Reproject start/end from input CRS to raster CRS
                to_raster = Transformer.from_crs(in_crs, raster_crs, always_xy=True)
                x0, y0 = to_raster.transform(start_xy[0], start_xy[1])
                x1, y1 = to_raster.transform(end_xy[0], end_xy[1])

                # Determine sampling count based on spacing or num_samples
                if spacing_m is not None and spacing_m > 0:
                    N = _samples_from_spacing(raster_crs, (x0, y0), (x1, y1), spacing_m)
                else:
                    N = max(2, int(num_samples or 200))

                # Sample coordinates along the segment in raster CRS
                t = np.linspace(0.0, 1.0, N, dtype=np.float64)
                xs = x0 + (x1 - x0) * t
                ys = y0 + (y1 - y0) * t

                # Read DEM and mask
                band = ds.read(1).astype(np.float64, copy=False)
                mask = ds.read_masks(1) > 0
                nodata = ds.nodata
                if nodata is not None:
                    band = np.where(band == nodata, np.nan, band)
                band = np.where(mask, band, np.nan)

                # Interpolate values
                vals = _sample_raster_at_points(
                    band=band,
                    transform=ds.transform,
                    xs=xs,
                    ys=ys,
                    method=method,
                )

                # Compute cumulative distances in meters
                dist_m = _compute_cumulative_distances(
                    raster_crs=raster_crs,
                    xs=xs,
                    ys=ys,
                )

                result: Dict[str, Any] = {"distance_m": dist_m, "elevation": vals}
                results_array.append(result)
        except Exception as e:
            print(f"Error reading {tiff}: {e}")

    concat_result: list[tuple[float, float]] = []
    for result in results_array:
        for i in range(len(result["distance_m"])):
            if not np.isnan(result["elevation"][i]):
                concat_result.append((result["distance_m"][i], result["elevation"][i]))
    return concat_result


def _samples_from_spacing(
        raster_crs: CRS,
        p0: Tuple[float, float],
        p1: Tuple[float, float],
        spacing_m: float,
) -> int:
    """Compute number of samples given desired spacing (meters) between points."""
    x0, y0 = p0
    x1, y1 = p1
    if raster_crs.is_projected:
        length = float(np.hypot(x1 - x0, y1 - y0))
    else:
        # Transform to WGS84 for geodesic length
        to_wgs84 = Transformer.from_crs(raster_crs, CRS.from_epsg(4326), always_xy=True)
        lon0, lat0 = to_wgs84.transform(x0, y0)
        lon1, lat1 = to_wgs84.transform(x1, y1)
        geod = Geod(ellps="WGS84")
        _, _, length = geod.inv(lon0, lat0, lon1, lat1)
    if length <= 0:
        return 2
    n = int(np.floor(length / float(spacing_m))) + 1
    return max(2, n)


def _sample_raster_at_points(
        band: np.ndarray,
        transform: Affine,
        xs: Iterable[float],
        ys: Iterable[float],
        method: Literal["nearest", "bilinear"] = "bilinear",
) -> np.ndarray:
    """Sample raster band at given x/y (in raster CRS) using 'nearest' or 'bilinear' interpolation."""
    h, w = band.shape
    inv: Affine = ~transform

    # Compute fractional column/row indices (x -> col, y -> row)
    xs = np.asarray(xs, dtype=np.float64)
    ys = np.asarray(ys, dtype=np.float64)
    cols = inv.a * xs + inv.b * ys + inv.c
    rows = inv.d * xs + inv.e * ys + inv.f

    if method == "nearest":
        j = np.rint(cols).astype(np.int64)
        i = np.rint(rows).astype(np.int64)
        inside = (i >= 0) & (i < h) & (j >= 0) & (j < w)
        vals = np.full(xs.shape, np.nan, dtype=np.float64)
        vals[inside] = band[i[inside], j[inside]]
        return vals

    # Bilinear
    i0 = np.floor(rows).astype(np.int64)
    j0 = np.floor(cols).astype(np.int64)
    i1 = i0 + 1
    j1 = j0 + 1

    di = rows - i0
    dj = cols - j0

    inside = (i0 >= 0) & (i1 < h) & (j0 >= 0) & (j1 < w)
    vals = np.full(xs.shape, np.nan, dtype=np.float64)
    if not np.any(inside):
        return vals

    ii0 = i0[inside]
    jj0 = j0[inside]
    ii1 = i1[inside]
    jj1 = j1[inside]
    dii = di[inside]
    djj = dj[inside]

    v00 = band[ii0, jj0]
    v10 = band[ii0, jj1]
    v01 = band[ii1, jj0]
    v11 = band[ii1, jj1]

    # If any neighbor is NaN, output NaN
    neighbor_nan = np.isnan(v00) | np.isnan(v10) | np.isnan(v01) | np.isnan(v11)
    w00 = (1.0 - djj) * (1.0 - dii)
    w10 = djj * (1.0 - dii)
    w01 = (1.0 - djj) * dii
    w11 = djj * dii
    interp = w00 * v00 + w10 * v10 + w01 * v01 + w11 * v11
    interp[neighbor_nan] = np.nan

    vals[inside] = interp
    return vals


def _compute_cumulative_distances(
        raster_crs: CRS,
        xs: np.ndarray,
        ys: np.ndarray,
) -> np.ndarray:
    """Compute cumulative distances (meters) along points. Uses planar if projected, geodesic if geographic."""
    if raster_crs.is_projected:
        dx = np.diff(xs)
        dy = np.diff(ys)
        seg = np.hypot(dx, dy)
        dist = np.concatenate(([0.0], np.cumsum(seg)))
        return dist

    # Geographic: transform to WGS84 lon/lat and compute geodesic distances
    to_wgs84 = Transformer.from_crs(raster_crs, CRS.from_epsg(4326), always_xy=True)
    lons, lats = to_wgs84.transform(xs, ys)
    lons = np.asarray(lons, dtype=np.float64)
    lats = np.asarray(lats, dtype=np.float64)
    geod = Geod(ellps="WGS84")
    _, _, seg = geod.inv(lons[:-1], lats[:-1], lons[1:], lats[1:])
    dist = np.concatenate(([0.0], np.cumsum(seg)))
    return dist


def _parse_point(text: str) -> Tuple[float, float]:
    """Parse 'x,y' or 'lon,lat' string."""
    parts = text.replace(";", ",").split(",")
    if len(parts) != 2:
        raise argparse.ArgumentTypeError("Point must be 'x,y' or 'lon,lat'")
    return float(parts[0].strip()), float(parts[1].strip())
