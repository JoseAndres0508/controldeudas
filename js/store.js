/* =========================================================
   ALMACENAMIENTO
   localStorage cuando está disponible; si el navegador lo
   bloquea (previsualizaciones en sandbox), cae a memoria.
   ========================================================= */
export const Store = (() => {
  const KEY = 'libro-deudas-v1';
  let ok = true, mem = null;
  try { localStorage.setItem('__t', '1'); localStorage.removeItem('__t'); } catch (e) { ok = false; }
  return {
    persistent: ok,
    load() {
      if (!ok) return mem;
      try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; }
      catch (e) { return null; }
    },
    save(data) {
      if (!ok) { mem = data; return; }
      try { localStorage.setItem(KEY, JSON.stringify(data)); }
      catch (e) { console.warn('No se pudo guardar', e); }
    }
  };
})();
