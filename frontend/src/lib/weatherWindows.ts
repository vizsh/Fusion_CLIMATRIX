import type { Region } from '../store/useScenarioStore'

export interface WeatherWindow {
  lat: number
  lng: number
  start: string
  end: string
  label: string
}

// Real documented event windows for HP (2023 monsoon) and KL (2018 flood);
// MH and UK have no single documented date tied to this prototype's
// illustrative hazard zones, so they use a representative recent window,
// labeled honestly as such rather than implied to be event-specific.
export const WEATHER_WINDOWS: Record<Region, WeatherWindow> = {
  HP: { lat: 31.98, lng: 77.15, start: '20230701', end: '20230715', label: '2023 monsoon disaster window (documented)' },
  KL: { lat: 10.85, lng: 76.27, start: '20180801', end: '20180820', label: '2018 flood window (documented)' },
  MH: { lat: 19.0, lng: 76.5, start: '20230401', end: '20230415', label: 'Representative pre-monsoon window (illustrative, not event-specific)' },
  UK: { lat: 30.55, lng: 79.56, start: '20230701', end: '20230710', label: 'Representative 2023 monsoon window (illustrative, not tied to a documented local event)' },
}
