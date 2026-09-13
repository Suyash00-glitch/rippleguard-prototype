import { describe, it, expect } from 'vitest';
import { DependencyGraph } from '../src/graph/dependency-graph.js';

describe('Dependency Graph & Blast Radius Engine', () => {
  it('constructs canonical DAG and enforces A -> B ("A depends on B") semantics', () => {
    const graph = new DependencyGraph('App');

    // Add nodes
    graph.addNode({ id: 'pkg-a', name: 'pkg-a', version: '1.0.0', ecosystem: 'npm', isDirect: true, depth: 1 });
    graph.addNode({ id: 'pkg-b', name: 'pkg-b', version: '1.2.0', ecosystem: 'npm', isDirect: true, depth: 1 });
    graph.addNode({ id: 'pkg-c', name: 'pkg-c', version: '2.1.0', ecosystem: 'npm', isDirect: false, depth: 2 });
    graph.addNode({ id: 'pkg-d', name: 'pkg-d', version: '2.0.1', ecosystem: 'npm', isDirect: true, depth: 1 });
    graph.addNode({ id: 'pkg-e', name: 'pkg-e', version: '1.0.0', ecosystem: 'npm', isDirect: false, depth: 2 });

    // Add edges
    // App -> A, App -> B, App -> D
    graph.addEdge('App', 'pkg-a');
    graph.addEdge('App', 'pkg-b');
    graph.addEdge('App', 'pkg-d');

    // A -> C ("A depends on C")
    graph.addEdge('pkg-a', 'pkg-c');
    // B -> C ("B depends on C")
    graph.addEdge('pkg-b', 'pkg-c');

    // D -> E ("D depends on E")
    graph.addEdge('pkg-d', 'pkg-e');

    // 1. Node deduplication: C is represented only once
    const allNodes = graph.getAllNodes();
    expect(allNodes.filter(n => n.id === 'pkg-c').length).toBe(1);

    // 2. Metrics calculation
    const metrics = graph.calculateAllMetrics();

    const metricC = metrics.get('pkg-c')!;
    expect(metricC).toBeDefined();

    // In-degree for C: packages directly depending on C (pkg-a and pkg-b)
    expect(metricC.inDegree).toBe(2);
    expect(metricC.directDependents.sort()).toEqual(['pkg-a', 'pkg-b'].sort());

    // Transitive dependents of C: includes pkg-a, pkg-b, and App
    expect(metricC.transitiveDependents).toContain('pkg-a');
    expect(metricC.transitiveDependents).toContain('pkg-b');
    expect(metricC.transitiveDependents).toContain('App');

    // Depth of C from App
    expect(metricC.depth).toBe(2);

    // Number of paths from root App to C: exactly 2 (App->A->C and App->B->C)
    expect(metricC.downstreamPathsCount).toBe(2);

    // Compare blast radius score of shared package C vs single package E
    const metricE = metrics.get('pkg-e')!;
    expect(metricE.inDegree).toBe(1); // only D depends on E
    expect(metricC.blastRadiusScore).toBeGreaterThan(metricE.blastRadiusScore);
  });
});
