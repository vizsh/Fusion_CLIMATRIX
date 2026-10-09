// Governance & Proposals — CLIMATRIX's own implementation of the
// griid.ai pattern: a disclosed modelling assumption (a sector's
// vulnerability multiplier, a transition-sensitivity value, a new
// scenario archetype) gets proposed with a rationale, not changed live.
// A reviewer approves or rejects it. This is a review-workflow prototype
// — there is no auth system (see README's Honest limitations), so
// "proposed by" / "reviewer" are free-text fields, and approving a
// proposal does not automatically rewrite the targeted constant in the
// codebase; that stays a deliberate manual follow-up, logged here as the
// audit trail for why it changed.

import { Check, ClipboardCheck, Clipboard, Download, Link2, Plus, Share2, X } from 'lucide-react'
import { useEffect, type ReactNode, useState } from 'react'
import PageHeader from '../components/PageHeader'
import {
  copyContextBundle, copyContextBundleJSON, copyGovernanceBundle, copyShareableLink,
  downloadContextBundle, downloadContextBundleJSON, downloadGovernanceBundle, parseImportedContext,
} from '../lib/copilot/contextExport'
import { ApiError, createProposal, listProposals, reviewProposal, type ProposedUpdate } from '../lib/api'
import { useScenarioStore } from '../store/useScenarioStore'

const KIND_LABEL: Record<ProposedUpdate['kind'], string> = {
  sector_vulnerability: 'Sector physical vulnerability',
  transition_sensitivity: 'Sector transition sensitivity',
  scenario_archetype: 'Scenario archetype',
  other: 'Other assumption',
}

const STATUS_COLOR: Record<ProposedUpdate['status'], string> = {
  pending: 'border-risk-med/40 bg-risk-med/10 text-risk-med',
  approved: 'border-risk-low/40 bg-risk-low/10 text-risk-low',
  rejected: 'border-risk-high/40 bg-risk-high/10 text-risk-high',
}

function NewProposalForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<ProposedUpdate['kind']>('sector_vulnerability')
  const [target, setTarget] = useState('')
  const [currentValue, setCurrentValue] = useState('')
  const [proposedValue, setProposedValue] = useState('')
  const [rationale, setRationale] = useState('')
  const [proposedBy, setProposedBy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit() {
    if (!target.trim() || !proposedValue.trim() || !rationale.trim()) {
      setError('Target, proposed value and rationale are required.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await createProposal({
        kind,
        target: target.trim(),
        current_value: currentValue.trim(),
        proposed_value: proposedValue.trim(),
        rationale: rationale.trim(),
        proposed_by: proposedBy.trim(),
      })
      setTarget('')
      setCurrentValue('')
      setProposedValue('')
      setRationale('')
      setOpen(false)
      onCreated()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the CLIMATRIX backend.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20"
      >
        <Plus size={12} /> PROPOSE AN UPDATE
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-cyan/30 bg-panel-2 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-mono text-[10px] tracking-[0.15em] text-cyan">NEW PROPOSAL</div>
        <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 text-[10px] text-slate-500 sm:col-span-1">
          Kind
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ProposedUpdate['kind'])}
            className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-[11.5px] text-slate-200 focus:border-cyan/50 focus:outline-none"
          >
            {(Object.keys(KIND_LABEL) as ProposedUpdate['kind'][]).map((k) => (
              <option key={k} value={k}>
                {KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </label>
        <label className="col-span-2 text-[10px] text-slate-500 sm:col-span-1">
          Target (e.g. sector name)
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Tourism"
            className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
          />
        </label>
        <label className="text-[10px] text-slate-500">
          Current value
          <input
            value={currentValue}
            onChange={(e) => setCurrentValue(e.target.value)}
            placeholder="1.45"
            className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
          />
        </label>
        <label className="text-[10px] text-slate-500">
          Proposed value
          <input
            value={proposedValue}
            onChange={(e) => setProposedValue(e.target.value)}
            placeholder="1.6"
            className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
          />
        </label>
        <label className="col-span-2 text-[10px] text-slate-500">
          Rationale
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
            placeholder="Why should this change?"
            className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
          />
        </label>
        <label className="col-span-2 text-[10px] text-slate-500 sm:col-span-1">
          Proposed by (free text — no auth yet)
          <input
            value={proposedBy}
            onChange={(e) => setProposedBy(e.target.value)}
            placeholder="Risk Analyst"
            className="mt-1 w-full rounded border border-line bg-panel px-2 py-1.5 text-[11.5px] text-slate-200 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
          />
        </label>
      </div>
      {error && <p className="mt-2 text-[10.5px] text-risk-high">{error}</p>}
      <div className="mt-3 flex justify-end">
        <button
          onClick={submit}
          disabled={submitting}
          className="rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10.5px] tracking-wide text-cyan hover:bg-cyan/20 disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit proposal'}
        </button>
      </div>
    </div>
  )
}

function ActionButton({ label, icon, done, onClick }: { label: string; icon: ReactNode; done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 font-mono text-[10px] tracking-wide ${
        done ? 'border-risk-low/40 bg-risk-low/10 text-risk-low' : 'border-line bg-panel text-slate-400 hover:border-cyan/40 hover:text-cyan'
      }`}
    >
      {done ? <Check size={12} /> : icon} {done ? 'DONE' : label}
    </button>
  )
}

function GriidBridgePanel({ proposals }: { proposals: ProposedUpdate[] }) {
  const state = useScenarioStore()
  const setRegion = useScenarioStore((s) => s.setRegion)
  const setHazard = useScenarioStore((s) => s.setHazard)
  const setSeverity = useScenarioStore((s) => s.setSeverity)
  const setDuration = useScenarioStore((s) => s.setDuration)
  const setSubstitutability = useScenarioStore((s) => s.setSubstitutability)
  const setUserMode = useScenarioStore((s) => s.setUserMode)

  const [flash, setFlash] = useState<string | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [importResult, setImportResult] = useState<{ ok: boolean; message: string } | null>(null)

  function flashFor(key: string, ms = 1500) {
    setFlash(key)
    setTimeout(() => setFlash((f) => (f === key ? null : f)), ms)
  }

  async function run(key: string, action: () => void | Promise<boolean>) {
    const result = await action()
    if (result === false) return // clipboard denied — action already fell back or no-op'd
    flashFor(key)
  }

  function doImport() {
    const result = parseImportedContext(pasteText)
    if (!result.ok || !result.scenario) {
      setImportResult({ ok: false, message: result.error || 'Could not parse that as a CLIMATRIX context bundle.' })
      return
    }
    const s = result.scenario
    setRegion(s.region)
    setHazard(s.hazard)
    setSeverity(s.severity)
    setDuration(s.durationMonths)
    setSubstitutability(s.substitutability)
    setUserMode(s.userMode)
    const fpNote =
      result.fingerprintMatches === true
        ? ' Fingerprint matches — nothing drifted in transit.'
        : result.fingerprintMatches === false
          ? ' Fingerprint MISMATCH — this bundle may have been edited after export; verify the numbers before relying on them.'
          : ''
    setImportResult({ ok: true, message: `Restored ${s.region} · ${s.hazard} · severity ${s.severity}/100 · ${s.durationMonths}mo.${fpNote}` })
    setPasteText('')
  }

  return (
    <div className="max-w-2xl rounded-lg border border-cyan/30 bg-panel-2 p-4">
      <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-cyan">
        <Share2 size={12} /> GRIID BRIDGE — PORTABLE, FINGERPRINTED CONTEXT HANDOFF
      </div>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-400">
        A public griid.ai API could not be confirmed to exist, so this implements the pattern directly: export the
        live scenario (or the approved assumption ledger below) as a fingerprinted bundle for ChatGPT, Claude, Griid
        or any AI workspace, then paste a bundle back in — yours or a teammate's — to restore it exactly, with
        the fingerprint re-checked for drift.
      </p>

      <div className="mb-3 flex flex-wrap gap-2">
        <ActionButton label="COPY TEXT" icon={<Clipboard size={12} />} done={flash === 'text'} onClick={() => run('text', () => copyContextBundle(state))} />
        <ActionButton label="COPY JSON" icon={<Clipboard size={12} />} done={flash === 'json'} onClick={() => run('json', () => copyContextBundleJSON(state))} />
        <ActionButton label="COPY LINK" icon={<Link2 size={12} />} done={flash === 'link'} onClick={() => run('link', () => copyShareableLink(state))} />
        <ActionButton label=".MD FILE" icon={<Download size={12} />} done={flash === 'md'} onClick={() => run('md', () => downloadContextBundle(state))} />
        <ActionButton label=".JSON FILE" icon={<Download size={12} />} done={flash === 'jsonfile'} onClick={() => run('jsonfile', () => downloadContextBundleJSON(state))} />
      </div>

      <div className="mb-3 border-t border-line pt-3">
        <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.15em] text-slate-500">INSTITUTIONAL LEDGER (APPROVED ASSUMPTIONS ONLY)</div>
        <div className="flex flex-wrap gap-2">
          <ActionButton label="COPY LEDGER" icon={<Clipboard size={12} />} done={flash === 'ledger'} onClick={() => run('ledger', () => copyGovernanceBundle(proposals))} />
          <ActionButton label="DOWNLOAD LEDGER" icon={<Download size={12} />} done={flash === 'ledgerfile'} onClick={() => run('ledgerfile', () => downloadGovernanceBundle(proposals))} />
        </div>
      </div>

      <div className="border-t border-line pt-3">
        <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.15em] text-slate-500">IMPORT A CONTEXT BUNDLE</div>
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={3}
          placeholder="Paste a CLIMATRIX text bundle, JSON export, or shareable link (from here, a teammate, or an AI workspace you pasted it into and back)…"
          className="w-full rounded border border-line bg-panel px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={doImport}
            disabled={!pasteText.trim()}
            className="rounded border border-cyan/40 bg-cyan/10 px-3 py-1.5 font-mono text-[10px] tracking-wide text-cyan hover:bg-cyan/20 disabled:opacity-40"
          >
            IMPORT INTO CURRENT SCENARIO
          </button>
        </div>
        {importResult && (
          <p className={`mt-2 text-[10.5px] leading-relaxed ${importResult.ok ? 'text-risk-low' : 'text-risk-high'}`}>{importResult.message}</p>
        )}
      </div>
    </div>
  )
}

export default function GovernancePage() {
  const [proposals, setProposals] = useState<ProposedUpdate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reviewerName, setReviewerName] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setProposals(await listProposals())
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the CLIMATRIX backend.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function act(id: string, action: 'approve' | 'reject') {
    try {
      await reviewProposal(id, action, reviewerName.trim() || 'Anonymous reviewer')
      load()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reach the CLIMATRIX backend.')
    }
  }

  const pending = proposals.filter((p) => p.status === 'pending')
  const reviewed = proposals.filter((p) => p.status !== 'pending')

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <PageHeader
        title="GOVERNANCE & PROPOSALS"
        subtitle="GRIID-PATTERN: SHARED ASSUMPTIONS, REVIEWED BEFORE THEY BECOME INSTITUTIONAL MEMORY"
        tag={`${pending.length} pending`}
      />
      <div className="bg-grid space-y-5 p-6">
        <div className="max-w-2xl rounded-lg border border-line bg-panel-2 p-4">
          <div className="mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-[0.15em] text-slate-500">
            <ClipboardCheck size={12} className="text-cyan" /> HOW THIS WORKS
          </div>
          <p className="text-[11.5px] leading-relaxed text-slate-400">
            A disclosed modelling assumption — a sector's physical-vulnerability or transition-sensitivity multiplier, a
            new scenario archetype — is proposed here with a rationale, never changed live. A reviewer approves or
            rejects it. Approving does not automatically rewrite the targeted constant in the codebase; this is the
            review gate and audit trail, a deliberate scope boundary (a live-reloaded config system is real future
            work, not pretended here).
          </p>
        </div>

        <GriidBridgePanel proposals={proposals} />

        <div className="flex items-center gap-3">
          <NewProposalForm onCreated={load} />
          <input
            value={reviewerName}
            onChange={(e) => setReviewerName(e.target.value)}
            placeholder="Your name (for review actions)…"
            className="rounded border border-line bg-panel-2 px-2.5 py-1.5 text-[11px] text-slate-300 placeholder:text-slate-600 focus:border-cyan/50 focus:outline-none"
          />
        </div>

        {error && <p className="text-[11px] text-risk-high">{error}</p>}
        {loading && <p className="text-[11px] text-slate-500">Loading…</p>}

        {!loading && (
          <>
            <div>
              <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">PENDING ({pending.length})</div>
              {pending.length === 0 ? (
                <p className="text-[11px] text-slate-600">No pending proposals.</p>
              ) : (
                <div className="space-y-2">
                  {pending.map((p) => (
                    <div key={p.id} className="rounded border border-line bg-panel-2 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[8px] tracking-wide ${STATUS_COLOR[p.status]}`}>{p.status.toUpperCase()}</span>
                            <span className="font-mono text-[9.5px] text-slate-500">{KIND_LABEL[p.kind]}</span>
                          </div>
                          <div className="mt-1 text-[12.5px] font-medium text-slate-200">
                            {p.target}: <span className="text-slate-500">{p.current_value || '—'}</span> → <span className="text-cyan">{p.proposed_value}</span>
                          </div>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{p.rationale}</p>
                          <div className="mt-1 font-mono text-[9.5px] text-slate-600">
                            Proposed by {p.proposed_by || 'Anonymous'} · {new Date(p.created_at).toLocaleString()}
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-1.5">
                          <button onClick={() => act(p.id, 'approve')} className="flex items-center gap-1 rounded border border-risk-low/40 bg-risk-low/10 px-2 py-1 font-mono text-[9.5px] text-risk-low hover:bg-risk-low/20">
                            <Check size={11} /> Approve
                          </button>
                          <button onClick={() => act(p.id, 'reject')} className="flex items-center gap-1 rounded border border-risk-high/40 bg-risk-high/10 px-2 py-1 font-mono text-[9.5px] text-risk-high hover:bg-risk-high/20">
                            <X size={11} /> Reject
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {reviewed.length > 0 && (
              <div>
                <div className="mb-2 font-mono text-[10px] tracking-[0.15em] text-slate-500">REVIEWED ({reviewed.length})</div>
                <div className="space-y-2">
                  {reviewed.map((p) => (
                    <div key={p.id} className="rounded border border-line bg-panel-2/50 p-3 opacity-80">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full border px-1.5 py-0.5 font-mono text-[8px] tracking-wide ${STATUS_COLOR[p.status]}`}>{p.status.toUpperCase()}</span>
                        <span className="text-[12px] text-slate-300">
                          {p.target}: {p.current_value || '—'} → {p.proposed_value}
                        </span>
                      </div>
                      <div className="mt-1 font-mono text-[9.5px] text-slate-600">
                        {p.reviewer && `Reviewed by ${p.reviewer}`}
                        {p.reviewed_at && ` · ${new Date(p.reviewed_at).toLocaleString()}`}
                        {p.review_note && ` — "${p.review_note}"`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
