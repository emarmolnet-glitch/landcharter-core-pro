/**
 * Módulo de Tiempos de Conducción y Tacógrafo (Reglamento CE 561/2006)
 *
 * Algoritmo matemático para cálculo de tiempos de tránsito y descansos obligatorios:
 * - horas_conduccion_pura = distancia_total / velocidad_media
 * - pausas_45m = Math.floor(horas_conduccion_pura / 4.5) (45 min pausa cada 4.5h)
 * - horas_de_pausa = pausas_45m * 0.75
 * - jornadas_laborales = Math.ceil(horas_conduccion_pura / 9) (Máx 9h conducción diaria)
 * - descansos_diarios_horas = jornadas_laborales > 1 ? (jornadas_laborales - 1) * 11 : 0 (11h descanso entre jornadas)
 * - tiempo_total_transito = horas_conduccion_pura + horas_de_pausa + descansos_diarios_horas
 */

export function calculateTachographAlgorithm(distancia_total = 0, velocidad_media = 80) {
  const dist = Number(distancia_total) > 0 ? Number(distancia_total) : 0;
  const speed = Number(velocidad_media) > 0 ? Number(velocidad_media) : 80;

  const horas_conduccion_pura = (dist > 0 && speed > 0) ? (dist / speed) : 0;
  const pausas_45m = Math.floor(horas_conduccion_pura / 4.5);
  const horas_de_pausa = pausas_45m * 0.75;
  const jornadas_laborales = Math.ceil(horas_conduccion_pura / 9);
  const descansos_diarios_horas = jornadas_laborales > 1 ? (jornadas_laborales - 1) * 11 : 0;
  const tiempo_total_transito = horas_conduccion_pura + horas_de_pausa + descansos_diarios_horas;
  const tiempo_total_dias = tiempo_total_transito > 0 ? (tiempo_total_transito / 24) : 0;

  return {
    distancia_total: dist,
    velocidad_media: speed,
    horas_conduccion_pura,
    pausas_45m,
    horas_de_pausa,
    jornadas_laborales,
    descansos_diarios_horas,
    tiempo_total_transito,
    tiempo_total_dias
  };
}

/**
 * Hook para componentes React
 */
export function useTachographTimes({ distance = 0, speed = 80 } = {}) {
  return calculateTachographAlgorithm(distance, speed);
}

// Compatibilidad con entorno navegador
if (typeof window !== 'undefined') {
  window.calculateTachographAlgorithm = calculateTachographAlgorithm;
  window.useTachographTimes = useTachographTimes;
}

export default {
  calculateTachographAlgorithm,
  useTachographTimes
};
