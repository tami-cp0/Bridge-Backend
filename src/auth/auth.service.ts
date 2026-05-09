import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
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
import { VerifyBvnDto } from './dto/verify-bvn.dto';
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

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    // Insert user first, then profile — we need the user id for the foreign key
    const [user] = await db
      .insert(users)
      .values({
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        userType: 'business',
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

    // Seed an empty rating row so the business always has a rating record
    await db.insert(bridgeRatings).values({ businessId: bp.id });

    return { userId: user.id, userType: 'business' };
  }

  async registerInvestor(dto: RegisterInvestorDto) {
    await this.checkDuplicateEmailPhone(dto.email, dto.phone);

    const passwordHash = await bcrypt.hash(dto.password, this.BCRYPT_ROUNDS);

    const [user] = await db
      .insert(users)
      .values({
        fullName: dto.fullName,
        email: dto.email,
        phone: dto.phone,
        passwordHash,
        userType: 'investor',
      })
      .returning({ id: users.id });

    await db.insert(investorProfiles).values({
      userId: user.id,
      sectorInterests: dto.sectorInterests ?? null,
      riskTierPreference: dto.riskTierPreference ?? null,
      returnTimelinePreference: dto.returnTimelinePreference ?? null,
      investmentRangeMin: dto.investmentRangeMin ?? null,
      investmentRangeMax: dto.investmentRangeMax ?? null,
    });

    return { userId: user.id, userType: 'investor' };
  }

  async verifyBvn(dto: VerifyBvnDto) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, dto.userId));

    if (!user) throw new NotFoundException('User not found');
    if (user.bvnVerified) throw new BadRequestException('BVN already verified');

    // Hash before querying so the raw BVN is never stored
    const bvnHash = await bcrypt.hash(dto.bvn, this.BCRYPT_ROUNDS);
    const existing = await db.select().from(users).where(eq(users.bvnHash, bvnHash));
    if (existing.length > 0 && existing[0].id !== dto.userId) {
      throw new ConflictException('BVN already registered to another account');
    }

    await db
      .update(users)
      .set({ bvnVerified: true, bvnHash, updatedAt: new Date() })
      .where(eq(users.id, dto.userId));

    // Virtual account creation can fail without blocking BVN verification
    let squadVirtualAccountNumber: string | null = null;
    try {
      const squad = await this.squadService.createVirtualAccount(
        dto.userId,
        user.fullName,
        dto.bvn,
        user.phone,
        user.email,
      );
      await db
        .update(users)
        .set({
          squadVirtualAccountNumber: squad.virtualAccountNumber,
          squadVirtualAccountReference: squad.reference,
          updatedAt: new Date(),
        })
        .where(eq(users.id, dto.userId));
      squadVirtualAccountNumber = squad.virtualAccountNumber;
    } catch (err) {
      // Log but don't fail — virtual account can be created later
    }

    // Return a JWT immediately so the user can start using the app
    const accessToken = this.signToken(dto.userId, user.userType, user.email);
    return { accessToken, userType: user.userType, squadVirtualAccountNumber };
  }

  async login(dto: LoginDto) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, dto.email));

    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    // BVN verification is a prerequisite for all platform activity
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

  private signToken(userId: string, userType: string, email: string): string {
    return this.jwtService.sign(
      { sub: userId, userType, email },
      {
        secret: this.config.get<string>('JWT_SECRET'),
        // cast to any: @nestjs/jwt v11 expects branded StringValue, not plain string
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
