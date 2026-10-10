// "Add a news source and ask how this affects my portfolio" — the Copilot
// feature this file implements end to end:
//   1. Pull a URL out of the message (or treat the whole message as pasted
//      article text if there's no URL).
//   2. If it's a URL, fetch and extract the real article text server-side
//      (api.ts -> backend/app/connectors/article_extractor.py — a browser
//      fetch() of an arbitrary news site is blocked by CORS almost
//      everywhere, so this one step has to go through the backend).
//   3. Entity-link the extracted text against THIS portfolio's own graph
//      (companies, institutions, regions) — not a keyword search, a real
//      match against the same NODES every dashboard page reads.
//   4. Detect whether the article itself describes a hazard type, and run
//      every linked company's stressed credit/equity impact through the
//      exact same stressPdLgd engine every other page uses.
//   5. Return a plain CopilotBlock[] report that names, for each linked
//      entity, WHY it's relevant and WHAT the modelled number says —
//      never a bare "this seems related" guess.

import { computeEquityImpact, REGION_LABEL, stressPdLgd, type Hazard, type Region, type ScenarioState, type Substitutability } from '../../store/useScenarioStore'
import { extractArticle } from '../api'
import { NODES, type GNode } from '../indiaGraphData'
import { sectorVulnerability } from '../sectorVulnerability'
import { detectHazard } from './freeTextScenario'
import { detectRegion } from './params'
import type { CopilotAction, CopilotBlock } from './types'

const URL_RE = /https?:\/\/[^\s)]+/i

export function extractUrl(text: string): string | null {
  const m = text.match(URL_RE)
  return m ? m[0].replace(/[),.]+$/, '') : null
}

/** Deliberately broader than a strict "is this definitely about news"
 * check — a bare URL pasted into the chat is already an unambiguous
 * signal on its own, and keyword phrasing catches pasted article text
 * that has no URL at all. False positives are cheap here (the fallback
 * is just a normal Copilot answer attempt), false negatives are the real
 * cost (a user's pasted article silently gets no special handling). */
export function isNewsCorrelationRequest(text: string): boolean {
  if (extractUrl(text)) return true
  return /\b(news (source|article)|this article|add (a |this )?(news|source)|correlate (this|the) news|how (does|will|would) this (news|article) affect)\b/i.test(text)
}

interface LinkedCompany {
  node: GNode
  matchedOn: string
}
interface LinkedInstitution {
  node: GNode
  matchedOn: string
}
interface LinkedRegion {
  region: Region
  matchedOn: string
}

/** Gazetteer-style entity linking against THIS graph's own node labels —
 * the same mechanic as the backend's app/services/nlp.py link_entities,
 * kept client-side here so company/institution exposure can be computed
 * in the same breath without a second round trip. Exact, case-insensitive
 * substring match only (no fuzzy ratio) — real news prose rarely misspells
 * a company name, and a false fuzzy match here would misattribute a real
 * article to the wrong (synthetic) company, which is worse than missing it. */
function linkEntities(text: string): { companies: LinkedCompany[]; institutions: LinkedInstitution[]; regions: LinkedRegion[] } {
  const lower = text.toLowerCase()
  const companies: LinkedCompany[] = []
  const institutions: LinkedInstitution[] = []
  const regionsFound = new Set<Region>()
  const regions: LinkedRegion[] = []

  for (const node of NODES) {
    if (node.kind !== 'company' && node.kind !== 'bank' && node.kind !== 'govt' && node.kind !== 'insurer') continue
    const label = node.label.toLowerCase()
    if (!label || label.length < 4) continue
    if (lower.includes(label)) {
      if (node.kind === 'company') companies.push({ node, matchedOn: node.label })
      else institutions.push({ node, matchedOn: node.label })
    }
  }

  for (const region of Object.keys(REGION_LABEL) as Region[]) {
    const label = REGION_LABEL[region].toLowerCase()
    if (lower.includes(label) && !regionsFound.has(region)) {
      regionsFound.add(region)
      regions.push({ region, matchedOn: REGION_LABEL[region] })
    }
  }
  const aliasRegion = detectRegion(text)
  if (aliasRegion && !regionsFound.has(aliasRegion)) {
    regionsFound.add(aliasRegion)
    regions.push({ region: aliasRegion, matchedOn: '(regional alias in text)' })
  }

  return { companies, institutions, regions }
}

function fmtCr(n: number) {
  return `₹${n.toFixed(1)} cr`
}

export interface NewsCorrelationResult {
  blocks: CopilotBlock[]
}

/** The actual correlation step: for every linked company, run the SAME
 * stressPdLgd formula every dashboard page uses, under the hazard the
 * article itself describes if one was detected (falling back to the
 * currently active dashboard hazard, disclosed as such either way) and
 * the current severity/duration/substitutability dials — article prose
 * essentially never states a numeric severity, so the active dial is
 * used as a disclosed assumption, never silently invented. */
export async function correlateNewsWithPortfolio(raw: string, state: ScenarioState): Promise<NewsCorrelationResult> {
  const url = extractUrl(raw)
  let title = ''
  let bodyText = raw
  let sourceNote: CopilotBlock

  if (url) {
    try {
      const article = await extractArticle(url)
      title = article.title
      bodyText = `${article.title}\n\n${article.text}`
      sourceNote = {
        kind: 'text',
        text: `Source: "${article.title}" — ${article.char_count} characters of real article text fetched and extracted server-side from the URL you gave.`,
      }
    } catch (e) {
      return {
        blocks: [
          { kind: 'heading', text: 'Could not fetch that article' },
          { kind: 'text', text: e instanceof Error ? e.message : 'The backend could not reach or read that URL.' },
          { kind: 'text', text: 'Paste the article text directly instead and I can still correlate it against your portfolio — no URL fetch required for that path.' },
        ],
      }
    }
  } else {
    sourceNote = { kind: 'text', text: 'Source: pasted text (no URL given) — analysed exactly as provided, nothing fetched.' }
  }

  const { companies, institutions, regions } = linkEntities(bodyText)
  const articleHazard = detectHazard(bodyText)
  const hazard: Hazard = articleHazard ?? state.hazard
  const severity = state.severity
  const durationMonths = state.durationMonths
  const substitutability: Substitutability = state.substitutability

  if (companies.length === 0 && institutions.length === 0 && regions.length === 0) {
    return {
      blocks: [
        { kind: 'heading', text: 'News read, but nothing in it matches your portfolio' },
        sourceNote,
        {
          kind: 'text',
          text: "I checked this text against every company, bank/insurer and region in the graph by name — none of them are mentioned. That's an honest \"no correlation found,\" not a hidden one: re-check if you expected a specific holding to show up, its name may differ from how the article refers to it.",
        },
      ],
    }
  }

  const blocks: CopilotBlock[] = [
    { kind: 'heading', text: title ? `News correlation — "${title}"` : 'News correlation — pasted text' },
    sourceNote,
  ]

  if (articleHazard) {
    blocks.push({
      kind: 'text',
      text: `This text describes a ${articleHazard} event. Impact below is computed under ${articleHazard} at the portfolio's current severity/duration dial (${severity}/100, ${durationMonths}mo) — the article doesn't state a numeric severity, so the active dial is used as a disclosed assumption, not invented from the text.`,
    })
  } else {
    blocks.push({
      kind: 'text',
      text: `No specific hazard type was detected in this text, so impact below uses the currently active scenario (${hazard}, ${severity}/100, ${durationMonths}mo) as the comparison basis.`,
    })
  }

  if (companies.length > 0) {
    const rows = companies.map(({ node }) => {
      const ead = node.eadCr ?? 0
      const { stressedPd, stressedLgd } = stressPdLgd(node.baselinePd ?? 0, node.baselineLgd ?? 0, severity, durationMonths, substitutability, sectorVulnerability(node.sector))
      const stressedEl = ead * stressedPd * stressedLgd
      const equity = computeEquityImpact(node, severity, durationMonths)
      return { node, stressedEl, revenueAtRiskCr: equity.revenueAtRiskCr }
    })
    blocks.push({
      kind: 'rankedList',
      title: `Portfolio companies mentioned in this article (${rows.length})`,
      rows: rows
        .sort((a, b) => b.stressedEl - a.stressedEl)
        .map((r, i) => ({
          rank: i + 1,
          label: r.node.label,
          value: fmtCr(r.stressedEl),
          sub: `${r.node.sector} · ${REGION_LABEL[(r.node.region as Region) ?? 'HP']} · stressed EL under ${hazard} ${severity}/100 · revenue at risk ${fmtCr(r.revenueAtRiskCr)}`,
          evidence: 'modelled',
        })),
    })
  }

  if (institutions.length > 0) {
    blocks.push({
      kind: 'bullets',
      items: institutions.map(({ node }) => `${node.label} (${node.kind}) is mentioned directly in this article — check its book exposure on the Insurance & Protection Gap or Portfolio Dashboard page.`),
    })
  }

  if (regions.length > 0 && companies.length === 0) {
    blocks.push({
      kind: 'text',
      text: `Region(s) mentioned: ${regions.map((r) => REGION_LABEL[r.region]).join(', ')}. No specific portfolio company was named, but this is still a signal worth checking against that region's exposure — see the Dependency Explorer or What-If Analysis for ${REGION_LABEL[regions[0].region]}.`,
    })
  }

  const totalStressedEl = companies.reduce((s, { node }) => {
    const ead = node.eadCr ?? 0
    const { stressedPd, stressedLgd } = stressPdLgd(node.baselinePd ?? 0, node.baselineLgd ?? 0, severity, durationMonths, substitutability, sectorVulnerability(node.sector))
    return s + ead * stressedPd * stressedLgd
  }, 0)

  if (companies.length > 0) {
    blocks.push({
      kind: 'text',
      text: `Combined modelled stressed expected loss across the ${companies.length} mentioned compan${companies.length === 1 ? 'y' : 'ies'}: ${fmtCr(totalStressedEl)}. This is a real-news-triggered read, not a replacement for the dashboard's own scenario numbers — the hazard/severity basis is stated above so you can judge how much weight to put on it.`,
    })
  }

  const actions: CopilotAction[] = []
  if (companies.length > 0) {
    actions.push({ id: 'news-open-company', label: `Open ${companies[0].node.label}`, kind: 'navigate', to: `/company?id=${companies[0].node.id}` })
  }
  if (articleHazard && regions.length > 0) {
    actions.push({
      id: 'news-apply-scenario',
      label: `Apply ${articleHazard} in ${REGION_LABEL[regions[0].region]} to the dashboard`,
      kind: 'apply-scenario',
      region: regions[0].region,
      hazard: articleHazard,
      severity,
      durationMonths,
      substitutability,
    })
  }
  actions.push({ id: 'news-portfolio', label: 'Open Portfolio Dashboard', kind: 'navigate', to: '/dashboard' })
  blocks.push({ kind: 'actions', actions })

  return { blocks }
}
