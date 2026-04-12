export interface ConductorEvent {
  v: number;
  ts: string;
  run_id?: string;
  repo?: string;
  issue?: number;
  persona?: string;
  event: string;
  data: any;
}
