/**
 * @fileoverview Antenna - Antenna model and logic for position, height, gain, power, and marker management.
 * Contains: AntennaEnum, Antenna class for antenna state and map marker updates.
 */

import {LngLat, Map as MapLibreMap, Marker} from "maplibre-gl";
import {DataProvider, DataProviderEventEnum} from "./DataProvider";
import {UIHelpers} from "./uihelpers";
import {DistanceUIController} from "./controllers/DistanceUIController";

/**
 * Enum for identifying antennas.
 * @readonly
 * @enum {string}
 */
export enum AntennaEnum {
    ONE = 'left',
    TWO = 'right'
}

/**
 * Class representing an antenna, including position, height, and marker logic.
 */
export class Antenna {
    /**
     * Height over ground in meters.
     * @type {number | undefined}
     */
    private height: number | undefined = undefined;
    /**
     * Latitude and Longitude in degrees.
     * @type {LngLat | undefined}
     */
    private latlng: LngLat | undefined = undefined;
    /**
     * Transmitted power in dBm
     */
    private transmittedPower_dBm: number = 0;
    /**
     * Antenna gain in dBi
     */
    private antennaGain_dBi: number = 0;
    /**
     * The marker for the antenna on the map.
     * @type {Marker}
     */
    private marker = new Marker();
    /**
     * The map instance.
     * @type {MapLibreMap | null}
     */
    private map: MapLibreMap | null = null;
    /**
     * The antenna identifier.
     * @type {AntennaEnum}
     */
    private id: AntennaEnum;
    private associatedAntenna: Antenna | null = null;

    /**
     * Frequency in Hz
     * @private
     */
    private frequency: number = 0;

    /**
     * Constructs an Antenna instance.
     * @param {AntennaEnum} id - Identifier for the antenna
     */
    constructor(id: AntennaEnum) {
        this.id = id;
    }

    /**
     * Gets the antenna's identifier.
     * @returns {AntennaEnum} The antenna's identifier
     */
    getId(): AntennaEnum {
        return this.id;
    }

    /**
     * Sets the antenna's identifier.
     * @param {AntennaEnum} id - The new identifier
     * @returns {void}
     */
    setId(id: AntennaEnum): void {
        this.id = id;
    }

    /**
     * Gets the antenna's height.
     * @returns {number | undefined} The antenna's height
     */
    getHeight(): number | undefined {
        return this.height;
    }

    /**
     * Gets the antenna's position.
     * @returns {LngLat | undefined} The antenna's position
     */
    getLatlng(): LngLat | undefined {
        return this.latlng;
    }

    /**
     * Gets the transmitted power in dBm.
     * @returns {number} Transmitted power in dBm
     */
    getTransmittedPower(): number {
        return this.transmittedPower_dBm;
    }

    /**
     * Gets the antenna gain in dBi.
     * @returns {number} Antenna gain in dBi
     */
    getAntennaGain(): number {
        return this.antennaGain_dBi;
    }

    /**
     * Sets the antenna's height and updates the UI.
     * @param {number | undefined} height - The new height
     * @returns {void}
     */
    setHeight(height: number | undefined): void {
        this.height = height;
        document.querySelectorAll(`.station-card.${this.id} .station-row`).forEach(row => {
            row.querySelectorAll('.label').forEach((label, idx) => {
                if (label.textContent.trim() === 'Height') {
                    row.querySelectorAll('.value')[idx].textContent = String(height) + " m";
                }
            });
        });
        this.updateExpectedSignal();
    }

    /**
     * Sets the transmitted power in dBm.
     * @param {number} power - Transmitted power in dBm
     * @returns {void}
     */
    setTransmittedPower(power: number): void {
        this.transmittedPower_dBm = power;
        document.querySelectorAll(`.station-card.${this.id} .station-row`).forEach(row => {
            row.querySelectorAll('.label').forEach((label, idx) => {
                if (label.textContent.trim() === 'Transmitted Power (dBm)') {
                    let valueField = row.querySelectorAll('.value')[idx] as HTMLInputElement;
                    valueField.value = String(power);
                }
            });
        });
        this.updateExpectedSignal();
    }

    /**
     * Sets the antenna gain in dBi.
     * @param {number} gain - Antenna gain in dBi
     * @returns {void}
     */
    setAntennaGain(gain: number): void {
        this.antennaGain_dBi = gain;
        document.querySelectorAll(`.station-card.${this.id} .station-row`).forEach(row => {
            row.querySelectorAll('.label').forEach((label, idx) => {
                if (label.textContent.trim() === 'Antenna Gain (dBi)') {
                    let valueField = row.querySelectorAll('.value')[idx] as HTMLInputElement;
                    valueField.value = String(gain);
                }
            });
        });
        this.updateExpectedSignal();
    }

    /**
     * Sets the antenna's position and updates the marker if a map is set.
     * @param {LngLat | undefined} latlng - The new position
     * @returns {void}
     */
    setLatlng(latlng: LngLat | undefined): void {
        this.latlng = latlng;
        if (this.map) {
            this.marker.setLngLat(this.latlng);
            this.marker.addTo(this.map);
        }
        const selector = `.station-card.${this.id} .station-location .value`;
        document.querySelector(selector).textContent = latlng.lat.toPrecision(4) + ', ' + latlng.lng.toPrecision(4);
        DataProvider.getSharedInstance().emitEvent(DataProviderEventEnum.ANTENNA_POSITION_CHANGED, {
            antenna: this,
            antenna_id: this.id,
        });
        this.updateExpectedSignal();
    }

    /**
     * Adds the antenna marker to the map.
     * @param {MapLibreMap} map - The map instance
     * @returns {void}
     */
    public addToMap(map: MapLibreMap): void {
        this.map = map;
        if (this.latlng) {
            this.marker.setLngLat(this.latlng);
            this.marker.addTo(map);
        }
    }

    /**
     * Removes the antenna marker from the map.
     * @returns {void}
     */
    public removeFromMap(): void {
        if (this.map) {
            this.marker.remove();
            this.map = null;
        }
    }

    /**
     * Sets the device name in the UI.
     * @param {string} name - The device name
     * @returns {void}
     */
    setDeviceName(name: string): void {
        const selector = `.station-card.${this.id} .station-title .value`;
        document.querySelector(selector).textContent = name;
    }

    /**
     * Sets the frequency in the UI.
     * @param {number} frequency - The frequency value
     * @returns {void}
     */
    setFrequency(frequency: number): void {
        this.frequency = frequency;
        console.log(this.id, this.frequency)
        document.querySelectorAll(`.station-card.${this.id} .station-row`).forEach(row => {
            const label = row.querySelector('.label');
            console.log(label)
            if (label && label.textContent.trim() === 'Frequency (MHz)') {
                let valueField = row.querySelector('.value') as HTMLInputElement;
                valueField.value = String(frequency / 1000);
            }
        });
        this.updateExpectedSignal();
    }

    /**
     * Sets the azimuth angle to another antenna.
     * @param {Antenna} to - The other antenna
     * @returns {void}
     */
    setAzimuth(to: Antenna): void {
        document.querySelectorAll(`.station-card.${this.id} .station-row`).forEach(row => {
            row.querySelectorAll('.label').forEach((label, idx) => {
                if (label.textContent.trim() === 'Azimuth') {
                    let azimuth = UIHelpers.calculateAzimuth(this.getLatlng(), to.getLatlng());
                    if (azimuth) {
                        row.querySelectorAll('.value')[idx].textContent = azimuth.toFixed(1);
                    } else {
                        row.querySelectorAll('.value')[idx].textContent = 'N/A';
                    }
                }
            });
        });
    }

    /**
     * Sets the tilt angle in the UI.
     * @param {number} tilt - The tilt value
     * @returns {void}
     */
    setTilt(tilt: number): void {
        document.querySelectorAll(`.station-card.${this.id} .station-row`).forEach(row => {
            row.querySelectorAll('.label').forEach((label, idx) => {
                if (label.textContent.trim() === 'Tilt') {
                    row.querySelectorAll('.value')[idx].textContent = String(tilt);
                }
            });
        });
    }

    /**
     * Sets the expected signal value in the UI.
     * @param {number} signal - The expected signal
     * @returns {void}
     */
    setExpectedSignal(signal: number): void {
        const selector = `.station-card.${this.id} .expected-signal .value`;
        document.querySelector(selector).textContent = signal.toFixed(2) + " dBm";
    }

    /**
     * Sets the associated antenna for the object.
     *
     * @param {Antenna | null} antenna - The antenna to associate with the object, or null to disassociate any currently associated antenna.
     * @return {void}
     */
    setAssociatedAntenna(antenna: Antenna | null): void {
        this.associatedAntenna = antenna;
        this.updateExpectedSignal();
    }

    getAssociatedAntenna(): Antenna | null {
        return this.associatedAntenna;
    }


    updateExpectedSignal(no_rec = false): void {
        if (!this.associatedAntenna) {
            return
        }
        const distance = DistanceUIController.calculateDistanceBetweenAntennas(this, this.associatedAntenna);
        const pr = UIHelpers.calculateFriisSignal(
            this.getAssociatedAntenna().getTransmittedPower(),
            this.getAntennaGain(),
            this.getAssociatedAntenna().getAntennaGain(),
            240000,
            distance
        );
        this.setExpectedSignal(pr);
        if (!no_rec) {
            this.associatedAntenna.updateExpectedSignal(true);

        }
    }
}