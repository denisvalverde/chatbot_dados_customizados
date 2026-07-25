export type Role = 'ADMIN' | 'MANAGER' | 'EMPLOYEE' | 'WASHER' | 'DETAILER' | 'FINANCE' | 'CLIENT';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  employeeId?: string;
  clientId?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface ClientRecord {
  id: string;
  email: string;
  name: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  client: {
    id: string;
    document?: string;
    addressCity?: string;
    addressState?: string;
    vehicles?: VehicleRecord[];
  };
}

export interface VehicleRecord {
  id: string;
  clientId: string;
  brand: string;
  model: string;
  year?: number;
  color?: string;
  plate: string;
  km?: number;
}

export interface ServiceRecord {
  id: string;
  name: string;
  category: string;
  description?: string;
  price: string;
  estimatedMinutes: number;
  employeesRequired: number;
  active: boolean;
  checklistItems: { id: string; label: string }[];
}

export interface CompanyRecord {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  /** Fuso IANA da empresa (ex.: "America/Sao_Paulo") — nunca assuma o fuso do navegador. */
  timezone: string;
}

export interface AppointmentRecord {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  notes?: string;
  client: { id: string; user: { name: string } };
  vehicle: { brand: string; model: string; plate: string };
  services: { service: { name: string } }[];
}

export interface ServiceOrderRecord {
  id: string;
  number: number;
  status: string;
  createdAt: string;
  finishedAt?: string;
  client: { user: { name: string } };
  vehicle: { brand: string; model: string; plate: string };
  items: { id: string; price: string; service: { name: string } }[];
  checklist: { id: string; label: string; checked: boolean }[];
  photos: { id: string; stage: string; url: string }[];
}

export interface TransactionRecord {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  category: string;
  description?: string;
  amount: string;
  occurredAt: string;
}

export interface ProductRecord {
  id: string;
  name: string;
  sku?: string;
  unit: string;
  quantity: string;
  minQuantity: string;
  costPrice: string;
}

export interface EmployeeRecord {
  id: string;
  position: string;
  commissionRate: string;
  active: boolean;
  user: { name: string; email: string; role: Role };
}

export interface DashboardSummary {
  period: { from: string; to: string };
  revenue: number;
  expense: number;
  profit: number;
  ticketMedio: number;
  ordersCompleted: number;
  distinctClientsServed: number;
  newClients: number;
  totalAppointments: number;
  cancelledAppointments: number;
  cancellationRate: number;
  averageRating: number | null;
}
