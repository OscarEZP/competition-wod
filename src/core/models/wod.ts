export type Category = 'RX' | 'Intermedio';

export type WodType =
  | 'amrap'
  | 'for_time'
  | 'emom'
  | 'interval'      // on-off
  | 'for_load'      // lift / load
  | 'chipper'
  | 'tabata'
  | 'benchmark';

export type ScoringMode = 'time' | 'reps' | 'load';

/** Movimiento / ejercicio editable por admin */
export interface MovementSpec {
  name: string;          // p.ej. "DB Snatch", "Thruster", "Burpee"
  reps?: number | null;  // repeticiones por serie/bloque
  loadKg?: number | null;
  notes?: string;        // notas, standards, ROM, etc.
}

/** Bloques por tipo (estructura específica y extensible) */
export interface AmrapBlock {
  type: 'amrap';
  minutes: number;             // duración total
  movements: MovementSpec[];   // lista de ejercicios con reps
  scoring?: 'reps';            // (deriva a reps)
}

export interface ForTimeBlock {
  type: 'for_time';
  capSeconds?: number | null;  // cap opcional
  movements: MovementSpec[];   // trabajo a completar (total reps)
  scoring?: 'time';
}

export interface EmomBlock {
  type: 'emom';
  minutes: number;             // duración total
  perMinute: MovementSpec[];   // qué se hace cada minuto
  scoring?: 'reps' | 'duration';
}

export interface IntervalBlock {
  type: 'interval';            // on-off
  workSeconds: number;         // trabajo
  restSeconds: number;         // descanso
  rounds: number;              // nº de intervalos
  movements: MovementSpec[];   // por intervalo
  scoring?: 'reps' | 'rounds' | 'time_avg';
}

export interface LoadBlock {
  type: 'for_load';
  liftType: string;            // p.ej. "Clean & Jerk", "Back Squat"
  attempts?: number | null;    // nº de intentos
  minLoadKg?: number | null;
  stepLoadKg?: number | null;
  scoring?: 'load' | 'load_total'; // peso máximo o suma
}

export interface ChipperBlock {
  type: 'chipper';
  movements: MovementSpec[];   // secuencia larga sin repetir
  capSeconds?: number | null;
  scoring?: 'time' | 'reps';
}

export interface TabataBlock {
  type: 'tabata';
  workSeconds: number;         // típicamente 20
  restSeconds: number;         // típicamente 10
  rounds: number;              // típicamente 8
  movements: MovementSpec[];   // puede ser 1 o varios
  scoring?: 'reps' | 'reps_avg';
}

export interface BenchmarkBlock {
  type: 'benchmark';
  name: string;                // "Fran", "Murph", etc.
  reference?: string;          // link o notas
  movements: MovementSpec[];   // editable
  capSeconds?: number | null;
  scoring?: 'time' | 'reps' | 'load';
}

export type WodBlock =
  | AmrapBlock
  | ForTimeBlock
  | EmomBlock
  | IntervalBlock
  | LoadBlock
  | ChipperBlock
  | TabataBlock
  | BenchmarkBlock;

export interface Wod {
  id: string;
  name: string;
  description?: string;
  category: Category;
  // El modo de scoring principal del WOD (puede derivarse de los bloques).
  scoringMode: ScoringMode;
  // Lista de bloques (puede ser 1 o varios; p.ej. calentamiento + wod principal, o partes A/B).
  blocks: WodBlock[];
  movementUnit?: 'kg' | 'lb' | 'reps'; // preferencia de visualización (UI)
  createdAt: number;
  createdBy: string;
}
