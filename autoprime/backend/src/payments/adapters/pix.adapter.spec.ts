import { ConfigService } from '@nestjs/config';
import { PixAdapter } from './pix.adapter';

describe('PixAdapter', () => {
  let adapter: PixAdapter;

  beforeEach(() => {
    adapter = new PixAdapter(new ConfigService());
  });

  it('gera um payload EMV com CRC16 válido', async () => {
    const result = await adapter.createCharge({
      amount: 40,
      description: 'Teste',
      referenceId: 'abc-123',
    });

    expect(result.status).toBe('PENDING');
    expect(result.pixCopyPaste).toBeDefined();
    const payload = result.pixCopyPaste!;

    // O payload deve terminar com o CRC (campo 63, tamanho 04) calculado.
    const withoutCrc = payload.slice(0, -4);
    const crcInPayload = payload.slice(-4);
    expect(crcInPayload).toMatch(/^[0-9A-F]{4}$/);

    // Recalcula o CRC16-CCITT manualmente para conferir consistência.
    let crc = 0xffff;
    const fullForCrc = withoutCrc; // já inclui o campo 63 com tamanho declarado
    for (let i = 0; i < fullForCrc.length; i++) {
      crc ^= fullForCrc.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xffff;
      }
    }
    const expectedCrc = crc.toString(16).toUpperCase().padStart(4, '0');
    expect(crcInPayload).toBe(expectedCrc);
  });

  it('inclui o valor formatado com duas casas decimais', async () => {
    const result = await adapter.createCharge({
      amount: 99.9,
      description: 'Teste',
      referenceId: 'xyz',
    });
    expect(result.pixCopyPaste).toContain('540599.90');
  });
});
