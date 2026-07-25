'use client';

import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { TransactionRecord } from '@/lib/types';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Label, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { MetricCard } from '@/components/ui/MetricCard';
import { Badge } from '@/components/ui/Badge';

const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface CashFlow {
  income: number;
  expense: number;
  profit: number;
}

export default function FinancialPage() {
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ type: 'INCOME', category: '', description: '', amount: '' });

  function load() {
    const from = new Date();
    from.setDate(from.getDate() - 30);
    const to = new Date();
    const fromStr = from.toISOString().slice(0, 10);
    // `to` não é truncado para meia-noite: senão o filtro `lte` no backend
    // excluiria lançamentos feitos mais tarde no próprio dia de hoje.
    const toStr = to.toISOString();

    api.get<TransactionRecord[]>(`/financial/transactions?from=${fromStr}&to=${toStr}`).then(setTransactions).catch(() => setError('Erro ao carregar transações.'));
    api.get<CashFlow>(`/financial/cash-flow?from=${fromStr}&to=${toStr}`).then(setCashFlow).catch(() => undefined);
  }

  useEffect(load, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/financial/transactions', { ...form, amount: Number(form.amount) });
      setOpen(false);
      setForm({ type: 'INCOME', category: '', description: '', amount: '' });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao lançar transação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Financeiro"
        description="Fluxo de caixa, receitas e despesas dos últimos 30 dias"
        actions={<Button onClick={() => setOpen(true)}>+ Lançamento</Button>}
      />

      {cashFlow && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <MetricCard label="Receita" value={currency(cashFlow.income)} tone="success" />
          <MetricCard label="Despesa" value={currency(cashFlow.expense)} tone="danger" />
          <MetricCard label="Lucro" value={currency(cashFlow.profit)} tone="primary" />
        </div>
      )}

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      <Card className="!p-0">
        <Table>
          <Thead>
            <Th>Data</Th>
            <Th>Categoria</Th>
            <Th>Descrição</Th>
            <Th>Tipo</Th>
            <Th>Valor</Th>
          </Thead>
          <tbody>
            {transactions.map((t) => (
              <Tr key={t.id}>
                <Td>{new Date(t.occurredAt).toLocaleDateString('pt-BR')}</Td>
                <Td>{t.category}</Td>
                <Td>{t.description ?? '—'}</Td>
                <Td>
                  <Badge tone={t.type === 'INCOME' ? 'success' : 'danger'}>
                    {t.type === 'INCOME' ? 'Receita' : 'Despesa'}
                  </Badge>
                </Td>
                <Td>{currency(Number(t.amount))}</Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Novo lançamento">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="INCOME">Receita</option>
              <option value="EXPENSE">Despesa</option>
            </Select>
          </div>
          <div>
            <Label>Categoria</Label>
            <Input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2">
            {loading ? 'Salvando...' : 'Lançar'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
