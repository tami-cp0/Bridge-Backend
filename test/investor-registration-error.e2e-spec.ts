import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/core/auth/auth.service';
import { RegisterInvestorDto } from '../src/core/auth/dto/register-investor.dto';
import 'dotenv/config';

describe('Investor Registration (Manual Integration)', () => {
  let authService: AuthService;
  let moduleFixture: TestingModule;

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    authService = moduleFixture.get<AuthService>(AuthService);
  });

  afterAll(async () => {
    await moduleFixture.close();
  });

  it('should attempt to create an investor with an empty beneficiaryAccount and log the output', async () => {
    const randomSuffix = Math.floor(Math.random() * 1000000);
    const dto: any = {
      fullName: 'Test Investor ' + randomSuffix,
      email: `test-investor-${randomSuffix}@example.com`,
      phone: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
      password: 'StrongPassword123!',
      bvn: '22123456789',
    };

    console.log('Sending registration request with empty beneficiaryAccount...');
    
    try {
      const result = await authService.registerInvestor(dto);
      console.log('SUCCESS (Unexpected):', result);
    } catch (error: any) {
      console.log('ERROR STATUS:', error.status);
      console.log('ERROR RESPONSE:', JSON.stringify(error.response, null, 2));
      console.log('ERROR MESSAGE:', error.message);
    }
  });
});
