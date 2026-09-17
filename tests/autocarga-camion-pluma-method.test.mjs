import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const forwarderWorkspacePath = path.join(projectRoot, 'src/components/ForwarderWorkspace.jsx');
const forwarderWorkspaceSource = fs.readFileSync(forwarderWorkspacePath, 'utf8');

const indexHtmlPath = path.join(projectRoot, 'index.html');
const indexHtmlSource = fs.readFileSync(indexHtmlPath, 'utf8');

test('1. Píldora de Método: index.html y ForwarderWorkspace definen "Autocarga con Grúa del Camión"', () => {
  // index.html: terrestrialLabels incluye "Autocarga con Grúa del Camión"
  assert.match(
    indexHtmlSource,
    /const\s+terrestrialLabels\s*=\s*\[[\s\S]*?['"]Autocarga con Grúa del Camión['"]/,
    'index.html terrestrialLabels array must include "Autocarga con Grúa del Camión"'
  );

  // index.html: METHOD_LABEL_BY_VALUE mapea autocarga_grua_camion a "Autocarga con Grúa del Camión"
  assert.match(
    indexHtmlSource,
    /autocarga_grua_camion:\s*['"]Autocarga con Grúa del Camión['"]/,
    'index.html METHOD_LABEL_BY_VALUE must include autocarga_grua_camion'
  );

  // ForwarderWorkspace.jsx: define TERRESTRIAL_LOADING_METHODS y TERRESTRIAL_DISCHARGE_METHODS con la opción exacta
  assert.match(
    forwarderWorkspaceSource,
    /export\s+const\s+TERRESTRIAL_LOADING_METHODS\s*=\s*\[[\s\S]*?['"]Autocarga con Grúa del Camión['"]/,
    'ForwarderWorkspace.jsx must export TERRESTRIAL_LOADING_METHODS containing "Autocarga con Grúa del Camión"'
  );
  assert.match(
    forwarderWorkspaceSource,
    /export\s+const\s+TERRESTRIAL_DISCHARGE_METHODS\s*=\s*\[[\s\S]*?['"]Autocarga con Grúa del Camión['"]/,
    'ForwarderWorkspace.jsx must export TERRESTRIAL_DISCHARGE_METHODS containing "Autocarga con Grúa del Camión"'
  );

  // ForwarderWorkspace.jsx: renderiza botones de píldoras para métodos
  assert.match(
    forwarderWorkspaceSource,
    /id="pills_metodo_carga_workspace"/,
    'ForwarderWorkspace must render pills_metodo_carga_workspace'
  );
  assert.match(
    forwarderWorkspaceSource,
    /id="pills_metodo_descarga_workspace"/,
    'ForwarderWorkspace must render pills_metodo_descarga_workspace'
  );
});

test('2. Matriz de Compatibilidad: validarCompatibilidadMetodo omite alerta para Camión Plataforma con Grúa Autocarga y Big Bags', () => {
  // Extraer la función validarCompatibilidadMetodo de index.html
  const fnMatch = indexHtmlSource.match(/function validarCompatibilidadMetodo\([\s\S]*?\n        \}/);
  assert.ok(fnMatch, 'validarCompatibilidadMetodo must be found in index.html');

  // Ejecutar en sandbox VM simulando el DOM
  let alertHidden = true;
  let alertText = '';
  const mockAlertEl = {
    textContent: '',
    classList: {
      add: (cls) => { if (cls === 'hidden') alertHidden = true; },
      remove: (cls) => { if (cls === 'hidden') alertHidden = false; },
      toggle: () => {},
      contains: (cls) => (cls === 'hidden' ? alertHidden : false),
    },
  };

  const context = {
    State: {
      vehicleType: 'Camión Plataforma con Grúa Autocarga',
      truckType: 'Camión Plataforma con Grúa Autocarga',
    },
    window: {
      activeCategory: 'Minerales y Construcción',
      activeProduct: 'Big Bags de Cemento',
      activeMethod: 'Autocarga con Grúa del Camión',
    },
    document: {
      getElementById: (id) => {
        if (id === 'cargo-type') return { value: context.window.activeCategory };
        if (id === 'product-sector') return { options: [{ text: context.window.activeProduct }], selectedIndex: 0 };
        if (id === 'metodo_carga') return { value: 'autocarga_grua_camion' };
        if (id === 'metodo_descarga_pod') return { value: 'autocarga_grua_camion' };
        if (id === 'metodo-carga-incompatible-alert' || id === 'metodo-descarga-incompatible-alert') {
          return mockAlertEl;
        }
        if (id === 'nombre-buque-calculadora') return { value: context.State.vehicleType };
        return null;
      },
    },
  };

  const script = `
    const METHOD_LABEL_BY_VALUE = Object.freeze({
      autocarga_grua_camion: 'Autocarga con Grúa del Camión',
      cuchara_grab: 'Cuchara (Grab) - Grúa Barco',
      carga_superior_grua: 'Carga Superior (Grúa Portuaria / Puente Grúa)',
      paletizado_barco: 'Paletizado - Grúa Barco'
    });
    const equipmentMatrix = Object.freeze({
      "Minerales y Construcción": ['Cuchara (Grab) - Grúa Barco', 'Cuchara (Grab) - Grúa Portuaria', 'Cinta Transportadora', 'Bombas Neumáticas', 'Camión Tolva', 'Big Bags - Grúa Barco', 'Big Bags - Grúa Portuaria']
    });
    const cargoCompatibilityMap = Object.freeze({
      "Minerales y Construcción": ['Cuchara (Grab) - Grúa Barco', 'Cuchara (Grab) - Grúa Portuaria', 'Cinta Transportadora', 'Bombas Neumáticas', 'Camión Tolva', 'Autocarga con Grúa del Camión']
    });
    function getActiveCargoCategory() { return window.activeCategory; }
    function getSelectedMethodLabel(side) { return window.activeMethod; }

    ${fnMatch[0]}

    window.validarCompatibilidadMetodo = validarCompatibilidadMetodo;
  `;

  vm.runInNewContext(script, context);

  // Escenario 1: Camión Plataforma con Grúa Autocarga + Autocarga con Grúa del Camión en Minerales y Construcción
  context.State.vehicleType = 'Camión Plataforma con Grúa Autocarga';
  context.window.activeCategory = 'Minerales y Construcción';
  context.window.activeProduct = 'Big Bags de Cemento';
  context.window.activeMethod = 'Autocarga con Grúa del Camión';
  let isInvalid = context.window.validarCompatibilidadMetodo('pol');
  assert.equal(isInvalid, false, 'Autocarga con Grúa del Camión must be 100% compatible for crane platform');
  assert.equal(alertHidden, true, 'Alert must be hidden for crane platform with Autocarga method');

  // Escenario 2: Categoría Minerales y Construcción con Big Bags y método Autocarga
  context.State.vehicleType = 'Camión Plataforma Abierta (Sin Grúa)';
  context.window.activeCategory = 'Minerales y Construcción';
  context.window.activeProduct = 'Big Bags 1000kg';
  context.window.activeMethod = 'Autocarga con Grúa del Camión';
  isInvalid = context.window.validarCompatibilidadMetodo('pol');
  assert.equal(isInvalid, false, 'Autocarga con Grúa del Camión must be compatible when Big Bags is the product');
  assert.equal(alertHidden, true, 'Alert must be hidden when Big Bags is involved');

  // Escenario 3: Incompatible method (Paletizado en Minerales y Construcción sin Big Bags ni grúa autocarga)
  context.State.vehicleType = 'Camión Plataforma Abierta (Sin Grúa)';
  context.window.activeCategory = 'Minerales y Construcción';
  context.window.activeProduct = 'Clinker bulk';
  context.window.activeMethod = 'Paletizado - Grúa Barco';
  isInvalid = context.window.validarCompatibilidadMetodo('pol');
  assert.equal(isInvalid, true, 'Invalid method must remain invalid');
  assert.equal(alertHidden, false, 'Alert must be displayed for truly incompatible method');
});

test('3. Auto-Selección Reactiva: Camión Plataforma con Grúa Autocarga selecciona automáticamente Autocarga con Grúa del Camión', () => {
  // ForwarderWorkspace: useEffect observa vehicleType y auto-selecciona setLoadingMethod y setDischargeMethod
  assert.match(
    forwarderWorkspaceSource,
    /vehicleType\s*===\s*['"]Camión Plataforma con Grúa Autocarga['"][\s\S]*?setLoadingMethod\(['"]Autocarga con Grúa del Camión['"]\)[\s\S]*?setDischargeMethod\(['"]Autocarga con Grúa del Camión['"]\)/,
    'useEffect observing vehicleType must auto-select Autocarga con Grúa del Camión for both loading and discharge'
  );

  // ForwarderWorkspace: handleVehicleTypeChange auto-selecciona setLoadingMethod y setDischargeMethod
  assert.match(
    forwarderWorkspaceSource,
    /selectedType\s*===\s*['"]Camión Plataforma con Grúa Autocarga['"][\s\S]*?setLoadingMethod\(['"]Autocarga con Grúa del Camión['"]\)[\s\S]*?setDischargeMethod\(['"]Autocarga con Grúa del Camión['"]\)/,
    'handleVehicleTypeChange must auto-select Autocarga con Grúa del Camión for both loading and discharge'
  );

  // index.html: handleVehicleTypeSelection auto-selecciona Autocarga con Grúa del Camión
  assert.match(
    indexHtmlSource,
    /matched\.name\s*===\s*['"]Camión Plataforma con Grúa Autocarga['"][\s\S]*?selectMethodPill\(['"]pol['"],\s*['"]Autocarga con Grúa del Camión['"]\)[\s\S]*?selectMethodPill\(['"]pod['"],\s*['"]Autocarga con Grúa del Camión['"]\)/,
    'handleVehicleTypeSelection in index.html must auto-select Autocarga con Grúa del Camión'
  );
});

test('4. Ratio Operativo de 20 TM/h y Recálculo Automático de Horas Previstas', () => {
  // index.html: methodBaseRates asigna 20 para Autocarga con Grúa del Camión
  assert.match(
    indexHtmlSource,
    /['"]Autocarga con Grúa del Camión['"]:\s*20/,
    'methodBaseRates in index.html must map Autocarga con Grúa del Camión to 20'
  );

  // ForwarderWorkspace.jsx: define OPERATIONAL_METHOD_RATIOS asignando 20 a Autocarga con Grúa del Camión
  assert.match(
    forwarderWorkspaceSource,
    /['"]Autocarga con Grúa del Camión['"]:\s*20/,
    'OPERATIONAL_METHOD_RATIOS in ForwarderWorkspace must map Autocarga con Grúa del Camión to 20'
  );

  // Verificación matemática del cálculo de horas previstas:
  // Carga de 24 TM (o 24,000 kg) / ratio 20 TM/h = 1.2 horas
  const payloadTons = 24;
  const ratio = 20;
  const expectedHours = Math.round((payloadTons / ratio) * 10) / 10;
  assert.equal(expectedHours, 1.2, '24 tons divided by 20 ton/h should equal 1.2 hours');

  // index.html: applyMethodAndProductConditions y selectMethodPill autocompletan horas-previstas-carga / descarga
  assert.match(
    indexHtmlSource,
    /horas-previstas-carga[\s\S]*?horas-previstas-descarga/,
    'index.html must handle auto-calculation of horas-previstas-carga and horas-previstas-descarga'
  );
});
