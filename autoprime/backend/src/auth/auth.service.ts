import { randomBytes, createHash } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { authenticator } from 'otplib';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterClientDto } from './dto/register-client.dto';
import { LoginDto } from './dto/login.dto';
import { CreateStaffDto } from './dto/create-staff.dto';
import { AuthenticatedUser } from './types/authenticated-user';
import { NotificationsService } from '../notifications/notifications.service';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  async registerClient(dto: RegisterClientDto) {
    if (!dto.lgpdConsent) {
      throw new BadRequestException('É necessário aceitar os termos de uso de dados (LGPD).');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Já existe uma conta com este e-mail.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        role: Role.CLIENT,
        client: {
          create: {
            document: dto.document,
            lgpdConsentAt: new Date(),
          },
        },
      },
      include: { client: true },
    });

    await this.notifications.sendWelcomeEmail(user.email, user.name);

    return this.issueTokens(this.toAuthenticatedUser(user));
  }

  async createStaff(dto: CreateStaffDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Já existe uma conta com este e-mail.');

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        role: dto.role,
        employee: {
          create: { position: dto.position },
        },
      },
      include: { employee: true },
    });

    return this.toAuthenticatedUser(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { employee: true, client: true },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.twoFactorEnabled) {
      if (!dto.otp) {
        return { requiresOtp: true };
      }
      const valid = authenticator.check(dto.otp, user.twoFactorSecret ?? '');
      if (!valid) throw new UnauthorizedException('Código 2FA inválido.');
    }

    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return this.issueTokens(this.toAuthenticatedUser(user));
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token inválido ou expirado.');
    }

    let payload: { sub: string };
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Refresh token inválido.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { employee: true, client: true },
    });
    if (!user || !user.isActive) throw new UnauthorizedException('Usuário inválido.');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(this.toAuthenticatedUser(user));
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken
      .updateMany({ where: { tokenHash }, data: { revokedAt: new Date() } })
      .catch(() => undefined);
    return { success: true };
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Sempre responde com sucesso para não revelar quais e-mails existem.
    if (!user) return { success: true };

    const resetToken = randomBytes(32).toString('hex');
    await this.notifications.sendPasswordResetEmail(user.email, resetToken);
    return { success: true };
  }

  async setup2fa(userId: string) {
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret, twoFactorEnabled: false },
    });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const otpauthUrl = authenticator.keyuri(user.email, 'AutoPrime', secret);
    return { secret, otpauthUrl };
  }

  async confirm2fa(userId: string, otp: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const valid = authenticator.check(otp, user.twoFactorSecret ?? '');
    if (!valid) throw new BadRequestException('Código inválido.');
    await this.prisma.user.update({ where: { id: userId }, data: { twoFactorEnabled: true } });
    return { success: true };
  }

  private async issueTokens(user: AuthenticatedUser) {
    // jti garante um token único por emissão: sem ele, dois logins no mesmo
    // segundo para o mesmo usuário gerariam o mesmo JWT (mesmo payload + iat),
    // colidindo na constraint única de tokenHash abaixo.
    const jti = randomBytes(16).toString('hex');

    const accessToken = this.jwt.sign(
      { sub: user.id, role: user.role, jti },
      {
        secret: this.config.get<string>('jwt.accessSecret'),
        expiresIn: this.config.get<string>('jwt.accessExpiresIn'),
      },
    );

    const refreshToken = this.jwt.sign(
      { sub: user.id, jti },
      {
        secret: this.config.get<string>('jwt.refreshSecret'),
        expiresIn: this.config.get<string>('jwt.refreshExpiresIn'),
      },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(refreshToken),
        userId: user.id,
        expiresAt,
      },
    });

    return { accessToken, refreshToken, user };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toAuthenticatedUser(user: {
    id: string;
    email: string;
    role: Role;
    employee?: { id: string } | null;
    client?: { id: string } | null;
  }): AuthenticatedUser {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      employeeId: user.employee?.id,
      clientId: user.client?.id,
    };
  }
}
