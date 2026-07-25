export interface CreateChargeInput {
  amount: number;
  description: string;
  referenceId: string;
}

export interface ChargeResult {
  providerRef: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  pixQrCode?: string;
  pixCopyPaste?: string;
  checkoutUrl?: string;
}

export interface PaymentAdapter {
  createCharge(input: CreateChargeInput): Promise<ChargeResult>;
}
