// js/icp-builder.js
// ───────────────────────────────────────────────────────────
// Captura los campos del ICP Builder (página #page-pro-icp)
// y los guarda en Sheets vía Apps Script.
//
// Requiere que en index.html cada <select>/<input>/<textarea>
// relevante tenga un data-icp="<clave>" para que lo pueda leer.
// (Ver README → sección "Cambios mínimos al HTML")
// ───────────────────────────────────────────────────────────
(function (global) {
  const { toast, setButtonLoading, getMultiSelectValues, csv } =
    global.uiHelpers;

  // Estado en memoria del último ICP guardado
  let currentICP = null;

  function readICPFromDOM() {
    const root = document.getElementById("page-pro-icp");
    if (!root) return null;

    const q = (key) => root.querySelector(`[data-icp="${key}"]`);

    const icp = {
      // Firmográfico
      countries:       getMultiSelectValues(q("countries")),
      industries:      getMultiSelectValues(q("industries")),
      company_sizes:   getMultiSelectValues(q("company_sizes")),
      client_type:     q("client_type")?.value || "B2B",

      // Psicográfico
      titles:          getMultiSelectValues(q("titles")),
      areas:           getMultiSelectValues(q("areas")),
      triggers:        getMultiSelectValues(q("triggers")),

      // Negativo
      negative_industries: csv(q("negative_industries")?.value),
      negative_sizes:      getMultiSelectValues(q("negative_sizes")),
      excluded_companies:  csv(q("excluded_companies")?.value),

      // Keywords libres (bio/descripción)
      keywords: csv(q("keywords")?.value),
    };

    return icp;
  }

  function validateICP(icp) {
    if (!icp) return "ICP vacío";
    if (!icp.titles?.length) return "Agrega al menos un cargo objetivo";
    if (!icp.countries?.length) return "Agrega al menos un país";
    return null;
  }

  async function saveICP(triggerBtn) {
    const icp = readICPFromDOM();
    const err = validateICP(icp);
    if (err) {
      toast(err, "warn");
      return null;
    }

    const restore = setButtonLoading(triggerBtn, "⏳ Guardando ICP...");
    try {
      const res = await global.api.saveICP(icp);
      currentICP = { ...icp, icp_id: res.icp_id };
      toast("ICP guardado ✓", "success");
      restore("✓ ICP guardado");

      // Exponer a Apollo Sequences
      global.predictable = global.predictable || {};
      global.predictable.currentICP = currentICP;

      return currentICP;
    } catch (e) {
      toast("Error guardando ICP: " + e.message, "error");
      restore();
      return null;
    }
  }

  // Auto-guardado tipo "debounce" cuando el usuario edita algo
  let debounceTimer = null;
  function scheduleAutoSave() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const icp = readICPFromDOM();
      if (!validateICP(icp)) {
        global.api.saveICP(icp)
          .then((res) => {
            currentICP = { ...icp, icp_id: res.icp_id };
            global.predictable = global.predictable || {};
            global.predictable.currentICP = currentICP;
          })
          .catch(() => {/* silencioso */});
      }
    }, 1500);
  }

  function bindAutoSave() {
    const root = document.getElementById("page-pro-icp");
    if (!root) return;
    root.querySelectorAll("[data-icp]").forEach((el) => {
      el.addEventListener("change", scheduleAutoSave);
      el.addEventListener("blur", scheduleAutoSave);
    });
  }

  // Exponer API del módulo
  global.icpBuilder = {
    readICPFromDOM,
    saveICP,
    getCurrent: () => currentICP,
    init: bindAutoSave,
  };

  document.addEventListener("DOMContentLoaded", bindAutoSave);
})(window);
