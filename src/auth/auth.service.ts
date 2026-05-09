import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { createHmac } from 'crypto';
import { db } from '../db';
import {
  users,
  businessProfiles,
  investorProfiles,
  bridgeRatings,
} from '../db/schema';
import { eq, or } from 'drizzle-orm';
import { RegisterBusinessDto } from './dto/register-business.dto';
import { RegisterInvestorDto } from './dto/register-investor.dto';
import { LoginDto } from './dto/login.dto';
import { SquadService } from '../squad/squad.service';

@Injectable()
export class AuthService {
  private readonly BCRYPT_ROUNDS = 12;

  constructor(
    private jwtService: JwtService,
    private config: ConfigService,
    private squadService: SquadService,
  ) {}

  async registerBusiness(dto: RegisterBusinessDto) {
    await this.checkDuplicateEmailPhone(dto.email, dto.phone);
    await this.checkDuplicateBvn(dto.bvn);

    const [passwordHash, bvnHash] = await Promise.all([
      bcrypt.hash(dto.password, this.BCRYPT_ROUNDS),
      Promise.resolve(this.hashBvn(dto.bvn)),
    ]);

    const [user] = await db
      .insert(users)
      .values({
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        userType: 'business',
        bvnVerified: true,
        bvnHash,
      })
      .returning({ id: users.id });

    const [bp] = await db
      .insert(businessProfiles)
      .values({
        userId: user.id,
        businessName: dto.businessName,
        sector: dto.sector,
        location: dto.location,
        yearsInOperation: dto.yearsInOperation,
        averageMonthlyRevenue: dto.averageMonthlyRevenue,
        businessDescription: dto.businessDescription,
      })
      .returning({ id: businessProfiles.id });

    await db.insert(bridgeRatings).values({ businessId: bp.id });

    const squad = await this.squadService.createVirtualAccount(
      user.id,
      dto.fullName,
      dto.bvn,
      dto.phone,
      dto.email,
    );

    await db
      .update(users)
      .set({
        squadVirtualAccountNumber: squad.virtualAccountNumber,
        squadVirtualAccountReference: squad.reference,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const accessToken = this.signToken(user.id, 'business', dto.email);
    return { accessToken, userType: 'business', squadVirtualAccountNumber: squad.virtualAccountNumber };
  }

  async registerInvestor(dto: RegisterInvestorDto) {
    await this.checkDuplicateEmailPhone(dto.email, dto.phone);
    await this.checkDuplicateBvn(dto.bvn);

    const [passwordHash, bvnHash] = await Promise.all([
      bcrypt.hash(dto.password, this.BCRYPT_ROUNDS),
      Promise.resolve(this.hashBvn(dto.bvn)),
    ]);

    const [user] = await db
      .insert(users)
      .values({
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        userType: 'investor',
        bvnVerified: true,
        bvnHash,
      })
      .returning({ id: users.id });

    await db.insert(investorProfiles).values({
      userId: user.id,
      sectorInterests: dto.sectorInterests ?? null,
      riskTierPreference: dto.riskTierPreference ?? null,
      returnTimelinePreference: dto.returnTimelinePreference ?? null,
    });

    const squad = await this.squadService.createVirtualAccount(
      user.id,
      dto.fullName,
      dto.bvn,
      dto.phone,
      dto.email,
    );

    await db
      .update(users)
      .set({
        squadVirtualAccountNumber: squad.virtualAccountNumber,
        squadVirtualAccountReference: squad.reference,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    const accessToken = this.signToken(user.id, 'investor', dto.email);
    return { accessToken, userType: 'investor', squadVirtualAccountNumber: squad.virtualAccountNumber };
  }

  async login(dto: LoginDto) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email));

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    if (!user.bvnVerified) {
      throw new UnauthorizedException('BVN verification required');
    }

    const accessToken = this.signToken(user.id, user.userType, user.email);
    return {
      accessToken,
      userType: user.userType,
      squadVirtualAccountNumber: user.squadVirtualAccountNumber,
    };
  }

  private hashBvn(bvn: string): string {
    return createHmac('sha256', this.config.get<string>('JWT_SECRET')!)
      .update(bvn)
      .digest('hex');
  }

  private async checkDuplicateBvn(bvn: string) {
    const bvnHash = this.hashBvn(bvn);
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.bvnHash, bvnHash));
    if (existing.length > 0) {
      throw new ConflictException('BVN already registered to another account');
    }
  }

  private signToken(userId: string, userType: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, userType, email },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: (this.config.get<string>('JWT_EXPIRES_IN') ?? '7d') as any,
      },
    );
  }

  private async checkDuplicateEmailPhone(email: string, phone: string) {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(or(eq(users.email, email), eq(users.phone, phone)));
    if (existing.length > 0) {
      throw new ConflictException('Email or phone already registered');
    }
  }
}
