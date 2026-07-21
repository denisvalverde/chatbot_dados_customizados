'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ProductRecord } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

export default function InventoryPage() {
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', unit: 'un', quantity: '0', minQuantity: '0', costPrice: '0' });

  function load() {
    api.get<ProductRecord[]>('/inventory/products').then(setProducts).catch(() => setError('Erro ao carregar estoque.'));
  }

  useEffect(load, []);

  function isLow(p: ProductRecord) {
    return Number(p.quantity) <= Number(p.minQuantity);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/inventory/products', {
        ...form,
        quantity: Number(form.quantity),
        minQuantity: Number(form.minQuantity),
        costPrice: Number(form.costPrice),
      });
      setOpen(false);
      setForm({ name: '', sku: '', unit: 'un', quantity: '0', minQuantity: '0', costPrice: '0' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar produto.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Estoque"
        description="Produtos, quantidades e alertas de estoque baixo"
        actions={<Button onClick={() => setOpen(true)}>+ Novo produto</Button>}
      />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      <Table>
        <Thead>
          <Th>Produto</Th>
          <Th>SKU</Th>
          <Th>Quantidade</Th>
          <Th>Mínimo</Th>
          <Th>Custo</Th>
          <Th>Status</Th>
        </Thead>
        <tbody>
          {products.map((p) => (
            <Tr key={p.id}>
              <Td className="font-medium">{p.name}</Td>
              <Td>{p.sku ?? '—'}</Td>
              <Td>
                {p.quantity} {p.unit}
              </Td>
              <Td>
                {p.minQuantity} {p.unit}
              </Td>
              <Td>{Number(p.costPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Td>
              <Td>
                <Badge tone={isLow(p) ? 'danger' : 'success'}>{isLow(p) ? 'Estoque baixo' : 'OK'}</Badge>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo produto">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <Label>Nome</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>SKU</Label>
            <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidade</Label>
              <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </div>
            <div>
              <Label>Custo (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={form.costPrice}
                onChange={(e) => setForm({ ...form, costPrice: e.target.value })}
              />
            </div>
            <div>
              <Label>Quantidade inicial</Label>
              <Input
                type="number"
                step="0.001"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div>
              <Label>Estoque mínimo</Label>
              <Input
                type="number"
                step="0.001"
                value={form.minQuantity}
                onChange={(e) => setForm({ ...form, minQuantity: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Salvando...' : 'Salvar produto'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
