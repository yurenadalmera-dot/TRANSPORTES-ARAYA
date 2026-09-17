// Los importes viajan siempre en céntimos (enteros). Solo se convierten a
// euros en el último momento, al pintarlos.

const formateador = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  // Sin esto, el español deja "4250,00 €" sin punto de millar y el listado
  // queda desigual al lado de "21.430,50 €".
  useGrouping: 'always',
});

export function formateaEuros(centimos) {
  return formateador.format(Math.round(centimos) / 100);
}

// Acepta "1.234,56", "1234.56", "1234,56 €" o un número en euros.
export function aCentimos(valor) {
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw new TypeError(`Importe no válido: ${valor}`);
    return Math.round(valor * 100);
  }
  const limpio = String(valor ?? '')
    .replace(/[\s€]/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '')
    .replace(',', '.');
  const numero = Number.parseFloat(limpio);
  if (!Number.isFinite(numero)) throw new TypeError(`Importe no válido: ${valor}`);
  return Math.round(numero * 100);
}

export function suma(centimos) {
  return centimos.reduce((total, x) => total + x, 0);
}

export function sumaPor(filas, campo = 'pendienteCentimos') {
  return filas.reduce((total, fila) => total + (fila[campo] ?? 0), 0);
}
