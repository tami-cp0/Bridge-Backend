import axios from 'axios';
import { SquadService } from '../../../src/core/squad/squad.service';
import type { SquadConfigType } from '../../../src/config/config.types';

jest.mock('axios', () => ({
  create: jest.fn(),
  isAxiosError: jest.fn(),
}));

describe('SquadService sandbox API usage', () => {
  const sandboxBaseUrl = 'https://sandbox-api-d.squadco.com';

  const buildService = (postMock: jest.Mock, getMock: jest.Mock) => {
    (axios.create as jest.Mock).mockReturnValue({
      post: postMock,
      get: getMock,
    });

    const config: SquadConfigType = {
      baseUrl: sandboxBaseUrl,
      secretKey: 'sandbox_sk_test',
      merchantId: 'SBNTEST',
    };

    return new SquadService(config);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls the customer virtual account endpoint on the sandbox base URL', async () => {
    const postMock = jest.fn().mockResolvedValue({
      data: {
        data: {
          virtual_account_number: '1234567890',
          customer_identifier: 'user-1',
        },
      },
    });

    const service = buildService(postMock, jest.fn());

    await service.createVirtualAccount(
      'user-1',
      'Test User',
      '22123456789',
      '08012345678',
      'test@example.com',
    );

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: sandboxBaseUrl,
        headers: expect.objectContaining({
          Authorization: 'Bearer sandbox_sk_test',
        }),
      }),
    );

    expect(postMock).toHaveBeenCalledWith(
      '/virtual-account',
      expect.objectContaining({
        bvn: '22123456789',
        mobile_num: '08012345678',
      }),
    );
  });

  it('calls the business virtual account endpoint on the sandbox base URL', async () => {
    const postMock = jest.fn().mockResolvedValue({
      data: {
        data: {
          virtual_account_number: '9988776655',
          customer_identifier: 'biz-1',
        },
      },
    });

    const service = buildService(postMock, jest.fn());

    await service.createBusinessVirtualAccount(
      'biz-1',
      'Acme Bakery',
      '22123456789',
      '08012345678',
    );

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: sandboxBaseUrl,
        headers: expect.objectContaining({
          Authorization: 'Bearer sandbox_sk_test',
        }),
      }),
    );

    expect(postMock).toHaveBeenCalledWith(
      '/virtual-account/business',
      expect.objectContaining({
        business_name: 'Acme Bakery',
        customer_identifier: 'biz-1',
      }),
    );
  });
});
