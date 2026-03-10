/**
 * SupCrud Widget Embebible v1.1
 *
 * Uso:
 * <script src="https://tudominio.com/widget/widget.js"
 *         data-workspace="WS-TIENDA-001"
 *         data-title="Soporte Tienda"
 *         data-color="#3b82f6">
 * </script>
 */

(function () {
  'use strict';

  if (window.__scWidgetLoaded) return;
  window.__scWidgetLoaded = true;

  // ── Configuración desde el script tag ────────────────────
  const scriptTag = document.currentScript || document.querySelector('script[data-workspace]');
  const WORKSPACE = scriptTag?.getAttribute('data-workspace') || '';
  const TITLE     = scriptTag?.getAttribute('data-title')     || 'Soporte al cliente';
  const COLOR     = scriptTag?.getAttribute('data-color')     || '#3b82f6';
  const POSITION  = scriptTag?.getAttribute('data-position')  || 'right';
  const BASE_URL  = scriptTag?.getAttribute('data-url') ||
    (window.location.hostname === 'localhost'
      ? 'http://localhost:3000'
      : window.location.origin);

  if (!WORKSPACE) {
    console.error('[SupCrud Widget] Falta data-workspace');
    return;
  }

  // ── Carga el CSS ──────────────────────────────────────────
  const link = document.createElement('link');
  link.rel   = 'stylesheet';
  link.href  = `${BASE_URL}/widget/widget.css`;
  document.head.appendChild(link);

  // ── Estado interno ────────────────────────────────────────
  let isOpen    = false;
  let activeTab = 'nuevo';
  // Estado de la consulta dentro del widget
  let consulta  = { ref: '', email: '', otp: '', paso: 1 };
  // Addons activos del workspace
  let _addons   = {};

  // Carga los addons activos del workspace (una sola vez al abrir)
  const cargarAddonsWidget = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/api/public/workspace-addons/${WORKSPACE}`);
      const data = await res.json();
      if (data.ok) _addons = data.data;
    } catch (e) { /* silencioso — sin addons por defecto */ }
  };

  function shadeColor(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R   = Math.max(0, Math.min(255, (num >> 16) + amt));
    const G   = Math.max(0, Math.min(255, (num >> 8 & 0x00FF) + amt));
    const B   = Math.max(0, Math.min(255, (num & 0x0000FF) + amt));
    return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
  }

  // ── Crea el HTML del widget ───────────────────────────────
  const root = document.createElement('div');
  root.className = 'sc-widget-root';
  root.style.setProperty('--sc-accent',   COLOR);
  root.style.setProperty('--sc-accent-h', shadeColor(COLOR, -20));

  root.innerHTML = `
    <div class="sc-fab-tooltip" id="sc-tooltip">¿Necesitas ayuda?</div>

    <button class="sc-fab" id="sc-fab" aria-label="Abrir soporte"
      style="background:${COLOR};${POSITION==='left'?'right:auto;left:24px':''}">
      <span id="sc-fab-icon">💬</span>
    </button>

    <div class="sc-panel" id="sc-panel"
      style="${POSITION==='left'?'right:auto;left:24px':''}">

      <div class="sc-header">
        <div class="sc-header-icon" style="background:${COLOR}">⚡</div>
        <div class="sc-header-text">
          <p class="sc-header-title">${TITLE}</p>
          <p class="sc-header-sub">Tiempo de respuesta: menos de 24h</p>
        </div>
      </div>

      <div class="sc-tabs">
        <button class="sc-tab sc-active" id="sc-tab-nuevo"
          onclick="window.__sc.cambiarTab('nuevo')">📝 Nueva solicitud</button>
        <button class="sc-tab" id="sc-tab-consultar"
          onclick="window.__sc.cambiarTab('consultar')">🔍 Consultar caso</button>
      </div>

      <div class="sc-body" id="sc-body">

        <!-- ══ TAB: Nuevo ticket ══ -->
        <div id="sc-tab-content-nuevo">

          <div id="sc-form-screen">
            <div class="sc-form-group">
              <label class="sc-label">Tu nombre</label>
              <input type="text" class="sc-input" id="sc-nombre" placeholder="Juan Pérez">
            </div>
            <div class="sc-form-group">
              <label class="sc-label">Correo electrónico *</label>
              <input type="email" class="sc-input" id="sc-email" placeholder="tu@email.com">
            </div>
            <div class="sc-form-group">
              <label class="sc-label">Asunto *</label>
              <input type="text" class="sc-input" id="sc-asunto"
                placeholder="Describe brevemente tu caso">
            </div>
            <div class="sc-form-group">
              <label class="sc-label">Descripción *</label>
              <textarea class="sc-textarea" id="sc-descripcion"
                placeholder="Cuéntanos en detalle tu situación..."></textarea>
            </div>
            <div class="sc-row">
              <div class="sc-form-group">
                <label class="sc-label">Tipo</label>
                <select class="sc-select" id="sc-tipo">
                  <option value="P">Petición</option>
                  <option value="Q">Queja</option>
                  <option value="R" selected>Reclamo</option>
                  <option value="S">Sugerencia</option>
                </select>
              </div>
              <div class="sc-form-group">
                <label class="sc-label">Prioridad</label>
                <select class="sc-select" id="sc-prioridad">
                  <option value="LOW">Baja</option>
                  <option value="MEDIUM" selected>Media</option>
                  <option value="HIGH">Alta</option>
                </select>
              </div>
            </div>

            <!-- Adjunto en staging — visible solo si ATTACHMENTS está activo -->
            <div id="sc-seccion-adj-nuevo" class="sc-form-group" style="display:none">
              <label class="sc-label">Adjuntar archivo (opcional)</label>
              <label id="sc-label-adj-nuevo"
                style="display:flex;align-items:center;gap:6px;cursor:pointer;
                       background:var(--sc-surface2);border:1px dashed var(--sc-border);
                       border-radius:8px;padding:10px 12px;transition:border-color 0.15s;
                       font-family:var(--sc-font);font-size:0.8rem;color:var(--sc-text-muted)"
                onmouseover="this.style.borderColor='var(--sc-accent)'"
                onmouseout="this.style.borderColor=window.__sc._adjNuevo?'var(--sc-accent)':'var(--sc-border)'">
                📎 <span id="sc-adj-nuevo-texto">Seleccionar archivo...</span>
                <input type="file" id="sc-input-adj-nuevo" style="display:none"
                  accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                  onchange="window.__sc.seleccionarAdjuntoNuevo(this)">
              </label>
              <!-- Preview del archivo seleccionado -->
              <div id="sc-adj-nuevo-preview" style="display:none;margin-top:8px;
                padding:8px 10px;background:var(--sc-surface2);
                border:1px solid var(--sc-accent);border-radius:8px;
                display:none;align-items:center;gap:8px">
                <span id="sc-adj-nuevo-icon" style="font-size:1.2rem;flex-shrink:0">📎</span>
                <div style="flex:1;min-width:0">
                  <div id="sc-adj-nuevo-nombre" style="font-size:0.78rem;color:var(--sc-text);
                    white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
                  <div id="sc-adj-nuevo-tamano" style="font-size:0.68rem;color:var(--sc-text-muted)"></div>
                </div>
                <button onclick="window.__sc.eliminarAdjuntoNuevo()"
                  style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);
                         color:#f87171;border-radius:6px;padding:3px 8px;cursor:pointer;
                         font-size:0.72rem;flex-shrink:0;font-family:var(--sc-font)">
                  ✕ Quitar
                </button>
              </div>
            </div>

            <button class="sc-btn" id="sc-btn-enviar"
              onclick="window.__sc.enviarTicket()" style="background:${COLOR}">
              <span class="sc-btn-text">Enviar solicitud</span>
              <div class="sc-spinner"></div>
            </button>
            <div class="sc-alert" id="sc-alert-form"></div>
          </div>

          <div id="sc-success-screen" style="display:none">
            <div class="sc-success-screen">
              <span class="sc-success-icon">✅</span>
              <div class="sc-success-title">¡Solicitud enviada!</div>
              <p class="sc-success-sub">
                Te enviamos un correo con tu código.<br>
                Úsalo para consultar el estado de tu caso.
              </p>
              <div class="sc-ref-code" id="sc-ref-display">—</div>
              <button class="sc-btn" onclick="window.__sc.irAConsultarDesdeExito()"
                style="background:${COLOR}">
                <span class="sc-btn-text">Consultar mi caso →</span>
                <div class="sc-spinner"></div>
              </button>
              <button class="sc-btn-secondary" onclick="window.__sc.nuevaSolicitud()">
                Enviar otra solicitud
              </button>
            </div>
          </div>

        </div>

        <!-- ══ TAB: Consultar caso — 3 pasos dentro del widget ══ -->
        <div id="sc-tab-content-consultar" style="display:none">

          <!-- Paso 1: Ingresar ref + email -->
          <div id="sc-consulta-paso1">
            <div class="sc-consulta-info">
              Ingresa tu <strong>código de referencia</strong> y correo
              para recibir un código de verificación.
            </div>
            <div class="sc-form-group">
              <label class="sc-label">Código de referencia</label>
              <input type="text" class="sc-input" id="sc-ref-consulta"
                placeholder="REF-WSTIENDA-123..."
                style="text-transform:uppercase"
                oninput="this.value=this.value.toUpperCase()"
                onkeydown="if(event.key==='Enter') window.__sc.solicitarOTP()">
            </div>
            <div class="sc-form-group">
              <label class="sc-label">Tu correo electrónico</label>
              <input type="email" class="sc-input" id="sc-email-consulta"
                placeholder="tu@email.com"
                onkeydown="if(event.key==='Enter') window.__sc.solicitarOTP()">
            </div>
            <button class="sc-btn" id="sc-btn-otp"
              onclick="window.__sc.solicitarOTP()" style="background:${COLOR}">
              <span class="sc-btn-text">Enviar código de verificación</span>
              <div class="sc-spinner"></div>
            </button>
            <div class="sc-alert" id="sc-alert-paso1"></div>
          </div>

          <!-- Paso 2: Ingresar OTP -->
          <div id="sc-consulta-paso2" style="display:none">
            <div class="sc-consulta-info">
              Enviamos un código de <strong>6 dígitos</strong> a tu correo.
              Ingrésalo aquí. Válido por 10 minutos.
            </div>
            <div class="sc-otp-wrap" style="display:flex;gap:8px;justify-content:center;margin:16px 0">
              <input type="text" maxlength="1" class="sc-input sc-otp-digit"
                style="width:40px;height:48px;text-align:center;font-size:1.3rem;font-weight:600;padding:0;font-family:monospace"
                data-index="0">
              <input type="text" maxlength="1" class="sc-input sc-otp-digit"
                style="width:40px;height:48px;text-align:center;font-size:1.3rem;font-weight:600;padding:0;font-family:monospace"
                data-index="1">
              <input type="text" maxlength="1" class="sc-input sc-otp-digit"
                style="width:40px;height:48px;text-align:center;font-size:1.3rem;font-weight:600;padding:0;font-family:monospace"
                data-index="2">
              <input type="text" maxlength="1" class="sc-input sc-otp-digit"
                style="width:40px;height:48px;text-align:center;font-size:1.3rem;font-weight:600;padding:0;font-family:monospace"
                data-index="3">
              <input type="text" maxlength="1" class="sc-input sc-otp-digit"
                style="width:40px;height:48px;text-align:center;font-size:1.3rem;font-weight:600;padding:0;font-family:monospace"
                data-index="4">
              <input type="text" maxlength="1" class="sc-input sc-otp-digit"
                style="width:40px;height:48px;text-align:center;font-size:1.3rem;font-weight:600;padding:0;font-family:monospace"
                data-index="5">
            </div>
            <button class="sc-btn" id="sc-btn-verificar"
              onclick="window.__sc.verificarOTP()" style="background:${COLOR}">
              <span class="sc-btn-text">Verificar y ver mi caso</span>
              <div class="sc-spinner"></div>
            </button>
            <div class="sc-alert" id="sc-alert-paso2"></div>
            <div style="text-align:center;margin-top:10px;font-size:0.75rem;color:var(--sc-text-muted)">
              <button id="sc-btn-reenviar" onclick="window.__sc.reenviarOTP()"
                style="background:none;border:none;color:var(--sc-accent);cursor:pointer;font-size:0.75rem">
                Reenviar código
              </button>
              ·
              <button onclick="window.__sc.volverPaso1()"
                style="background:none;border:none;color:var(--sc-text-muted);cursor:pointer;font-size:0.75rem">
                Cambiar datos
              </button>
            </div>
          </div>

          <!-- Paso 3: Ver el ticket -->
          <div id="sc-consulta-paso3" style="display:none">
            <div id="sc-ticket-view"></div>
            <div class="sc-alert" id="sc-alert-paso3"></div>
            <button class="sc-btn-secondary" onclick="window.__sc.volverPaso1()"
              style="margin-top:12px">
              ← Consultar otro caso
            </button>
          </div>

        </div>

      </div>

      <div class="sc-footer">
        Powered by <a href="${BASE_URL}" target="_blank">SupCrud</a> · by Crudzaso
      </div>

    </div>
  `;

  document.body.appendChild(root);

  // ── Referencias DOM ───────────────────────────────────────
  const fab     = root.querySelector('#sc-fab');
  const panel   = root.querySelector('#sc-panel');
  const tooltip = root.querySelector('#sc-tooltip');
  const fabIcon = root.querySelector('#sc-fab-icon');

  // ── OTP inputs — auto avance ──────────────────────────────
  const initOTPInputs = () => {
    const digits = root.querySelectorAll('.sc-otp-digit');
    digits.forEach((input, i) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        input.value = val;
        if (val && i < 5) digits[i + 1].focus();
        if (i === 5 && val) window.__sc.verificarOTP();
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !input.value && i > 0) {
          digits[i - 1].focus();
          digits[i - 1].value = '';
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const paste = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, 6);
        paste.split('').forEach((char, idx) => {
          if (digits[idx]) digits[idx].value = char;
        });
        if (paste.length === 6) window.__sc.verificarOTP();
      });
    });
  };

  // ── Toggle ────────────────────────────────────────────────
  fab.addEventListener('mouseenter', () => { if (!isOpen) tooltip.classList.add('sc-visible'); });
  fab.addEventListener('mouseleave', () => tooltip.classList.remove('sc-visible'));
  let _addonsCargados = false;

  fab.addEventListener('click', async () => {
    isOpen = !isOpen;
    panel.classList.toggle('sc-open', isOpen);
    fab.classList.toggle('sc-open', isOpen);
    fabIcon.textContent = isOpen ? '✕' : '💬';
    tooltip.classList.remove('sc-visible');
    if (isOpen) {
      initOTPInputs();
      // Carga addons solo la primera vez que se abre
      if (!_addonsCargados) {
        _addonsCargados = true;
        await cargarAddonsWidget();
        // Muestra u oculta las secciones de adjunto según el addon
        const tieneAdj = !!_addons['ATTACHMENTS'];
        const secNuevo = root.querySelector('#sc-seccion-adj-nuevo');
        const secCons  = root.querySelector('#sc-seccion-adj-consulta');
        if (secNuevo) secNuevo.style.display = tieneAdj ? 'block' : 'none';
        if (secCons)  secCons.style.display  = tieneAdj ? 'block' : 'none';
      }
    }
  });
  document.addEventListener('click', (e) => {
    if (isOpen && !root.contains(e.target)) {
      isOpen = false;
      panel.classList.remove('sc-open');
      fab.classList.remove('sc-open');
      fabIcon.textContent = '💬';
    }
  });

  // ── Helpers ───────────────────────────────────────────────
  const showAlert = (id, msg, type) => {
    const el = root.querySelector(`#${id}`);
    el.textContent = (type === 'success' ? '✓ ' : '✕ ') + msg;
    el.className   = `sc-alert sc-${type} sc-visible`;
  };
  const hideAlert  = (id) => { root.querySelector(`#${id}`).className = 'sc-alert'; };
  const setLoading = (btn, v) => { btn.disabled = v; btn.classList.toggle('sc-loading', v); };
  const getOTP     = () => Array.from(root.querySelectorAll('.sc-otp-digit')).map(d => d.value).join('');
  const clearOTP   = () => root.querySelectorAll('.sc-otp-digit').forEach(d => d.value = '');

  const statusLabel = {
    OPEN:'Abierto', IN_PROGRESS:'En progreso',
    RESOLVED:'Resuelto', CLOSED:'Cerrado', REOPENED:'Reabierto'
  };
  const statusColor = {
    OPEN:'#60a5fa', IN_PROGRESS:'#fbbf24',
    RESOLVED:'#34d399', CLOSED:'#94a3b8', REOPENED:'#60a5fa'
  };
  const typeLabel = { P:'Petición', Q:'Queja', R:'Reclamo', S:'Sugerencia' };
  const fecha = (d) => new Date(d).toLocaleDateString('es-CO',
    { day:'2-digit', month:'short', year:'numeric' });

  // ── API pública ───────────────────────────────────────────
  window.__sc = {

    cambiarTab(tab) {
      activeTab = tab;
      root.querySelector('#sc-tab-nuevo').classList.toggle('sc-active',     tab === 'nuevo');
      root.querySelector('#sc-tab-consultar').classList.toggle('sc-active', tab === 'consultar');
      root.querySelector('#sc-tab-content-nuevo').style.display     = tab === 'nuevo'     ? 'block' : 'none';
      root.querySelector('#sc-tab-content-consultar').style.display = tab === 'consultar' ? 'block' : 'none';
    },

    // ── Consulta — Paso 1: Solicitar OTP ────────────────────
    async solicitarOTP() {
      const ref   = root.querySelector('#sc-ref-consulta').value.trim();
      const email = root.querySelector('#sc-email-consulta').value.trim();
      const btn   = root.querySelector('#sc-btn-otp');

      hideAlert('sc-alert-paso1');
      if (!ref || !email) {
        showAlert('sc-alert-paso1', 'Ingresa el código de referencia y tu correo', 'error');
        return;
      }

      setLoading(btn, true);
      try {
        const res  = await fetch(`${BASE_URL}/api/public/solicitar-otp`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceCode: ref, email })
        });
        const data = await res.json();

        if (data.ok) {
          consulta.ref   = ref;
          consulta.email = email;
          // Avanza al paso 2
          root.querySelector('#sc-consulta-paso1').style.display = 'none';
          root.querySelector('#sc-consulta-paso2').style.display = 'block';
          clearOTP();
          setTimeout(() => root.querySelectorAll('.sc-otp-digit')[0]?.focus(), 100);
        } else {
          showAlert('sc-alert-paso1', data.message, 'error');
        }
      } catch (e) {
        showAlert('sc-alert-paso1', 'No se pudo conectar con el servidor', 'error');
      } finally {
        setLoading(btn, false);
      }
    },

    // ── Consulta — Paso 2: Verificar OTP ────────────────────
    async verificarOTP() {
      const otp = getOTP();
      if (otp.length < 6) return;

      const btn = root.querySelector('#sc-btn-verificar');
      hideAlert('sc-alert-paso2');
      setLoading(btn, true);

      try {
        const res  = await fetch(`${BASE_URL}/api/public/verificar-otp`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceCode: consulta.ref, email: consulta.email, otp })
        });
        const data = await res.json();

        if (data.ok) {
          consulta.otp = otp;
          // Avanza al paso 3
          root.querySelector('#sc-consulta-paso2').style.display = 'none';
          root.querySelector('#sc-consulta-paso3').style.display = 'block';
          window.__sc.renderTicket(data.data);
          // Aplica visibilidad del addon ATTACHMENTS al paso 3 recién renderizado
          const secCons = root.querySelector('#sc-seccion-adj-consulta');
          if (secCons) secCons.style.display = _addons['ATTACHMENTS'] ? 'block' : 'none';
        } else {
          showAlert('sc-alert-paso2', data.message, 'error');
          clearOTP();
          setTimeout(() => root.querySelectorAll('.sc-otp-digit')[0]?.focus(), 100);
        }
      } catch (e) {
        showAlert('sc-alert-paso2', 'Error al verificar el código', 'error');
      } finally {
        setLoading(btn, false);
      }
    },

    // ── Consulta — Reenviar OTP ──────────────────────────────
    async reenviarOTP() {
      const btn = root.querySelector('#sc-btn-reenviar');
      btn.disabled = true;

      try {
        const res  = await fetch(`${BASE_URL}/api/public/solicitar-otp`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ referenceCode: consulta.ref, email: consulta.email })
        });
        const data = await res.json();

        if (data.ok) {
          showAlert('sc-alert-paso2', 'Código reenviado. Revisa tu correo.', 'success');
          clearOTP();
          let s = 30;
          btn.textContent = `Reenviar (${s}s)`;
          const iv = setInterval(() => {
            s--;
            btn.textContent = `Reenviar (${s}s)`;
            if (s <= 0) { clearInterval(iv); btn.textContent = 'Reenviar código'; btn.disabled = false; }
          }, 1000);
        } else {
          btn.disabled = false;
        }
      } catch (e) {
        btn.disabled = false;
      }
    },

    volverPaso1() {
      consulta = { ref: '', email: '', otp: '', paso: 1 };
      root.querySelector('#sc-consulta-paso1').style.display = 'block';
      root.querySelector('#sc-consulta-paso2').style.display = 'none';
      root.querySelector('#sc-consulta-paso3').style.display = 'none';
      root.querySelector('#sc-ref-consulta').value           = '';
      root.querySelector('#sc-email-consulta').value         = '';
      clearOTP();
      ['sc-alert-paso1','sc-alert-paso2','sc-alert-paso3'].forEach(id => hideAlert(id));
    },

    // ── Consulta — Paso 3: Renderizar ticket ─────────────────
    renderTicket(t) {
      const statusC = statusColor[t.status] || '#60a5fa';
      const view    = root.querySelector('#sc-ticket-view');

      view.innerHTML = `
        <!-- Info del ticket -->
        <div style="background:var(--sc-surface2);border:1px solid var(--sc-border);
                    border-radius:8px;padding:14px;margin-bottom:12px">
          <div style="font-family:monospace;font-size:0.7rem;color:var(--sc-accent);margin-bottom:4px">
            ${t.referenceCode}
          </div>
          <div style="font-size:0.9rem;font-weight:600;color:#fff;margin-bottom:8px">
            ${t.subject}
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <span style="font-size:0.68rem;font-family:monospace;padding:2px 8px;border-radius:20px;
                         background:rgba(59,130,246,0.1);color:${statusC};border:1px solid ${statusC}40">
              ${statusLabel[t.status]}
            </span>
            <span style="font-size:0.68rem;color:var(--sc-text-muted)">
              ${typeLabel[t.type]} · ${fecha(t.createdAt)}
            </span>
          </div>
          ${t.assignedAgentName ? `
            <div style="margin-top:8px;font-size:0.72rem;color:var(--sc-text-muted)">
              Agente: <strong style="color:var(--sc-text)">${t.assignedAgentName}</strong>
            </div>
          ` : ''}
        </div>

        <!-- Conversación -->
        <div style="font-size:0.68rem;color:var(--sc-text-muted);text-transform:uppercase;
                    letter-spacing:0.06em;margin-bottom:6px">Conversación</div>
        <div id="sc-conv" style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px;
                                  max-height:200px;overflow-y:auto">
          ${t.conversation.length
            ? t.conversation.map(m => `
                <div style="padding:9px 12px;border-radius:8px;font-size:0.8rem;line-height:1.5;
                             max-width:88%;${m.senderType==='AGENT'
                               ? 'align-self:flex-end;background:rgba(59,130,246,0.12);border:1px solid rgba(59,130,246,0.2);color:var(--sc-text)'
                               : 'align-self:flex-start;background:var(--sc-surface2);border:1px solid var(--sc-border);color:var(--sc-text-dim)'}">
                  <div style="font-size:0.65rem;color:var(--sc-text-muted);margin-bottom:3px">
                    ${m.senderType === 'AGENT' ? '🧑‍💼 Agente' : '👤 Tú'}
                  </div>
                  ${m.content}
                </div>
              `).join('')
            : '<p style="color:var(--sc-text-muted);font-size:0.78rem">Aún no hay respuestas.</p>'
          }
        </div>

        <!-- Responder (si no está cerrado) -->
        ${t.status !== 'CLOSED' ? `
          <div style="display:flex;gap:6px">
            <input type="text" class="sc-input" id="sc-msg-cliente"
              placeholder="Agregar información..."
              style="flex:1;font-size:0.82rem"
              onkeydown="if(event.key==='Enter') window.__sc.enviarConAdjunto('${t.referenceCode}')">
            <button onclick="window.__sc.enviarConAdjunto('${t.referenceCode}')"
              style="background:${COLOR};color:#fff;border:none;border-radius:8px;
                     padding:0 14px;font-size:0.82rem;cursor:pointer;font-weight:500;
                     white-space:nowrap">
              Enviar
            </button>
          </div>

          <!-- Staging de adjunto en consulta — visible solo si ATTACHMENTS activo -->
          <div id="sc-seccion-adj-consulta" style="display:none;margin-top:8px">
            <label id="sc-label-adj-consulta"
              style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;
                     font-family:var(--sc-font);font-size:0.75rem;color:var(--sc-text-muted);
                     background:var(--sc-surface2);border:1px dashed var(--sc-border);
                     border-radius:8px;padding:6px 10px;transition:border-color 0.15s"
              onmouseover="this.style.borderColor='var(--sc-accent)'"
              onmouseout="this.style.borderColor=window.__sc._adjConsulta?'var(--sc-accent)':'var(--sc-border)'">
              📎 Adjuntar archivo
              <input type="file" id="sc-input-adj-consulta" style="display:none"
                accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                onchange="window.__sc.seleccionarAdjuntoConsulta(this)">
            </label>
          </div>
          <!-- Preview del adjunto seleccionado en consulta -->
          <div id="sc-adj-consulta-preview" style="display:none;margin-top:6px;
            padding:7px 10px;background:var(--sc-surface2);
            border:1px solid var(--sc-accent);border-radius:8px;
            align-items:center;gap:8px">
            <span id="sc-adj-consulta-icon" style="font-size:1.1rem;flex-shrink:0">📎</span>
            <div style="flex:1;min-width:0">
              <div id="sc-adj-consulta-nombre"
                style="font-size:0.75rem;color:var(--sc-text);
                       white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></div>
              <div id="sc-adj-consulta-tamano"
                style="font-size:0.65rem;color:var(--sc-text-muted)"></div>
            </div>
            <button onclick="window.__sc.eliminarAdjuntoConsulta()"
              style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);
                     color:#f87171;border-radius:6px;padding:3px 8px;cursor:pointer;
                     font-size:0.7rem;flex-shrink:0;font-family:var(--sc-font)">
              ✕ Quitar
            </button>
          </div>
          <div id="sc-alert-adj-consulta" style="font-size:0.72rem;margin-top:4px;color:var(--sc-text-muted)"></div>
        ` : `
          <div style="text-align:center;padding:10px;background:var(--sc-surface2);
                      border:1px solid var(--sc-border);border-radius:8px;
                      font-size:0.78rem;color:var(--sc-text-muted)">
            Este caso está cerrado.
          </div>
        `}
      `;
    },

    // ════════════════════════════════════════════════════════
    //  ADJUNTO NUEVO TICKET — staging local, sube al enviar
    // ════════════════════════════════════════════════════════
    _adjNuevo: null, // File object en staging

    seleccionarAdjuntoNuevo(input) {
      const file = input.files[0];
      if (!file) return;
      window.__sc._adjNuevo = file;

      const preview = root.querySelector('#sc-adj-nuevo-preview');
      root.querySelector('#sc-adj-nuevo-texto').textContent  = 'Cambiar archivo...';
      root.querySelector('#sc-adj-nuevo-nombre').textContent = file.name;
      root.querySelector('#sc-adj-nuevo-tamano').textContent = `${(file.size/1024).toFixed(1)} KB`;
      root.querySelector('#sc-adj-nuevo-icon').textContent   =
        file.type.startsWith('image/') ? '🖼️' : file.type.includes('pdf') ? '📄' : '📎';
      preview.style.display = 'flex';
      // Mantiene borde del label resaltado
      root.querySelector('#sc-label-adj-nuevo').style.borderColor = 'var(--sc-accent)';
    },

    eliminarAdjuntoNuevo() {
      window.__sc._adjNuevo = null;
      root.querySelector('#sc-input-adj-nuevo').value         = '';
      root.querySelector('#sc-adj-nuevo-preview').style.display = 'none';
      root.querySelector('#sc-adj-nuevo-texto').textContent    = 'Seleccionar archivo...';
      root.querySelector('#sc-label-adj-nuevo').style.borderColor = 'var(--sc-border)';
    },

    // ════════════════════════════════════════════════════════
    //  ADJUNTO CONSULTA — staging local, sube al enviar
    // ════════════════════════════════════════════════════════
    _adjConsulta: null, // File object en staging

    seleccionarAdjuntoConsulta(input) {
      const file = input.files[0];
      if (!file) return;
      window.__sc._adjConsulta = file;

      const preview = root.querySelector('#sc-adj-consulta-preview');
      root.querySelector('#sc-adj-consulta-nombre').textContent = file.name;
      root.querySelector('#sc-adj-consulta-tamano').textContent = `${(file.size/1024).toFixed(1)} KB`;
      root.querySelector('#sc-adj-consulta-icon').textContent   =
        file.type.startsWith('image/') ? '🖼️' : file.type.includes('pdf') ? '📄' : '📎';
      preview.style.display = 'flex';
      root.querySelector('#sc-label-adj-consulta').style.borderColor = 'var(--sc-accent)';
    },

    eliminarAdjuntoConsulta() {
      window.__sc._adjConsulta = null;
      root.querySelector('#sc-input-adj-consulta').value              = '';
      root.querySelector('#sc-adj-consulta-preview').style.display    = 'none';
      root.querySelector('#sc-label-adj-consulta').style.borderColor  = 'var(--sc-border)';
      const al = root.querySelector('#sc-alert-adj-consulta');
      if (al) al.textContent = '';
    },

    // ════════════════════════════════════════════════════════
    //  ENVIAR TICKET — crea el ticket y luego sube el adjunto
    // ════════════════════════════════════════════════════════
    async enviarTicket() {
      const email       = root.querySelector('#sc-email').value.trim();
      const asunto      = root.querySelector('#sc-asunto').value.trim();
      const descripcion = root.querySelector('#sc-descripcion').value.trim();
      const alertEl     = root.querySelector('#sc-alert-form');
      const btn         = root.querySelector('#sc-btn-enviar');

      alertEl.className = 'sc-alert';
      if (!email || !asunto || !descripcion) {
        alertEl.textContent = '✕ Correo, asunto y descripción son requeridos';
        alertEl.className   = 'sc-alert sc-error sc-visible';
        return;
      }

      setLoading(btn, true);
      try {
        // 1. Crea el ticket
        const res  = await fetch(`${BASE_URL}/api/public/widget/ticket`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceKey: WORKSPACE,
            userEmail:    email.toLowerCase(),
            userName:     root.querySelector('#sc-nombre').value.trim(),
            subject:      asunto,
            description:  descripcion,
            type:         root.querySelector('#sc-tipo').value,
            priority:     root.querySelector('#sc-prioridad').value
          })
        });
        const data = await res.json();
        if (!data.ok) {
          alertEl.textContent = '✕ ' + data.message;
          alertEl.className   = 'sc-alert sc-error sc-visible';
          return;
        }

        const referenceCode = data.data.referenceCode;

        // 2. Si hay adjunto en staging, súbelo ahora
        if (window.__sc._adjNuevo) {
          const formData = new FormData();
          formData.append('file',  window.__sc._adjNuevo);
          formData.append('email', email.toLowerCase());
          // Sube silenciosamente — no bloquea si falla
          await fetch(
            `${BASE_URL}/api/public/tickets/${referenceCode}/attachments`,
            { method: 'POST', body: formData }
          ).catch(() => {});
          window.__sc._adjNuevo = null;
        }

        // 3. Muestra pantalla de éxito
        root.querySelector('#sc-ref-display').textContent         = referenceCode;
        root.querySelector('#sc-form-screen').style.display       = 'none';
        root.querySelector('#sc-success-screen').style.display    = 'block';
      } catch (e) {
        alertEl.textContent = '✕ No se pudo conectar con el servidor';
        alertEl.className   = 'sc-alert sc-error sc-visible';
      } finally {
        setLoading(btn, false);
      }
    },

    // ════════════════════════════════════════════════════════
    //  ENVIAR MENSAJE + ADJUNTO en consulta (juntos al pulsar Enviar)
    // ════════════════════════════════════════════════════════
    async enviarConAdjunto(referenceCode) {
      const input   = root.querySelector('#sc-msg-cliente');
      const content = input?.value.trim();
      const adjunto = window.__sc._adjConsulta;
      const alerta  = root.querySelector('#sc-alert-adj-consulta');

      if (!content && !adjunto) return;

      // Envía el mensaje de texto si hay contenido
      if (content) {
        try {
          const res  = await fetch(`${BASE_URL}/api/public/tickets/${referenceCode}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: consulta.email, content })
          });
          const data = await res.json();

          if (data.ok) {
            input.value = '';
            const conv = root.querySelector('#sc-conv');
            const div  = document.createElement('div');
            div.style.cssText = 'padding:9px 12px;border-radius:8px;font-size:0.8rem;line-height:1.5;' +
              'max-width:88%;align-self:flex-start;background:var(--sc-surface2);' +
              'border:1px solid var(--sc-border);color:var(--sc-text-dim)';
            div.innerHTML = `<div style="font-size:0.65rem;color:var(--sc-text-muted);margin-bottom:3px">👤 Tú</div>${content}`;
            conv.appendChild(div);
            conv.scrollTop = conv.scrollHeight;
          } else {
            showAlert('sc-alert-paso3', data.message, 'error');
            return;
          }
        } catch (e) {
          showAlert('sc-alert-paso3', 'Error al enviar el mensaje', 'error');
          return;
        }
      }

      // Sube el adjunto si hay uno en staging
      if (adjunto) {
        if (alerta) { alerta.textContent = '⏳ Subiendo archivo...'; alerta.style.color = 'var(--sc-text-muted)'; }

        try {
          const formData = new FormData();
          formData.append('file',  adjunto);
          formData.append('email', consulta.email);

          const res  = await fetch(
            `${BASE_URL}/api/public/tickets/${referenceCode}/attachments`,
            { method: 'POST', body: formData }
          );
          const data = await res.json();

          if (data.ok) {
            const a     = data.data;
            const esImg = a.mimetype?.startsWith('image/');
            const conv  = root.querySelector('#sc-conv');
            const div   = document.createElement('div');
            div.style.cssText = 'padding:9px 12px;border-radius:8px;font-size:0.8rem;' +
              'max-width:88%;align-self:flex-start;background:var(--sc-surface2);' +
              'border:1px solid var(--sc-border);color:var(--sc-text-dim)';
            div.innerHTML = `
              <div style="font-size:0.65rem;color:var(--sc-text-muted);margin-bottom:4px">👤 Tú · 📎 Archivo</div>
              <a href="${a.url}" target="_blank" rel="noopener"
                 style="display:flex;align-items:center;gap:6px;text-decoration:none;color:var(--sc-accent)">
                ${esImg
                  ? `<img src="${a.url}" style="max-width:100px;max-height:70px;object-fit:cover;border-radius:4px">`
                  : `<span>${a.mimetype?.includes('pdf') ? '📄' : '📎'}</span>`
                }
                <span style="font-size:0.75rem">${a.filename}</span>
              </a>
            `;
            conv.appendChild(div);
            conv.scrollTop = conv.scrollHeight;

            // Limpia el staging
            window.__sc.eliminarAdjuntoConsulta();
            if (alerta) { alerta.textContent = ''; }
          } else {
            if (alerta) { alerta.textContent = '✕ ' + data.message; alerta.style.color = 'var(--sc-error)'; }
          }
        } catch (e) {
          if (alerta) { alerta.textContent = '✕ Error al subir el archivo'; alerta.style.color = 'var(--sc-error)'; }
        }
      }
    },

    irAConsultarDesdeExito() {
      const ref = root.querySelector('#sc-ref-display').textContent;
      window.__sc.cambiarTab('consultar');
      root.querySelector('#sc-ref-consulta').value = ref;
      root.querySelector('#sc-ref-consulta').focus();
    },

    nuevaSolicitud() {
      ['#sc-nombre','#sc-email','#sc-asunto','#sc-descripcion'].forEach(s =>
        root.querySelector(s).value = '');
      window.__sc.eliminarAdjuntoNuevo();
      root.querySelector('#sc-form-screen').style.display    = 'block';
      root.querySelector('#sc-success-screen').style.display = 'none';
      root.querySelector('#sc-alert-form').className         = 'sc-alert';
    }
  };

})();
