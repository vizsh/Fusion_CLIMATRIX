import type { EvidenceClass } from '../evidence'
import type { Hazard, Region, Substitutability } from '../../store/useScenarioStore'

export type CopilotActionKind = 'navigate' | 'apply-scenario' | 'download-brief' | 'select-entity'

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

export interface CopilotTurn {
  id: string
  role: 'user' | 'assistant'
  text?: string
  blocks?: CopilotBlock[]
}
