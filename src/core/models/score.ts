export type ScoreStatus = 'not_started' | 'running' | 'finished' | 'dnf';

export interface ScoreAttempt {
  at: number;        // timestamp
  loadKg?: number;   // carga probada (para for_load)
  success?: boolean; // acierto o fallo, opcional
}

export interface Score {
  id: string;
  wodId: string;
  wodName: string;
  scoringMode: 'time' | 'reps' | 'load';

  teamId: string;
  teamName: string;
  category: 'RX' | 'Intermedio';

  status: ScoreStatus;

  // Métricas genéricas (sirven para cualquier WOD)
  reps: number;          // reps válidas
  noReps: number;        // no-reps
  maxLoadKg?: number | null; // mejor carga
  attempts?: ScoreAttempt[]; // historial de intentos (for_load)

  // Tiempo
  startedAt?: number | null;   // epoch ms
  finalTimeMs?: number | null; // tiempo total al terminar
  capSeconds?: number | null;  // cap opcional

  // Campos denormalizados para ordenar (ascendente)
  // - Para 'time'  -> rankPrimary = finalTimeMs (DNF -> capMs + penalty)
  // - Para 'reps'  -> rankPrimary = -reps (más reps => menor valor)
  // - Para 'load'  -> rankPrimary = -(maxLoadKg*1000 + reps) (carga > reps)
  rankPrimary: number;
  rankSecondary: number;

  createdAt: number;
  updatedAt: number;
  judgeId?: string;
}
