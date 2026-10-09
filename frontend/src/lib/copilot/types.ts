import type { EvidenceClass } from '../evidence'
import type { Hazard, Region, Substitutability } from '../../store/useScenarioStore'

export type CopilotActionKind =
  | 'navigate'
  | 'apply-scenario'
  | 'download-brief'
  | 'download-portfolio-brief'
  | 'select-entity'
  /** Navigates to the Digital Twin for a region AND starts the simulation
   * clock running — the "guide me to the map and show me live movement"
   * request: one click does both instead of the user hunting for the
   * region switch and the run button separately. */
  | 'go-to-map'
  /** Starts (or restarts) the active scenario's run without leaving the
   * current page — "run the simulation" as a direct command. */
  | 'run-simulation'

export interface CopilotAction {
  id: string
  label: string
  kind: CopilotActionKind
  to?: string
  region?: Region
  hazard?: Hazard
  severity?: number
  durationMonths?: number
  substitutability?: Substitutability
  entityId?: string
  /** Carries the data a 'download-brief' action needs to regenerate the
   * exact same brief it was offered for, without re-running analysis. */
  briefRegion?: Region
}

export type CopilotBlock =
  | { kind: 'text'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'bullets'; items: string[] }
  | { kind: 'stat'; label: string; value: string; sub?: string; evidence?: EvidenceClass }
  | { kind: 'statRow'; stats: { label: string; value: string; evidence?: EvidenceClass }[] }
  | {
      kind: 'rankedList'
      title: string
      rows: { rank: number; label: string; value: string; sub: string; evidence: EvidenceClass }[]
    }
  | { kind: 'table'; headers: string[]; rows: string[][] }
  | { kind: 'actions'; actions: CopilotAction[] }
  /** Quick-reply follow-up prompts — clicking one sends it as the next
   * message, same as typing it, so a reply can suggest where to dig next. */
  | { kind: 'suggestions'; prompts: string[] }

export interface CopilotTurn {
  id: string
  role: 'user' | 'assistant'
  text?: string
  blocks?: CopilotBlock[]
}
