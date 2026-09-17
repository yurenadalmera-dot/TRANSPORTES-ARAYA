import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { setTimeout as espera } from 'node:timers/promises';
import { creaServidor } from '../src/web/servidor.js';
import { escapa } from '../src/web/vistas.js';

function facturaFalsa(extra = {}) {
  return {
    facturaId: '1', numero: 'FE-1', terceroCodigo: 'C1', terceroNombre: 'Cliente Uno',
    terceroTelefono: '+34600000001', fechaEmision: '2026-08-01', fechaVencimiento: '2026-09-01',
    concepto: 'Portes de prueba', totalCentimos: 123456, pendienteCentimos: 123456,
    ...extra,
  };
}

async function conServidor(origen, prueba) {
  const servidor = creaServidor({ origen });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const { port } = servidor.address();
  try {
    await prueba(`http://127.0.0.1:${port}`);
  } finally {
    servidor.close();
    await once(servidor, 'close');
  }
}

const origenFalso = {
  nombre: 'prueba',
  async cobrosPendientes() { return [facturaFalsa()]; },
  async pagosPendientes() { return []; },
};

test('el panel responde con el listado en HTML', async () => {
  await conServidor(origenFalso, async (base) => {
    const res = await fetch(base);
    const html = await res.text();

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.match(html, /Clientes pendientes de cobro/);
    assert.match(html, /Proveedores pendientes de pago/);
    assert.match(html, /Cliente Uno/);
    assert.match(html, /1\.234,56/);
    assert.match(html, /No hay nada pendiente de pagar/);
  });
});

test('la API devuelve el informe en JSON', async () => {
  await conServidor(origenFalso, async (base) => {
    const res = await fetch(`${base}/api/informe`);
    const informe = await res.json();

    assert.equal(res.status, 200);
    assert.equal(informe.cobros.totalCentimos, 123456);
    assert.equal(informe.cobros.porTercero[0].nombre, 'Cliente Uno');
  });
});

test('el CSV sale con BOM, punto y coma y coma decimal para Excel', async () => {
  await conServidor(origenFalso, async (base) => {
    const res = await fetch(`${base}/cobros.csv`);
    // Se leen los bytes en crudo: Response.text() se come el BOM al decodificar,
    // y sin BOM Excel destroza las tildes. La prueba debe ver los bytes reales.
    const bytes = new Uint8Array(await res.arrayBuffer());
    const csv = new TextDecoder('utf-8').decode(bytes);

    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-disposition'), /cobros-pendientes-\d{4}-\d{2}-\d{2}\.csv/);
    assert.deepEqual([...bytes.slice(0, 3)], [0xEF, 0xBB, 0xBF], 'falta el BOM que Excel necesita');
    assert.match(csv, /Nº factura;Cliente;Código/);
    assert.match(csv, /FE-1;Cliente Uno;C1;01\/08\/2026;01\/09\/2026;\d+;1234,56;1234,56;Portes de prueba/);
  });
});

test('los nombres con caracteres raros se escapan en el HTML', async () => {
  const origenMalicioso = {
    nombre: 'prueba',
    async cobrosPendientes() {
      return [facturaFalsa({ terceroNombre: '<script>alert(1)</script>', concepto: 'a "b" & c' })];
    },
    async pagosPendientes() { return []; },
  };

  await conServidor(origenMalicioso, async (base) => {
    const html = await (await fetch(base)).text();
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.match(html, /a &quot;b&quot; &amp; c/);
  });
});

test('escapa cubre los cinco caracteres con significado en HTML', () => {
  assert.equal(escapa(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(escapa(null), '');
});

test('una ruta que no existe devuelve 404 y otro método 405', async () => {
  await conServidor(origenFalso, async (base) => {
    assert.equal((await fetch(`${base}/lo-que-sea`)).status, 404);
    assert.equal((await fetch(base, { method: 'POST' })).status, 405);
    assert.equal((await fetch(`${base}/salud`)).status, 200);
  });
});

test('si el origen falla, el panel lo dice en vez de caerse', async () => {
  const origenRoto = {
    nombre: 'roto',
    async cobrosPendientes() { throw new Error('el SaaS no responde'); },
    async pagosPendientes() { return []; },
  };

  await conServidor(origenRoto, async (base) => {
    const res = await fetch(base);
    assert.equal(res.status, 500);
    assert.match(await res.text(), /el SaaS no responde/);
  });
});

test('con CLAVE_PANEL definida el panel no se abre sin la clave', async () => {
  const puerto = 38251;
  const hijo = spawn(process.execPath, ['--no-warnings', 'src/web/servidor.js'], {
    env: { ...process.env, CLAVE_PANEL: 'secreto-de-yeni', PUERTO: String(puerto), HOST: '127.0.0.1' },
    stdio: 'ignore',
  });

  try {
    const base = `http://127.0.0.1:${puerto}`;
    for (let intento = 0; intento < 40; intento += 1) {
      try {
        await fetch(`${base}/salud`);
        break;
      } catch {
        await espera(100);
      }
    }

    assert.equal((await fetch(base)).status, 401);
    assert.equal((await fetch(`${base}/?clave=incorrecta`)).status, 401);
    assert.equal((await fetch(`${base}/cobros.csv`)).status, 401);

    // Con la clave correcta deja una cookie y redirige al panel sin la clave en la URL.
    const conClave = await fetch(`${base}/?clave=secreto-de-yeni`, { redirect: 'manual' });
    assert.equal(conClave.status, 302);
    assert.equal(conClave.headers.get('location'), '/');
    assert.match(conClave.headers.get('set-cookie'), /araya_clave=/);

    // /salud sigue abierto para que el monitor externo pueda comprobarlo.
    assert.equal((await fetch(`${base}/salud`)).status, 200);
  } finally {
    hijo.kill();
  }
});
