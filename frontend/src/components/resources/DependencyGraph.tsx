import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { DependencyGraph as DependencyGraphData } from '../../api/resources'

interface Props {
  data: DependencyGraphData
  onNodeClick?: (nodeId: string) => void
}

const nodeColors: Record<string, string> = {
  user: '#4CAF50',
  group: '#2196F3',
  role: '#FF9800',
  policy: '#9C27B0',
  role_definition: '#9C27B0',
  principal: '#4CAF50',
}

export default function DependencyGraph({ data, onNodeClick }: Props) {
  const initialNodes: Node[] = useMemo(() => {
    return data.nodes.map((node, index) => ({
      id: node.id,
      data: { label: node.name, nodeType: node.node_type },
      position: { x: (index % 5) * 200, y: Math.floor(index / 5) * 100 },
      style: {
        backgroundColor: nodeColors[node.node_type] || '#666',
        color: 'white',
        padding: '10px',
        borderRadius: '8px',
        border: '2px solid #333',
      },
    }))
  }, [data.nodes])

  const initialEdges: Edge[] = useMemo(() => {
    return data.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#666' },
    }))
  }, [data.edges])

  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeClick?.(node.id)
    },
    [onNodeClick]
  )

  return (
    <div>
      <div style={{ width: '100%', height: '500px' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {/* 凡例 */}
      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
        {Object.entries(nodeColors).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <div
              style={{
                width: '16px',
                height: '16px',
                backgroundColor: color,
                borderRadius: '4px',
              }}
            />
            <span style={{ fontSize: '0.875rem' }}>{type}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
