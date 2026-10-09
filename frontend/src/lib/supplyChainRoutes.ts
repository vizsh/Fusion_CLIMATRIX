// Supply-chain movement layer for the Digital Twin — ONE real, fully-
// connected route per region rather than a sprawling fleet of hundreds of
// generic icons. This is the explicit product decision the imagery/
// supply-chain audit itself recommends: "start with one complete,
// demonstrable scenario... That gives an end-to-end proof of the
// product's value. Once reliable, scale the same architecture."
//
// Every route connects REAL nodes already in indiaGraphData.ts (hazard ->
// infra -> company, the same chain the Dependency Explorer traces) — this
// is not a second, disconnected data source. The polyline between those
// real coordinates is a hand-authored illustrative corridor (same
// precedent as HP_NH5_ROUTE/UK_HAZARD_ZONE in digitalTwinMap.ts), not a
// GPS track or a real logistics provider's route geometry. The moving
// marker is explicitly labeled "DEMO SIMULATION — NOT LIVE TRACKING"
// everywhere it appears (RouteInspector.tsx) — it does not claim to be a
// real truck, ship or shipment, per the audit's own caution against
// implying a public flight/vessel position reveals cargo contents.

import { HP_NH5_ROUTE } from './digitalTwinMap'
import type { Region } from '../store/useScenarioStore'

export type MovementMode = 'road' | 'port'

export interface SupplyRoute {
  id: string
  region: Region
  mode: MovementMode
  label: string
  hazardId: string
  infraId: string
  companyId: string
  path: [number, number][]
}

export const SUPPLY_ROUTES: SupplyRoute[] = [
  {
    id: 'route-hp',
    region: 'HP',
    mode: 'road',
    label: 'NH-5 Kullu–Manali freight corridor',
    hazardId: 'hz-hp',
    infraId: 'infra-hp-nh5',
    companyId: 'co-hp-tourism',
    path: HP_NH5_ROUTE.geometry.coordinates as [number, number][],
  },
  {
    id: 'route-kl',
    region: 'KL',
    mode: 'port',
    label: 'Kochi Port seafood export corridor',
    hazardId: 'hz-kl',
    infraId: 'infra-kl-port',
    companyId: 'co-kl-seafood',
    path: [
      [76.97, 9.85],
      [76.6, 9.9],
      [76.26, 9.97],
      [76.24, 9.95],
    ],
  },
  {
    id: 'route-mh',
    region: 'MH',
    mode: 'road',
    label: 'Latur–Osmanabad highway freight corridor',
    hazardId: 'hz-mh',
    infraId: 'infra-mh-road',
    companyId: 'co-mh-cotton',
    path: [
      [76.4, 18.9],
      [76.5, 18.4],
      [75.89, 19.85],
    ],
  },
  {
    id: 'route-uk',
    region: 'UK',
    mode: 'road',
    label: 'Cement supply corridor — NH-58 to the construction site',
    hazardId: 'hz-uk',
    infraId: 'infra-uk-road',
    companyId: 'co-uk-construction',
    path: [
      [79.32, 30.08],
      [79.49, 30.42],
      [79.58, 30.57],
    ],
  },
  {
    id: 'route-mb',
    region: 'MB',
    mode: 'port',
    label: 'JNPT–Mumbai port freight corridor',
    hazardId: 'hz-mb',
    infraId: 'infra-mb-port',
    companyId: 'co-generic-logistics',
    path: [
      [72.9489, 18.9489],
      [72.9, 19.0],
      [72.87, 19.12],
    ],
  },
]

export function routeForRegion(region: Region): SupplyRoute | undefined {
  return SUPPLY_ROUTES.find((r) => r.region === region)
}
