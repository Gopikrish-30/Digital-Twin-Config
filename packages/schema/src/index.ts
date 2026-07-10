export type Vec3 = [number, number, number];

// The reusable "catalog" item — a GLB plus its default schema. Not tied to any one client.
// Mirrors Project-documentation.md §3.
export interface ParamSpec {
  key: string;
  label: string;
  unit: string;
}

export interface AssetDefinition {
  id: string;
  name: string;
  category: string;
  glbUrl: string;
  defaultParams: ParamSpec[];
}

// A specific placed copy inside one client's twin. References a definition, but owns
// its own name, position, department, and parameter overrides.
export interface Transform {
  position: Vec3;
  rotation: number;
  scale: number;
}

export interface AssetInstance {
  id: string;
  definitionId: string;
  tenantId: string;
  customName: string;
  department: string;
  transform: Transform;
  paramOverrides: Record<string, string | number | boolean>;
}

// Connects one asset instance's parameter to a live data source, plus alarm rules.
export interface AlarmRules {
  min?: number;
  max?: number;
  severity: "info" | "warning" | "critical";
}

export interface ParameterBinding {
  instanceId: string;
  paramKey: string;
  sourceTopic: string;
  unit: string;
  alarmRules?: AlarmRules;
}

// A local (or eventually published) draft: everything the configurator edits together.
export interface TwinDraft {
  tenantId: string;
  instances: AssetInstance[];
  bindings: ParameterBinding[];
  updatedAt: string;
}
