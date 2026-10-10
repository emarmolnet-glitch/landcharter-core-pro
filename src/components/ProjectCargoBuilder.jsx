import React from 'react';
import ForwarderWorkspace from './ForwarderWorkspace.jsx';

/**
 * ProjectCargoBuilder (Proyectos)
 * Componente que expone el constructor de servicios y carga de proyectos,
 * sincronizado de solo lectura con el estado global de ruta (currentRoute)
 * y detección geográfica de unidades (mi/km, USD/EUR).
 */
export function ProjectCargoBuilder({ unit = (typeof window !== 'undefined' ? (window.currentRoute?.unit || window.State?.currentRoute?.unit || 'km') : 'km'), ...props } = {}) {
  return <ForwarderWorkspace unit={unit} {...props} />;
}

export { ForwarderWorkspace };
export default ProjectCargoBuilder;
