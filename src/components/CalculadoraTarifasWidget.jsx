import React, { useState, useEffect, useRef } from 'react';
import './CalculadoraTarifasWidget.css';
import {
  DEFAULT_CURRENCIES,
  DEFAULT_TARIFF_COST_ITEMS,
  getDefaultCostItems,
  calculateFobTotal,
  calculateCommercialTotal
} from '../utils/calculadoraTarifasEngine.mjs';
import { getApiUrl } from '../utils/apiConfig.js';

export {
  DEFAULT_CURRENCIES,
  DEFAULT_TARIFF_COST_ITEMS,
  getDefaultCostItems,
  calculateFobTotal,
  calculateCommercialTotal
};

export default function CalculadoraTarifasWidget({
  isOpen = true,
  onClose,
  onApply,
  targetCurrency = 'EUR',
  initialCostes = null,
  initialDiscount = 0.85,
  initialCurrency = 'DZD',
  initialTarifas = []
}) {
  // 1. Estado dinámico de filas (precargado con la plantilla base)
  const [costes, setCostes] = useState(
    initialCostes || getDefaultCostItems()
  );

  // 2. Campo específico para el Factor de Descuento (Rabais, por defecto 0.85)
  const [factorDescuento, setFactorDescuento] = useState(
    initialDiscount !== undefined && initialDiscount !== null ? initialDiscount : 0.85
  );

  // 3. Estado de multidivisa y tipo de cambio
  const [monedaOrigen, setMonedaOrigen] = useState(initialCurrency || 'DZD');
  const [tipoCambio, setTipoCambio] = useState(() => {
    const found = DEFAULT_CURRENCIES.find(c => c.code === (initialCurrency || 'DZD'));
    return found ? found.defaultRateToEur : 0.0068;
  });

  // 4. CRÍTICO: Toggles de Modalidad Comercial y Convenio FSPE
  const [commercialModality, setCommercialModality] = useState('FOB'); // 'FOB' | 'EXW'
  const [useFspe, setUseFspe] = useState(true); // true = Con FSPE | false = Sin FSPE (Mercado)

  // 5. CRÍTICO: Array completo de tarifas/productos importados del Excel/PDF y producto seleccionado
  const [tarifasImportadas, setTarifasImportadas] = useState(initialTarifas || []);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');

  // 6. Estado de interfaz de escritorio (Draggable y Minimizada)
  // Posicionada a la IZQUIERDA (left: 24px) para no colisionar con el Agente de Proyectos
  const [isMinimized, setIsMinimized] = useState(false);
  const [position, setPosition] = useState({
    x: 24, // left-4 / 24px
    y: 85
  });
  const [isDragging, setIsDragging] = useState(false);
  const offsetRef = useRef({ x: 0, y: 0 });

  // 7. Estado de Carga / Spinner y Drag & Drop de archivos para la IA
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  // Sincronizar tasa por defecto al cambiar la moneda de origen si no ha sido editada manualmente
  const handleCurrencyChange = (newCode) => {
    setMonedaOrigen(newCode);
    const found = DEFAULT_CURRENCIES.find(c => c.code === newCode);
    if (found) {
      setTipoCambio(found.defaultRateToEur);
    }
  };

  // Lógica nativa de Arrastre (Draggable) de la ventana
  const handleMouseDown = (e) => {
    if (
      e.target.closest('.tariff-calc-controls') ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select')
    ) {
      return;
    }
    setIsDragging(true);
    offsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
  };

  const handleTouchStart = (e) => {
    if (
      e.target.closest('.tariff-calc-controls') ||
      e.target.closest('button') ||
      e.target.closest('input') ||
      e.target.closest('select')
    ) {
      return;
    }
    const touch = e.touches[0];
    if (!touch) return;
    setIsDragging(true);
    offsetRef.current = {
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    };
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const widgetWidth = isMinimized ? 380 : 540;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - widgetWidth, e.clientX - offsetRef.current.x)),
        y: Math.max(10, Math.min(window.innerHeight - 80, e.clientY - offsetRef.current.y))
      });
    };

    const handleTouchMove = (e) => {
      if (!isDragging) return;
      const touch = e.touches[0];
      if (!touch) return;
      const widgetWidth = isMinimized ? 380 : 540;
      setPosition({
        x: Math.max(10, Math.min(window.innerWidth - widgetWidth, touch.clientX - offsetRef.current.x)),
        y: Math.max(10, Math.min(window.innerHeight - 80, touch.clientY - offsetRef.current.y))
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleTouchMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, isMinimized]);

  // =========================================================================
  // LÓGICA ONCHANGE DEL SELECTOR DE PRODUCTOS (POBLAR DATOS AL SELECCIONAR)
  // =========================================================================
  const handleMaterialChange = (e) => {
    const newId = e?.target?.value || e;
    setSelectedMaterialId(newId);

    const selectedProduct = (tarifasImportadas || []).find(
      (item) => String(item.id) === String(newId) || String(item.Produit || item.name) === String(newId)
    );

    if (selectedProduct) {
      // 1. Aplicar descuento (Rabais) del producto seleccionado
      if (selectedProduct.rabais !== undefined && selectedProduct.rabais !== null) {
        setFactorDescuento(Number(selectedProduct.rabais));
      }

      // 2. Poblar las partidas dinámicas con los valores de ese producto
      if (Array.isArray(selectedProduct.lineItems) && selectedProduct.lineItems.length > 0) {
        const updatedCostes = selectedProduct.lineItems.map((item, idx) => ({
          id: `item-${Date.now()}-${idx}`,
          concepto: item.concepto,
          valorLocal: Number(item.valorLocal) || 0,
          isBasePrice: idx === 0 || /base|flete base|precio base/i.test(item.concepto || ''),
          isLocalCurrency: idx === 0 || /base|precio base/i.test(item.concepto || ''),
          isDirectInternational: idx > 0 && !/precio base/i.test(item.concepto || ''),
          isTransit: /transito|tránsito/i.test(item.concepto || ''),
          isPort: /portuario|puerto/i.test(item.concepto || ''),
          isInlandLogistics: /logistica|logística|inland/i.test(item.concepto || '')
        }));
        setCostes(updatedCostes);
      }
    }
  };

  // Toggle de FSPE: actualiza el valor de Logística Inland según sea FSPE o Mercado
  const handleToggleFspe = (newFspeState) => {
    setUseFspe(newFspeState);
    setCostes(prev => prev.map(item => {
      const isLogistics = item.isInlandLogistics || /logistica|logística|inland/i.test(item.concepto || '');
      if (isLogistics) {
        // Si tiene definidos valores específicos de FSPE vs Mercado, conmutar; si no, ajustar razonablemente
        const currentVal = Number(item.valorLocal) || 0;
        const fspeVal = item.logisticaFspeVal !== undefined ? item.logisticaFspeVal : (newFspeState ? Math.min(currentVal, 3.00) : currentVal);
        const mercadoVal = item.logisticaMercadoVal !== undefined ? item.logisticaMercadoVal : (!newFspeState ? Math.max(currentVal, 5.00) : currentVal);
        return {
          ...item,
          valorLocal: newFspeState ? (item.logisticaFspeVal ?? fspeVal) : (item.logisticaMercadoVal ?? mercadoVal)
        };
      }
      return item;
    }));
  };

  // ==========================================
  // PARSEO AUTOMÁTICO DE TARIFAS CON IA (BACKEND)
  // ==========================================
  const handleProcessTariffFile = async (file) => {
    if (!file) return;

    // Validación de extensiones permitidas: .xlsx, .csv, .pdf
    const lowerName = file.name.toLowerCase();
    const isValidExtension = lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.csv') || lowerName.endsWith('.pdf');
    if (!isValidExtension) {
      setUploadError("Formato no compatible. Por favor sube un archivo .xlsx, .csv o .pdf.");
      return;
    }

    setUploadError(null);
    setIsParsingFile(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);

      const endpointUrl = typeof getApiUrl === 'function' 
        ? getApiUrl('/.netlify/functions/parse-tariff')
        : '/.netlify/functions/parse-tariff';

      const response = await fetch(endpointUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error en el servidor de IA (${response.status})`);
      }

      const data = await response.json();

      // 1. ALMACENAR EL ARRAY COMPLETO DE TARIFAS IMPORTADAS
      let productsList = [];
      if (Array.isArray(data.tarifas) && data.tarifas.length > 0) {
        productsList = data.tarifas;
      } else if (Array.isArray(data.products) && data.products.length > 0) {
        productsList = data.products;
      } else if (Array.isArray(data.lineItems) && data.lineItems.length > 0) {
        productsList = [
          {
            id: `prod-1`,
            Produit: file.name.replace(/\.[^/.]+$/, ''),
            name: file.name.replace(/\.[^/.]+$/, ''),
            rabais: 0.85,
            lineItems: data.lineItems
          }
        ];
      }

      setTarifasImportadas(productsList);

      // 2. Seleccionar el primer producto por defecto y poblar la calculadora
      // CORRECCIÓN DIVISAS MIXTAS: Precio Base en moneda local (DZD), Envase/Logística/Tránsito/Puertos en USD/EUR directos
      if (productsList.length > 0) {
        const firstProd = productsList[0];
        setSelectedMaterialId(firstProd.id);

        if (firstProd.rabais !== undefined && firstProd.rabais !== null) {
          setFactorDescuento(Number(firstProd.rabais));
        }

        if (Array.isArray(firstProd.lineItems) && firstProd.lineItems.length > 0) {
          const initialProductCostes = firstProd.lineItems.map((item, idx) => ({
            id: `item-${Date.now()}-${idx}`,
            concepto: item.concepto || `Coste ${idx + 1}`,
            valorLocal: Number(item.valorLocal) || 0,
            isBasePrice: idx === 0 || /base|precio base/i.test(item.concepto || ''),
            isLocalCurrency: idx === 0 || /base|precio base/i.test(item.concepto || ''),
            isDirectInternational: idx > 0 && !/precio base/i.test(item.concepto || ''),
            isTransit: /transito|tránsito/i.test(item.concepto || ''),
            isPort: /portuario|puerto/i.test(item.concepto || ''),
            isInlandLogistics: /logistica|logística|inland/i.test(item.concepto || '')
          }));
          setCostes(initialProductCostes);
        }
      } else if (data && Array.isArray(data.lineItems) && data.lineItems.length > 0) {
        const newLineItems = data.lineItems.map((item, index) => ({
          id: `ai-item-${Date.now()}-${index}`,
          concepto: item.concepto || `Coste ${index + 1}`,
          valorLocal: Number(item.valorLocal) || 0,
          isBasePrice: index === 0 || /base|precio base/i.test(item.concepto || ''),
          isLocalCurrency: index === 0 || /base|precio base/i.test(item.concepto || ''),
          isDirectInternational: index > 0 && !/precio base/i.test(item.concepto || ''),
          isTransit: /transito|tránsito/i.test(item.concepto || ''),
          isPort: /portuario|puerto/i.test(item.concepto || ''),
          isInlandLogistics: /logistica|logística|inland/i.test(item.concepto || '')
        }));
        setCostes(newLineItems);
      }

      if (data.currency) {
        const resolvedCurrency = data.currency.toUpperCase();
        setMonedaOrigen(resolvedCurrency);
      }

      if (data.exchangeRate && Number(data.exchangeRate) > 0) {
        setTipoCambio(Number(data.exchangeRate));
      }

    } catch (err) {
      console.error("[CalculadoraTarifasWidget] Fallo al procesar archivo:", err);
      setUploadError("No se pudo procesar automáticamente la tarifa. Puedes introducir los valores manualmente.");
    } finally {
      setIsParsingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessTariffFile(file);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessTariffFile(file);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDraggingFile(true);
  };

  const handleDragLeave = () => {
    setIsDraggingFile(false);
  };

  // Gestión de filas dinámicas manuales
  const handleAddFila = () => {
    setCostes(prev => [
      ...prev,
      {
        id: Date.now() + Math.random(),
        concepto: '',
        valorLocal: 0,
        isBasePrice: false,
        isDirectInternational: true
      }
    ]);
  };

  const handleUpdateFila = (id, field, value) => {
    setCostes(prev =>
      prev.map(item => {
        if (item.id === id) {
          return {
            ...item,
            [field]: field === 'valorLocal' ? (value === '' ? '' : Number(value)) : value
          };
        }
        return item;
      })
    );
  };

  const handleDeleteFila = (id) => {
    setCostes(prev => {
      if (prev.length <= 1) {
        return [{ id: 'item-base', concepto: "Precio Base", valorLocal: 0, isBasePrice: true, isLocalCurrency: true }];
      }
      return prev.filter(item => item.id !== id);
    });
  };

  const handleResetToTemplate = () => {
    setCostes(getDefaultCostItems());
    setFactorDescuento(0.85);
    setCommercialModality('FOB');
    setUseFspe(true);
  };

  // =========================================================================
  // CÁLCULO DE TOTALES SEGÚN MODALIDAD (FOB/EXW) Y DIVISAS MIXTAS
  // =========================================================================
  const rateNum = Number(tipoCambio) || 0;
  const discountNum = Number(factorDescuento) || 0;
  const isExw = commercialModality === 'EXW';

  // Lógica de cálculo comercial conmutando EXW y FSPE
  const totalConvertidoCommercial = calculateCommercialTotal({
    items: costes,
    discountFactor: discountNum,
    exchangeRate: rateNum,
    commercialModality,
    useFspe
  });

  // Cálculo retrocompatible local para mostrar en divisa base
  let totalLocalCalculated = 0;
  costes.forEach((item, idx) => {
    const isBase = item.isBasePrice || item.isLocalCurrency || idx === 0 || /precio base/i.test(item.concepto || '');
    const isTransit = item.isTransit || /transito|tránsito/i.test(item.concepto || '');
    const isPort = item.isPort || /portuario|puerto/i.test(item.concepto || '');
    if (isExw && (isTransit || isPort)) return;

    const val = Number(item.valorLocal) || 0;
    if (isBase) {
      totalLocalCalculated += (val * discountNum);
    } else {
      // Costes en moneda internacional convertidos a divisa local estimada para el total local
      const inLocal = rateNum > 0 ? (val / rateNum) : val;
      totalLocalCalculated += inLocal;
    }
  });
  const totalLocalDisplay = Math.round(totalLocalCalculated * 100) / 100;

  // Inyección de estado al proyecto y cierre automático
  const handleEnviarAlProyecto = () => {
    if (typeof onApply === 'function') {
      onApply(totalConvertidoCommercial, {
        costes,
        factorDescuento: discountNum,
        monedaOrigen,
        tipoCambio: rateNum,
        commercialModality,
        useFspe,
        totalLocalFob: totalLocalDisplay,
        totalConvertidoFob: totalConvertidoCommercial,
        selectedProduct: tarifasImportadas.find(t => String(t.id) === String(selectedMaterialId)) || null
      });
    }
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  if (!isOpen) return null;

  const currentCurrencyObj = DEFAULT_CURRENCIES.find(c => c.code === monedaOrigen) || DEFAULT_CURRENCIES[0];

  return (
    <div
      className={`tariff-calc-container ${isMinimized ? 'is-minimized' : ''}`}
      style={{ left: `${position.x}px`, top: `${position.y}px`, position: 'fixed' }}
    >
      {/* Cabecera Tema Claro Corporativo arrastrable con controles */}
      <div
        className="tariff-calc-header"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="tariff-calc-title-group">
          <span className="tariff-calc-badge" aria-hidden="true">🧮</span>
          <div className="tariff-calc-title-text">
            <h4 className="tariff-calc-title">Calculadora Universal de Tarifas Terrestres</h4>
            <span className="tariff-calc-status">
              <span className="tariff-calc-status-dot">●</span>
              <span>Lector IA de Tarifas · [{commercialModality}] {useFspe ? '· FSPE' : '· Mercado'}</span>
            </span>
          </div>
        </div>

        <div className="tariff-calc-controls widget-controls">
          <button
            type="button"
            className="tariff-calc-control-btn"
            onClick={() => setIsMinimized(prev => !prev)}
            title={isMinimized ? "Restaurar calculadora" : "Minimizar calculadora"}
            aria-label={isMinimized ? "Restaurar" : "Minimizar"}
          >
            {isMinimized ? '🗖' : '🗕'}
          </button>
          <button
            type="button"
            className="tariff-calc-control-btn close-btn"
            onClick={onClose}
            title="Cerrar calculadora"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Cuerpo de la calculadora (oculto si está minimizado) */}
      {!isMinimized && (
        <>
          <div className="tariff-calc-body">
            {/* ESTADO DE CARGA (SPINNER) BLOQUEANDO LA CALCULADORA */}
            {isParsingFile && (
              <div className="tariff-calc-loading-overlay">
                <div className="tariff-calc-spinner" role="status" aria-label="Procesando archivo"></div>
                <span className="tariff-calc-loading-text">Extrayendo tarifas y partidas con IA...</span>
                <span className="tariff-calc-loading-sub">Analizando archivo y calculando estructura multidivisa</span>
              </div>
            )}

            {/* 1. ZONA DE IMPORTACIÓN (DROPZONE / UPLOAD) */}
            <div
              className={`tariff-calc-dropzone ${isDraggingFile ? 'is-dragging-file' : ''}`}
              onDrop={handleFileDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              title="Arrastra un archivo o haz clic para subir una tarifa en Excel o PDF"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                className="hidden"
                style={{ display: 'none' }}
                onChange={handleFileInputChange}
              />

              <div className="tariff-calc-dropzone-content">
                <span className="tariff-calc-dropzone-icon" aria-hidden="true">📑</span>
                <div className="tariff-calc-dropzone-texts">
                  <strong className="tariff-calc-dropzone-title">Subir Tarifa (Excel / PDF)</strong>
                  <span className="tariff-calc-dropzone-sub">
                    Arrastra aquí tu archivo o haz clic para examinar (.xlsx, .csv, .pdf)
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="tariff-calc-upload-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                <span>Subir Tarifa (Excel / PDF)</span>
              </button>
            </div>

            {/* 2. RENDERIZAR UN DESPLEGABLE (SELECT) DE PRODUCTOS */}
            {tarifasImportadas && tarifasImportadas.length > 0 && (
              <div className="tariff-calc-product-select-container bg-slate-50 border border-slate-200 rounded-lg p-2.5">
                <label className="block text-xs font-bold text-slate-700 mb-1">Seleccionar Producto:</label>
                <select 
                  className="w-full border border-slate-300 rounded p-1.5 text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:border-blue-500" 
                  onChange={handleMaterialChange} 
                  value={selectedMaterialId}
                >
                  {tarifasImportadas.map((item, idx) => (
                    <option key={idx} value={item.id}>{item.Produit || item.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* 3. CRÍTICO: BOTONERA SUPERIOR (FOB/EXW y FSPE) */}
            <div className="tariff-calc-toggles-bar">
              {/* Selector de Modalidad Comercial [ FOB | EXW ] */}
              <div className="tariff-calc-toggle-group">
                <span className="tariff-calc-toggle-label">Modalidad Comercial</span>
                <div className="tariff-calc-btn-group" role="group" aria-label="Modalidad Comercial">
                  <button
                    type="button"
                    id="btn-toggle-fob"
                    className={`tariff-calc-toggle-btn ${commercialModality === 'FOB' ? 'is-active' : ''}`}
                    onClick={() => setCommercialModality('FOB')}
                    title="Modalidad FOB: incluye flete interior, aduana y gastos portuarios"
                  >
                    FOB
                  </button>
                  <button
                    type="button"
                    id="btn-toggle-exw"
                    className={`tariff-calc-toggle-btn ${commercialModality === 'EXW' ? 'is-active' : ''}`}
                    onClick={() => setCommercialModality('EXW')}
                    title="Modalidad EXW: desactiva y excluye los gastos de tránsito y portuarios"
                  >
                    EXW
                  </button>
                </div>
              </div>

              {/* Selector de Convenio [ Con FSPE | Sin FSPE (Mercado) ] */}
              <div className="tariff-calc-toggle-group">
                <span className="tariff-calc-toggle-label">Régimen Logístico</span>
                <div className="tariff-calc-btn-group" role="group" aria-label="Régimen Logístico FSPE">
                  <button
                    type="button"
                    id="btn-toggle-con-fspe"
                    className={`tariff-calc-toggle-btn ${useFspe ? 'is-active fspe-active' : ''}`}
                    onClick={() => handleToggleFspe(true)}
                    title="Con FSPE: aplica convenio de logística subvencionada oficial"
                  >
                    Con FSPE
                  </button>
                  <button
                    type="button"
                    id="btn-toggle-sin-fspe"
                    className={`tariff-calc-toggle-btn ${!useFspe ? 'is-active' : ''}`}
                    onClick={() => handleToggleFspe(false)}
                    title="Sin FSPE: tarifa estándar de logística de mercado abierto"
                  >
                    Sin FSPE (Mercado)
                  </button>
                </div>
              </div>
            </div>

            {uploadError && (
              <div className="p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
                {uploadError}
              </div>
            )}

            {/* Barra de Moneda y Tipo de Cambio */}
            <div className="tariff-calc-currency-bar">
              <div className="tariff-calc-field-group">
                <label htmlFor="select-moneda-origen" className="tariff-calc-label">
                  Moneda Precio Base
                </label>
                <select
                  id="select-moneda-origen"
                  className="tariff-calc-select font-mono"
                  value={monedaOrigen}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                >
                  {DEFAULT_CURRENCIES.map(curr => (
                    <option key={curr.code} value={curr.code}>
                      {curr.code} ({curr.symbol}) - {curr.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="tariff-calc-field-group">
                <label htmlFor="input-tipo-cambio" className="tariff-calc-label">
                  Tipo de Cambio a USD/EUR
                </label>
                <input
                  id="input-tipo-cambio"
                  type="number"
                  step="any"
                  min="0"
                  className="tariff-calc-input font-mono"
                  value={tipoCambio}
                  onChange={(e) => setTipoCambio(e.target.value)}
                  placeholder="Ej: 0.0068"
                  title="Factor multiplicador para convertir la moneda del Precio Base a USD/EUR"
                />
              </div>
            </div>

            {/* Factor de Descuento (Rabais) Separado */}
            <div className="tariff-calc-discount-bar">
              <div className="tariff-calc-discount-info">
                <span className="tariff-calc-discount-title">
                  <span>🏷️</span>
                  <span>Factor de Descuento (Rabais)</span>
                </span>
                <span className="tariff-calc-discount-desc">
                  Aplica sobre el "Precio Base" ({monedaOrigen}): Base × {discountNum} × {rateNum}
                </span>
              </div>

              <div className="tariff-calc-discount-inputs">
                <input
                  id="input-factor-descuento"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1.5"
                  className="tariff-calc-discount-input"
                  value={factorDescuento}
                  onChange={(e) => setFactorDescuento(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.85"
                  title="Factor de Descuento (Rabais del Excel, valor por defecto 0.85)"
                />
                <span className="tariff-calc-discount-pct font-mono">
                  ({(discountNum * 100).toFixed(0)}%)
                </span>
              </div>
            </div>

            {/* Filas Dinámicas de Costes con Indicador de Divisa Mixta */}
            <div className="tariff-calc-rows-container">
              <div className="tariff-calc-row-header">
                <span>Concepto</span>
                <span className="text-right">Valor Origen</span>
                <span className="text-right">USD/EUR</span>
                <span className="text-center">✕</span>
              </div>

              {costes.map((item, idx) => {
                const isBase = item.isBasePrice || item.isLocalCurrency || idx === 0 || /precio base/i.test(item.concepto || '');
                const isTransit = item.isTransit || /transito|tránsito/i.test(item.concepto || '');
                const isPort = item.isPort || /portuario|puerto/i.test(item.concepto || '');
                const isExcludedInExw = isExw && (isTransit || isPort);

                const valNum = Number(item.valorLocal) || 0;
                // Divisas mixtas: Si es el Precio Base, aplica factor de descuento y tipo de cambio; si es periférico, es valor directo en USD/EUR
                let convertedRow = 0;
                if (!isExcludedInExw) {
                  if (isBase) {
                    convertedRow = Math.round((valNum * discountNum * rateNum) * 100) / 100;
                  } else {
                    convertedRow = Math.round(valNum * 100) / 100;
                  }
                }

                return (
                  <div 
                    key={item.id} 
                    className={`tariff-calc-row ${isBase ? 'is-base-row' : ''} ${isExcludedInExw ? 'is-excluded-exw' : ''}`}
                    title={isExcludedInExw ? "Excluido automáticamente en modalidad EXW" : ""}
                  >
                    <input
                      type="text"
                      className="tariff-calc-row-concepto"
                      value={item.concepto}
                      onChange={(e) => handleUpdateFila(item.id, 'concepto', e.target.value)}
                      placeholder="Concepto del coste..."
                    />
                    
                    <div className="tariff-calc-row-input-group">
                      <span className="tariff-calc-row-currency-badge">
                        {isBase ? monedaOrigen : 'USD'}
                      </span>
                      <input
                        type="number"
                        step="any"
                        min="0"
                        className="tariff-calc-row-valor"
                        value={item.valorLocal === '' ? '' : item.valorLocal}
                        onChange={(e) => handleUpdateFila(item.id, 'valorLocal', e.target.value)}
                        placeholder="0.00"
                        disabled={isExcludedInExw}
                        title={isBase ? `Precio Base en ${monedaOrigen} (se aplicará factor ${discountNum} y tipo de cambio)` : 'Valor directo en divisa internacional'}
                      />
                    </div>

                    <span
                      className="tariff-calc-row-converted"
                      title={isExcludedInExw ? "0.00 (Excluido en EXW)" : (isBase ? `Valor neto convertido tras descuento (${discountNum}) y cambio` : 'Valor directo en USD/EUR')}
                    >
                      {convertedRow.toFixed(2)}
                    </span>

                    <button
                      type="button"
                      className="tariff-calc-row-delete-btn"
                      onClick={() => handleDeleteFila(item.id)}
                      title="Eliminar fila"
                      aria-label="Eliminar fila"
                    >
                      🗑️
                    </button>
                  </div>
                );
              })}

              <div className="tariff-calc-actions-bar">
                <button
                  type="button"
                  className="tariff-calc-add-btn"
                  onClick={handleAddFila}
                >
                  <span>+</span>
                  <span>Añadir Fila de Coste</span>
                </button>

                <button
                  type="button"
                  className="tariff-calc-reset-btn"
                  onClick={handleResetToTemplate}
                  title="Restablecer la plantilla oficial de 5 conceptos, FOB y FSPE"
                >
                  <span>↺</span>
                  <span>Plantilla Excel</span>
                </button>
              </div>
            </div>

            {/* Tarjeta de Resumen y Totales (Recalculado según modalidad comercial) */}
            <div className="tariff-calc-summary-card">
              <div className="tariff-calc-summary-item">
                <span className="tariff-calc-summary-label">Modalidad Activa</span>
                <span className="tariff-calc-summary-val-local">
                  {commercialModality} {useFspe ? '(FSPE)' : '(Mercado)'}
                </span>
              </div>

              <div className="tariff-calc-summary-item text-right">
                <span className="tariff-calc-summary-label">Total Cotización ({targetCurrency})</span>
                <span className="tariff-calc-summary-val-converted">
                  {totalConvertidoCommercial.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {targetCurrency === 'EUR' ? '€' : '$'}
                </span>
              </div>
            </div>
          </div>

          {/* Pie del Widget con botón ENVIAR AL PROYECTO */}
          <div className="tariff-calc-footer">
            <div className="tariff-calc-footer-info">
              <span>🚚</span>
              <span>{commercialModality} inyectado en proyecto</span>
            </div>

            <button
              type="button"
              id="btn-enviar-al-proyecto"
              className="tariff-calc-submit-btn"
              onClick={handleEnviarAlProyecto}
              title={`Inyectar el total ${commercialModality} (${totalConvertidoCommercial.toFixed(2)} ${targetCurrency}) en el proyecto de fondo y cerrar el widget`}
            >
              <span>📥</span>
              <span>ENVIAR AL PROYECTO ({commercialModality})</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
