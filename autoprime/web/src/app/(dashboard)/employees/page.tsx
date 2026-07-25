'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EmployeeRecord } from '@/lib/types';
import { roleLabel } from '@/lib/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Table, Thead, Th, Tr, Td } from '@/components/ui/Table';
import { Badge } from '@/components/ui/Badge';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.get<EmployeeRecord[]>('/employees').then(setEmployees).catch(() => setError('Erro ao carregar funcionários.'));
  }

  useEffect(load, []);

  async function checkInOut(id: string, action: 'check-in' | 'check-out') {
    try {
      await api.post(`/employees/${id}/${action}`);
      load();
    } catch {
      setError('Não foi possível registrar o ponto (verifique se já não há um ponto em aberto).');
    }
  }

  return (
    <div>
      <PageHeader title="Funcionários" description="Escala, ponto e comissão" />

      {error && <p className="text-sm text-danger mb-4">{error}</p>}

      <Table>
        <Thead>
          <Th>Nome</Th>
          <Th>Cargo</Th>
          <Th>Perfil</Th>
          <Th>Comissão</Th>
          <Th>Status</Th>
          <Th>Ponto</Th>
        </Thead>
        <tbody>
          {employees.map((e) => (
            <Tr key={e.id}>
              <Td className="font-medium">{e.user.name}</Td>
              <Td>{e.position}</Td>
              <Td>{roleLabel(e.user.role)}</Td>
              <Td>{e.commissionRate}%</Td>
              <Td>
                <Badge tone={e.active ? 'success' : 'neutral'}>{e.active ? 'Ativo' : 'Inativo'}</Badge>
              </Td>
              <Td>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => checkInOut(e.id, 'check-in')}>
                    Check-in
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => checkInOut(e.id, 'check-out')}>
                    Check-out
                  </Button>
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
