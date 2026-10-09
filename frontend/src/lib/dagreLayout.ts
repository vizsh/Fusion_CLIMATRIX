import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'
import { NODES, type GNode } from './indiaGraphData'

const NODE_WIDTH = 192
const NODE_HEIGHT = 58

// Dagre infers left-to-right ranks purely from edge direction — our dataset
// is a consistent DAG (hazard -> infra -> supplier -> company -> capital,
// plus same-direction skip edges), so no manual rank hints are needed.
export function layoutGraph(
  nodes: GNode[],
  edges: { id: string; from: string; to: string }[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 18, ranksep: 150, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const e of edges) {
    g.setEdge(e.from, e.to)
  }

  dagre.layout(g)

  const rfNodes: Node[] = nodes.map((n) => {
    const pos = g.node(n.id)
    return {
      id: n.id,
      type: 'ind',
      position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
      data: { gnode: n },
      draggable: true,
    }
  })

  return { nodes: rfNodes, edges: [] }
}

export { NODES }
