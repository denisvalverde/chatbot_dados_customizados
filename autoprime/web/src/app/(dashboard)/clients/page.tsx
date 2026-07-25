'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { ClientRecord } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Label } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';

export default function ClientsPage() {
  const toast = useToast();
  const [clients, setClients] = useState<ClientRecord[] | null>(null);
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', document: '' });

  function load(q?: string) {
    api
      .get<ClientRecord[]>(`/clients${q ? `?search=${encodeURIComponent(q)}` : ''}`)
      .then(setClients)
      .catch(() => setError('Erro ao carregar clientes.'));
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post('/clients', form);
      setOpen(false);
      setForm({ name: '', email: '', password: '', phone: '', document: '' });
      load(search);
      toast.show('Cliente cadastrado com sucesso.', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar cliente.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        description="Cadastro completo de clientes e veículos"
        actions={<Button onClick={() => setOpen(true)} className="w-full sm:w-auto">+ Novo cliente</Button>}
      />

      <Card className="mb-4 !p-3">
        <Input
          placeholder="Buscar por nome, e-mail ou CPF..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            load(e.target.value);
          }}
        />
      </Card>

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      {clients === null && !error && (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      )}

      {clients && clients.length === 0 && (
        <EmptyState
          icon="👤"
          title="Nenhum cliente encontrado"
          description="Ajuste a busca ou cadastre um novo cliente."
          action={<Button onClick={() => setOpen(true)}>+ Novo cliente</Button>}
        />
      )}

      {clients && clients.length > 0 && (
        <>
          {/* Mobile: cards */}
          <div className="flex flex-col gap-3 lg:hidden">
            {clients.map((c) => (
              <Link key={c.id} href={`/clients/${c.client.id}`}>
                <Card className="!p-4 flex items-center justify-between gap-3 hover:border-primary-500/40 transition-colors">
                  <div className="min-w-0">
                    <p className="font-medium text-graphite-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-sm text-graphite-500 dark:text-white/50 truncate">{c.email}</p>
                    <p className="text-xs text-graphite-400 dark:text-white/40 mt-0.5">
                      {c.client?.vehicles?.length ?? 0} veículo(s)
                    </p>
                  </div>
                  <Badge tone={c.isActive ? 'success' : 'danger'}>{c.isActive ? 'Ativo' : 'Inativo'}</Badge>
                </Card>
              </Link>
            ))}
          </div>

          {/* Desktop: tabela */}
          <div className="hidden lg:block">
            <Table>
              <Thead>
                <Th>Nome</Th>
                <Th>E-mail</Th>
                <Th>CPF</Th>
                <Th>Veículos</Th>
                <Th>Status</Th>
              </Thead>
              <tbody>
                {clients.map((c) => (
                  <Tr key={c.id}>
                    <Td className="font-medium">
                      <Link href={`/clients/${c.client.id}`} className="hover:text-primary-500">
                        {c.name}
                      </Link>
                    </Td>
                    <Td>{c.email}</Td>
                    <Td>{c.client?.document ?? '—'}</Td>
                    <Td>{c.client?.vehicles?.length ?? 0}</Td>
                    <Td>
                      <Badge tone={c.isActive ? 'success' : 'danger'}>
                        {c.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Novo cliente">
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <div>
            <Label>Nome completo</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div>
            <Label>Senha provisória</Label>
            <Input
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>
          <div>
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} />
          </div>
          {error && <p className="text-sm text-danger">{error}</p>}
          <Button type="submit" disabled={loading} className="mt-2 w-full">
            {loading ? 'Salvando...' : 'Salvar cliente'}
          </Button>
        </form>
      </Modal>
    </div>
  );
}
