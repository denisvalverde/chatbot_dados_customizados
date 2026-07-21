import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; create: jest.Mock; update: jest.Mock };
    refreshToken: { create: jest.Mock };
  };
  let notifications: { sendWelcomeEmail: jest.Mock };
  let jwt: JwtService;

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      refreshToken: { create: jest.fn() },
    };
    notifications = { sendWelcomeEmail: jest.fn() };
    jwt = new JwtService({ secret: 'test-secret' });

    const config = new ConfigService({
      jwt: {
        accessSecret: 'access-secret',
        accessExpiresIn: '15m',
        refreshSecret: 'refresh-secret',
        refreshExpiresIn: '7d',
      },
    });

    service = new AuthService(
      prisma as unknown as PrismaService,
      jwt,
      config,
      notifications as unknown as NotificationsService,
    );
  });

  it('rejeita registro de cliente sem aceite LGPD', async () => {
    await expect(
      service.registerClient({
        name: 'Teste',
        email: 'teste@teste.com',
        password: '12345678',
        lgpdConsent: '',
      }),
    ).rejects.toThrow('LGPD');
  });

  it('rejeita registro com e-mail já existente', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'u1' });

    await expect(
      service.registerClient({
        name: 'Teste',
        email: 'teste@teste.com',
        password: '12345678',
        lgpdConsent: 'true',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('cria cliente e retorna tokens quando dados são válidos', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockResolvedValue({
      id: 'u1',
      email: 'teste@teste.com',
      name: 'Teste',
      role: Role.CLIENT,
      client: { id: 'c1' },
    });

    const result = await service.registerClient({
      name: 'Teste',
      email: 'teste@teste.com',
      password: '12345678',
      lgpdConsent: 'true',
    });

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(notifications.sendWelcomeEmail).toHaveBeenCalledWith('teste@teste.com', 'Teste');
    expect(prisma.refreshToken.create).toHaveBeenCalled();
  });

  it('rejeita login com senha incorreta', async () => {
    const passwordHash = await bcrypt.hash('senha-correta', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      isActive: true,
      role: Role.CLIENT,
      twoFactorEnabled: false,
    });

    await expect(service.login({ email: 'a@b.com', password: 'errada' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('faz login com sucesso quando a senha está correta', async () => {
    const passwordHash = await bcrypt.hash('senha-correta', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      isActive: true,
      role: Role.CLIENT,
      twoFactorEnabled: false,
    });
    prisma.user.update.mockResolvedValue({});

    const result = await service.login({ email: 'a@b.com', password: 'senha-correta' });
    expect('accessToken' in result && result.accessToken).toBeTruthy();
  });

  it('exige OTP quando 2FA está habilitado', async () => {
    const passwordHash = await bcrypt.hash('senha-correta', 12);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash,
      isActive: true,
      role: Role.CLIENT,
      twoFactorEnabled: true,
      twoFactorSecret: 'SECRET',
    });

    const result = await service.login({ email: 'a@b.com', password: 'senha-correta' });
    expect(result).toEqual({ requiresOtp: true });
  });
});
