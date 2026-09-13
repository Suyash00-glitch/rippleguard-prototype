import React, { useState, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Node,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomNode } from './CustomNode';
import { NodeDetailDrawer } from './NodeDetailDrawer';
import { FlowNodeData } from '../types';
import { GitGraph, Info } from 'lucide-react';

interface DependencyGraphViewProps {
  initialNodes: Array<{ id: string; type: string; data: FlowNodeData }>;
  initialEdges: Array<{ id: string; source: string; target: string; animated?: boolean }>;
  onSelectRemediate?: (packageName: string, fixedVersion: string) => void;
}

const nodeTypes = {
  dependency: CustomNode,
  root: CustomNode,
};

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = ({
  initialNodes,
  initialEdges,
  onSelectRemediate,
}) => {
  const [selectedNodeData, setSelectedNodeData] = useState<FlowNodeData | null>(null);

  const layoutedNodes: Node[] = useMemo(() => {
    const depthGroups: Record<number, typeof initialNodes> = {};
    for (const node of initialNodes) {
      const depth = node.data.depth || (node.data.isRoot ? 0 : 1);
      if (!depthGroups[depth]) depthGroups[depth] = [];
      depthGroups[depth].push(node);
    }

    const result: Node[] = [];
    const layerSpacingY = 170;
    const nodeWidth = 250;
    const horizontalGap = 60;

    Object.entries(depthGroups).forEach(([depthStr, nodesInDepth]) => {
      const depth = parseInt(depthStr);
      const totalWidth = nodesInDepth.length * (nodeWidth + horizontalGap);
      const startX = 450 - totalWidth / 2;

      nodesInDepth.forEach((node, index) => {
        result.push({
          id: node.id,
          type: node.type || 'dependency',
          position: {
            x: startX + index * (nodeWidth + horizontalGap),
            y: 40 + depth * layerSpacingY,
          },
          data: node.data,
        });
      });
    });

    return result;
  }, [initialNodes]);

  const [nodes, , onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(
    initialEdges.map(e => ({
      ...e,
      style: { stroke: '#94A3B8', strokeWidth: 2 },
      animated: true,
    }))
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeData(node.data as FlowNodeData);
  }, []);

  return (
    <div className="relative w-full h-[650px] rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
      {/* Legend */}
      <div className="absolute top-5 left-5 z-10 flex flex-col space-y-2">
        <div className="flex items-center space-x-2 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 shadow-sm">
          <GitGraph className="h-4 w-4 text-blue-600" />
          <span className="font-bold">Interactive Dependency Map</span>
        </div>

        <div className="flex items-center space-x-3 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-600 shadow-sm">
          <span className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-blue-600 mr-1.5" />
            Your App
          </span>
          <span className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-emerald-600 mr-1.5" />
            Clean Library
          </span>
          <span className="flex items-center">
            <span className="h-2 w-2 rounded-full bg-rose-600 mr-1.5" />
            Dangerous (Needs Fix)
          </span>
        </div>
      </div>

      {/* Helper Tip */}
      <div className="absolute bottom-5 left-5 z-10 bg-white/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center space-x-2 shadow-sm max-w-sm">
        <Info className="h-4 w-4 text-blue-600 shrink-0" />
        <span>Click any library to inspect its impact and available patches.</span>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.3}
        maxZoom={1.5}
      >
        <Background color="#CBD5E1" gap={24} size={1} variant={BackgroundVariant.Dots} />
        <Controls className="!bg-white !border !border-slate-200 !rounded-xl !overflow-hidden !shadow-sm" />
        <MiniMap
          nodeColor={(n: any) => {
            const risk = n.data?.effectiveRisk || 0;
            if (risk >= 70) return '#DC2626';
            if (risk > 0) return '#D97706';
            return '#16A34A';
          }}
          maskColor="rgba(248, 250, 252, 0.7)"
          className="!bg-white !border !border-slate-200 !rounded-xl !shadow-sm"
        />
      </ReactFlow>

      {/* Drawer */}
      <NodeDetailDrawer
        nodeData={selectedNodeData}
        onClose={() => setSelectedNodeData(null)}
        onSelectRemediate={onSelectRemediate}
      />
    </div>
  );
};
