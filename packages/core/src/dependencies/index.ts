export type DepType = "REQUIRES" | "RECOMMENDS" | "ENHANCES" | "CONFLICTS";

export interface DependencyEdge {
  fromId: string;
  toId: string;
  type: DepType;
}

export function resolveDependencies(
  selected: string[],
  edges: DependencyEdge[],
): { required: string[]; recommended: string[]; conflicts: string[] } {
  const required: string[] = [];
  const recommended: string[] = [];
  const conflicts: string[] = [];

  for (const edge of edges) {
    if (!selected.includes(edge.fromId)) continue;
    if (edge.type === "REQUIRES" && !selected.includes(edge.toId)) {
      required.push(edge.toId);
    } else if (edge.type === "RECOMMENDS" && !selected.includes(edge.toId)) {
      recommended.push(edge.toId);
    } else if (edge.type === "CONFLICTS" && selected.includes(edge.toId)) {
      conflicts.push(edge.toId);
    }
  }

  return { required, recommended, conflicts };
}
