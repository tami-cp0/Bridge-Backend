import { AuthService } from '../../../src/core/auth/auth.service';
import type { JwtConfigType } from '../../../src/config/config.types';
import type { JwtService } from '@nestjs/jwt';
import type { SquadService } from '../../../src/core/squad/squad.service';
import type { RegisterBusinessDto } from '../../../src/core/auth/dto/register-business.dto';
import type { RegisterInvestorDto } from '../../../src/core/auth/dto/register-investor.dto';
import { SectorEnum } from '../../../src/common/enums/sector.enum';
import { db } from '../../../src/db';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

jest.mock('../../../src/db', () => ({
  db: {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  },
}));

type DbMock = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
};

const mockDb = db as unknown as DbMock;

const buildSelectEmpty = () => ({
  from: jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue([]),
  }),
});

const buildInsertReturning = (result: unknown) => ({
  values: jest.fn().mockReturnValue({
    returning: jest.fn().mockResolvedValue(result),
  }),
});

const buildInsertNoReturning = () => ({
  values: jest.fn().mockResolvedValue(undefined),
});

const buildUpdate = () => ({
  set: jest.fn().mockReturnValue({
    where: jest.fn().mockResolvedValue(undefined),
  }),
});

describe('AuthService registration', () => {
  const jwtCfg: JwtConfigType = {
    secret: 'test-secret',
    expiresIn: '7d',
  };

  const jwtService = {
    sign: jest.fn(() => 'jwt-token'),
  } as unknown as JwtService;

  const squadService = {
    createVirtualAccount: jest.fn(),
    createBusinessVirtualAccount: jest.fn(),
  } as unknown as SquadService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.select.mockImplementation(buildSelectEmpty);
    mockDb.update.mockImplementation(buildUpdate);
  });

  it('registers a business using the business VA endpoint', async () => {
    mockDb.insert
      .mockImplementationOnce(() => buildInsertReturning([{ id: 'user-1' }]))
      .mockImplementationOnce(() => buildInsertReturning([{ id: 'bp-1' }]))
      .mockImplementationOnce(() => buildInsertNoReturning());

    (squadService.createBusinessVirtualAccount as jest.Mock).mockResolvedValue({
      virtualAccountNumber: '1234567890',
      reference: 'user-1',
    });

    const service = new AuthService(jwtService, jwtCfg, squadService);

    const dto: RegisterBusinessDto = {
      fullName: 'Amara Okonkwo',
      email: 'amara@acmebakery.ng',
      phone: '08012345678',
      password: 'Str0ngPass!',
      bvn: '22123456789',
      businessName: 'Acme Bakery',
      sector: SectorEnum.FOOD_BEVERAGE,
      location: 'Lagos, Nigeria',
      yearsInOperation: 3,
      averageMonthlyRevenue: 80000000,
      businessDescription:
        'We supply artisan bread to 12 hotels in Lagos Island.',
      beneficiaryAccount: '0123456789',
    } as RegisterBusinessDto;

    const result = await service.registerBusiness(dto);

    expect(squadService.createBusinessVirtualAccount).toHaveBeenCalledWith(
      'user-1',
      'Acme Bakery',
      '22123456789',
      '08012345678',
      '0123456789',
    );
    expect(squadService.createVirtualAccount).not.toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'jwt-token',
      userType: 'business',
      squadVirtualAccountNumber: '1234567890',
    });
  });

  it('registers an investor using the customer VA endpoint', async () => {
    mockDb.insert
      .mockImplementationOnce(() => buildInsertReturning([{ id: 'user-2' }]))
      .mockImplementationOnce(() => buildInsertNoReturning());

    (squadService.createVirtualAccount as jest.Mock).mockResolvedValue({
      virtualAccountNumber: '9876543210',
      reference: 'user-2',
    });

    const service = new AuthService(jwtService, jwtCfg, squadService);

    const dto: RegisterInvestorDto = {
      fullName: 'Chidi Nwosu',
      email: 'chidi@example.com',
      phone: '08098765432',
      password: 'Str0ngPass!',
      bvn: '22123456789',
      sectorInterests: [SectorEnum.FOOD_BEVERAGE, SectorEnum.TECHNOLOGY],
      riskTierPreference: 'balanced',
      returnTimelinePreference: 'medium',
      beneficiaryAccount: '9876543210',
    } as RegisterInvestorDto;

    const result = await service.registerInvestor(dto);

    expect(squadService.createVirtualAccount).toHaveBeenCalledWith(
      'user-2',
      'Chidi Nwosu',
      '22123456789',
      '08098765432',
      'chidi@example.com',
    );
    expect(squadService.createBusinessVirtualAccount).not.toHaveBeenCalled();
    expect(result).toEqual({
      accessToken: 'jwt-token',
      userType: 'investor',
      squadVirtualAccountNumber: '9876543210',
    });
  });
});
