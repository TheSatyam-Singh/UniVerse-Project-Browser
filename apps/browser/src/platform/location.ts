import { nativeModule, type LocationPermission } from "@universe/shell";

export type { LocationPermission };

const Location = nativeModule("ArdiaLocation");

export const locationPermission = () => Location.locationPermission();
export const requestLocationPermission = () => Location.requestLocationPermission();
export const openLocationSettings = () => Location.openLocationSettings();
