'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { getCurrentUser } from '@/lib/auth';
import { useCompany } from '@/lib/company-context';
import { zonedLocalInputToIso } from '@/lib/datetime';
import { SITE } from '@/lib/config';
import { ServiceRecord, VehicleRecord } from '@/lib/types';
import { useToast } from '@/components/ui/Toast';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Stepper } from '@/components/ui/Stepper';
import { ServiceCard } from '@/components/ui/ServiceCard';
import { TimeSlot } from '@/components/ui/TimeSlot';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { BottomSheet } from '@/components/ui/BottomSheet';

const STEPS = ['Unidade', 'Veículo', 'Serviço', 'Data', 'Horário', 'Revisão'];

const MORNING_SLOTS = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30'];
const AFTERNOON_SLOTS = ['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

const currency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AgendarPage() {
  const router = useRouter();
  const toast = useToast();
  const { company, timezone } = useCompany();
  const user = getCurrentUser();

  const [step, setStep] = useState(0);

  const [vehicles, setVehicles] = useState<VehicleRecord[] | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState({ brand: '', model: '', plate: '', year: '', color: '' });
  const [vehicleSaving, setVehicleSaving] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);

  const [services, setServices] = useState<ServiceRecord[] | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);

  const [date, setDate] = useState(todayIsoDate());
  const [time, setTime] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const clientId = user?.clientId;

  function loadVehicles() {
    if (!clientId) return;
    api
      .get<VehicleRecord[]>(`/vehicles?clientId=${clientId}`)
      .then(setVehicles)
      .catch(() => setVehicles([]));
  }

  useEffect(() => {
    loadVehicles();
    api
      .get<ServiceRecord[]>('/services')
      .then(setServices)
      .catch(() => setServices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedServices = useMemo(
    () => (services ?? []).filter((s) => serviceIds.includes(s.id)),
    [services, serviceIds],
  );
  const selectedVehicle = vehicles?.find((v) => v.id === vehicleId);
  const totalMinutes = selectedServices.reduce((sum, s) => sum + s.estimatedMinutes, 0);
  const totalPrice = selectedServices.reduce((sum, s) => sum + Number(s.price), 0);

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]));
  }

  async function handleAddVehicle(e: FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    setVehicleSaving(true);
    setVehicleError(null);
    try {
      const created = await api.post<VehicleRecord>('/vehicles', {
        clientId,
        brand: vehicleForm.brand,
        model: vehicleForm.model,
        plate: vehicleForm.plate,
        year: vehicleForm.year ? Number(vehicleForm.year) : undefined,
        color: vehicleForm.color || undefined,
      });
      setVehicleForm({ brand: '', model: '', plate: '', year: '', color: '' });
      setAddVehicleOpen(false);
      loadVehicles();
      setVehicleId(created.id);
      toast.show('Veículo cadastrado.', 'success');
    } catch (err) {
      setVehicleError(err instanceof ApiError ? err.message : 'Erro ao cadastrar veículo.');
    } finally {
      setVehicleSaving(false);
    }
  }

  async function handleConfirm() {
    if (!clientId || !vehicleId || serviceIds.length === 0 || !time) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await api.post('/appointments', {
        clientId,
        vehicleId,
        serviceIds,
        startAt: zonedLocalInputToIso(`${date}T${time}`, timezone),
      });
      setSuccess(true);
      toast.show('Agendamento confirmado!', 'success');
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : 'Erro ao confirmar agendamento.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!clientId) {
    return (
      <div>
        <PageHeader title="Agendar" />
        <EmptyState
          icon="🔒"
          title="Disponível para contas de cliente"
          description="O autoagendamento é destinado a contas de cliente. Use a Agenda do painel para criar agendamentos em nome de um cliente."
        />
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <PageHeader title="Agendar" />
        <Card className="text-center !py-10">
          <span className="text-3xl">✅</span>
          <h2 className="text-lg font-semibold text-graphite-900 dark:text-white mt-3">
            Agendamento confirmado
          </h2>
          <p className="text-sm text-graphite-500 dark:text-white/50 mt-1 max-w-sm mx-auto">
            Seu horário foi registrado com sucesso. Acompanhe pelo histórico.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
            <Button onClick={() => router.push('/historico')} className="w-full sm:w-auto">
              Ver histórico
            </Button>
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              onClick={() => {
                setSuccess(false);
                setStep(0);
                setVehicleId('');
                setServiceIds([]);
                setTime('');
              }}
            >
              Novo agendamento
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const canContinue = [
    true, // unidade
    !!vehicleId,
    serviceIds.length > 0,
    !!date,
    !!time,
    true,
  ][step];

  return (
    <div>
      <PageHeader title="Agendar horário" description="Complete os passos para reservar seu horário" />

      <Stepper steps={STEPS} current={step} />

      <Card className="mb-4">
        {step === 0 && (
          <div>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-3">Escolha a unidade</h3>
            <div className="rounded-xl border-2 border-primary-500 bg-primary-500/5 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-graphite-900 dark:text-white">
                  {company?.name ?? 'AP Auto Prime'}
                </span>
                <span className="text-primary-500 text-sm">✓ selecionada</span>
              </div>
              <p className="text-sm text-graphite-500 dark:text-white/50 mt-1">
                {SITE.address || 'Endereço da unidade a confirmar.'}
              </p>
              <p className="text-xs text-graphite-400 dark:text-white/40 mt-2">
                No momento, sua empresa atende em uma única unidade.
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-graphite-900 dark:text-white">Escolha o veículo</h3>
              <button
                onClick={() => setAddVehicleOpen(true)}
                className="text-sm font-medium text-primary-500 hover:underline"
              >
                + Adicionar
              </button>
            </div>

            {vehicles === null && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            )}

            {vehicles && vehicles.length === 0 && (
              <EmptyState
                icon="🚗"
                title="Nenhum veículo cadastrado"
                description="Cadastre seu veículo para continuar."
                action={<Button onClick={() => setAddVehicleOpen(true)}>+ Adicionar veículo</Button>}
              />
            )}

            <div className="flex flex-col gap-2">
              {vehicles?.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVehicleId(v.id)}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    vehicleId === v.id
                      ? 'border-primary-500 ring-2 ring-primary-500/30 bg-primary-500/5'
                      : 'border-black/10 dark:border-white/10 hover:border-primary-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-graphite-900 dark:text-white">
                      {v.brand} {v.model}
                    </span>
                    {vehicleId === v.id && <span className="text-primary-500 text-sm">✓</span>}
                  </div>
                  <span className="text-sm text-graphite-500 dark:text-white/50">
                    Placa {v.plate}
                    {v.color ? ` · ${v.color}` : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-3">Escolha o(s) serviço(s)</h3>
            {services === null && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            )}
            {services && services.length === 0 && (
              <EmptyState icon="🧽" title="Nenhum serviço disponível no momento" />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {services?.map((s) => (
                <ServiceCard
                  key={s.id}
                  name={s.name}
                  category={s.category}
                  description={s.description}
                  price={Number(s.price)}
                  estimatedMinutes={s.estimatedMinutes}
                  selected={serviceIds.includes(s.id)}
                  onSelect={() => toggleService(s.id)}
                />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-3">Escolha a data</h3>
            <Label htmlFor="date">Data do serviço</Label>
            <Input
              id="date"
              type="date"
              min={todayIsoDate()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-1">Escolha o horário</h3>
            <p className="text-xs text-graphite-400 dark:text-white/40 mb-3">
              Horários sugeridos — a disponibilidade final é confirmada ao concluir o agendamento.
            </p>

            <p className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 mb-2">
              Manhã
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
              {MORNING_SLOTS.map((t) => (
                <TimeSlot key={t} label={t} selected={time === t} onClick={() => setTime(t)} />
              ))}
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-graphite-500 dark:text-white/50 mb-2">
              Tarde
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {AFTERNOON_SLOTS.map((t) => (
                <TimeSlot key={t} label={t} selected={time === t} onClick={() => setTime(t)} />
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 className="font-medium text-graphite-900 dark:text-white mb-3">Revisão do agendamento</h3>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex justify-between border-b border-black/5 dark:border-white/10 pb-2">
                <span className="text-graphite-500 dark:text-white/50">Unidade</span>
                <span className="font-medium text-graphite-900 dark:text-white">{company?.name ?? 'AP Auto Prime'}</span>
              </div>
              <div className="flex justify-between border-b border-black/5 dark:border-white/10 pb-2">
                <span className="text-graphite-500 dark:text-white/50">Veículo</span>
                <span className="font-medium text-graphite-900 dark:text-white">
                  {selectedVehicle ? `${selectedVehicle.brand} ${selectedVehicle.model} · ${selectedVehicle.plate}` : '—'}
                </span>
              </div>
              <div className="flex justify-between border-b border-black/5 dark:border-white/10 pb-2">
                <span className="text-graphite-500 dark:text-white/50">Serviços</span>
                <span className="font-medium text-graphite-900 dark:text-white text-right">
                  {selectedServices.map((s) => s.name).join(', ')}
                </span>
              </div>
              <div className="flex justify-between border-b border-black/5 dark:border-white/10 pb-2">
                <span className="text-graphite-500 dark:text-white/50">Data e horário</span>
                <span className="font-medium text-graphite-900 dark:text-white">
                  {new Date(`${date}T00:00`).toLocaleDateString('pt-BR')} às {time}
                </span>
              </div>
              <div className="flex justify-between border-b border-black/5 dark:border-white/10 pb-2">
                <span className="text-graphite-500 dark:text-white/50">Duração estimada</span>
                <span className="font-medium text-graphite-900 dark:text-white">~{totalMinutes} min</span>
              </div>
              <div className="flex justify-between">
                <span className="text-graphite-500 dark:text-white/50">Total estimado</span>
                <span className="font-semibold text-primary-500">{currency(totalPrice)}</span>
              </div>
            </div>

            {submitError && <p className="text-sm text-danger mt-3">{submitError}</p>}
          </div>
        )}
      </Card>

      <div className="sticky bottom-2 sm:static flex gap-2 bg-white/90 dark:bg-graphite-900/90 sm:bg-transparent backdrop-blur-xl sm:backdrop-blur-none rounded-2xl sm:rounded-none p-3 sm:p-0 border sm:border-0 border-black/10 dark:border-white/10">
        {step > 0 && (
          <Button variant="secondary" className="flex-1 sm:flex-none" onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button className="flex-1 sm:flex-none" disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
            Continuar
          </Button>
        ) : (
          <Button className="flex-1 sm:flex-none" disabled={submitting} onClick={handleConfirm}>
            {submitting ? 'Agendando...' : 'Agendar'}
          </Button>
        )}
      </div>

      <BottomSheet open={addVehicleOpen} onClose={() => setAddVehicleOpen(false)} title="Adicionar veículo">
        <form onSubmit={handleAddVehicle} className="flex flex-col gap-3">
          <div>
            <Label>Marca</Label>
            <Input required value={vehicleForm.brand} onChange={(e) => setVehicleForm({ ...vehicleForm, brand: e.target.value })} />
          </div>
          <div>
            <Label>Modelo</Label>
            <Input required value={vehicleForm.model} onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })} />
          </div>
          <div>
            <Label>Placa</Label>
            <Input required value={vehicleForm.plate} onChange={(e) => setVehicleForm({ ...vehicleForm, plate: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ano</Label>
              <Input type="number" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} />
            </div>
            <div>
              <Label>Cor</Label>
              <Input value={vehicleForm.color} onChange={(e) => setVehicleForm({ ...vehicleForm, color: e.target.value })} />
            </div>
          </div>
          {vehicleError && <p className="text-sm text-danger">{vehicleError}</p>}
          <Button type="submit" disabled={vehicleSaving} className="w-full mt-2">
            {vehicleSaving ? 'Salvando...' : 'Salvar veículo'}
          </Button>
        </form>
      </BottomSheet>
    </div>
  );
}
