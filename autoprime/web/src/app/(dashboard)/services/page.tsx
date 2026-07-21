'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ServiceRecord } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

const currency = (v: string) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function ServicesPage() {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: '',
    description: '',
    price: '',
    estimatedMinutes: '',
    employeesRequired: '1',
  });

  function load() {
    api.get<ServiceRecord[]>('/services?all=true').then(setServices).catch(() => setError('Erro ao carregar serviços.'));
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/services', {
        ...form,
        price: Number(form.price),
        estimatedMinutes: Number(form.estimatedMinutes),
        employeesRequired: Number(form.employeesRequired),
      });
      setOpen(false);
      setForm({ name: '', category: '', description: '', price: '', estimatedMinutes: '', employeesRequired: '1' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar serviço.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Catálogo de Serviços"
        description="Lavagem, estética, detail e mais"
        actions={<Button onClick={() => setOpen(true)}>+ Novo serviço</Button>}
      />

      <Table>
        <Thead>
          <Th>Serviço</Th>
          <Th>Categoria</Th>
          <Th>Preço</Th>
          <Th>Duração</Th>
          <Th>Funcionários</Th>
          <Th>Status</Th>
        </Thead>
        <tbody>
          {services.map((s) => (
            <Tr key={s.id}>
              <Td className="font-medium">{s.name}</Td>
              <Td>{s.category}</Td>
              <Td>{currency(s.price)}</Td>
              <Td>{s.estimatedMinutes} min</Td>
              <Td>{s.employeesRequired}</Td>
              <Td>
                <Badge tone={s.active ? 'success' : 'neutral'}>{s.active ? 'Ativo' : 'Inativo'}</Badge>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo serviço">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <Label>Nome</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Input
              required
              placeholder="Lavagem, Estética, Detail..."
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Preço (R$)</Label>
              <Input
                type="number"
                step="0.01"
                required
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div>
              <Label>Duração (min)</Label>
              <Input
                type="number"
                required
                value={form.estimatedMinutes}
                onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })}
              />
            </div>
            <div>
              <Label>Funcionários</Label>
              <Input
                type="number"
                min={1}
                value={form.employeesRequired}
                onChange={(e) => setForm({ ...form, employeesRequired: e.target.value })}
              />
            </div>
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Salvando...' : 'Salvar serviço'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
