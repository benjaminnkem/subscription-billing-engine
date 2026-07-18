import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Merchant } from '../merchants/entities/merchant.entity';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { EmailTemplateRegistry } from '../mail/email-template.registry';

describe('AuthService', () => {
  let service: AuthService;
  let userRepoMock: any;
  let merchantRepoMock: any;
  let jwtServiceMock: any;
  let configServiceMock: any;
  let auditServiceMock: any;
  let mailServiceMock: any;
  let emailTemplateRegistryMock: any;

  beforeEach(async () => {
    userRepoMock = {
      findOne: jest.fn(),
      create: jest.fn((data) => ({ id: 'user-123', ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'user-123', ...data })),
      update: jest.fn(),
    };

    merchantRepoMock = {
      create: jest.fn((data) => ({ id: 'merchant-123', ...data })),
      save: jest.fn((data) => Promise.resolve({ id: 'merchant-123', ...data })),
    };

    jwtServiceMock = {
      signAsync: jest.fn().mockResolvedValue('token-123'),
    };

    configServiceMock = {
      get: jest.fn((key) => {
        if (key === 'jwt.accessExpiry') return '15m';
        if (key === 'jwt.refreshExpiry') return '7d';
        return null;
      }),
      getOrThrow: jest.fn((key) => {
        if (key === 'jwt.accessExpiry') return '15m';
        if (key === 'jwt.refreshExpiry') return '7d';
        if (key === 'jwt.accessSecret') return 'access-secret';
        if (key === 'jwt.refreshSecret') return 'refresh-secret';
        return null;
      }),
    };

    auditServiceMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };

    mailServiceMock = {
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    };

    emailTemplateRegistryMock = {
      welcomeMerchant: jest.fn((context) => ({
        template: 'emails/welcome-merchant',
        subject: 'Welcome to Subflow!',
        context,
      })),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepoMock,
        },
        {
          provide: getRepositoryToken(Merchant),
          useValue: merchantRepoMock,
        },
        {
          provide: JwtService,
          useValue: jwtServiceMock,
        },
        {
          provide: ConfigService,
          useValue: configServiceMock,
        },
        {
          provide: AuditService,
          useValue: auditServiceMock,
        },
        {
          provide: MailService,
          useValue: mailServiceMock,
        },
        {
          provide: EmailTemplateRegistry,
          useValue: emailTemplateRegistryMock,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should sign up a user and send a welcome email', async () => {
    userRepoMock.findOne.mockResolvedValue(null);

    const dto = {
      businessName: 'Acme Corp',
      email: 'admin@acme.com',
      password: 'SecurePassword123!',
      firstName: 'John',
      lastName: 'Doe',
      phone: '1234567890',
    };

    const result = await service.signup(dto);

    expect(result).toBeDefined();
    expect(result.user.email).toBe('admin@acme.com');
    expect(merchantRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        businessName: 'Acme Corp',
        email: 'admin@acme.com',
      }),
    );
    expect(merchantRepoMock.save).toHaveBeenCalled();
    expect(userRepoMock.create).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'admin@acme.com',
        firstName: 'John',
        lastName: 'Doe',
      }),
    );
    expect(userRepoMock.save).toHaveBeenCalled();
    expect(emailTemplateRegistryMock.welcomeMerchant).toHaveBeenCalledWith({
      userName: 'John',
      businessName: 'Acme Corp',
    });
    expect(mailServiceMock.sendTemplate).toHaveBeenCalledWith(
      'admin@acme.com',
      'emails/welcome-merchant',
      expect.objectContaining({
        userName: 'John',
        businessName: 'Acme Corp',
      }),
      'Welcome to Subflow!',
    );
  });

  it('should not fail signup if welcome email sending fails', async () => {
    userRepoMock.findOne.mockResolvedValue(null);
    mailServiceMock.sendTemplate.mockRejectedValue(new Error('SMTP error'));

    const dto = {
      businessName: 'Acme Corp',
      email: 'admin@acme.com',
      password: 'SecurePassword123!',
      firstName: 'John',
      lastName: 'Doe',
    };

    const result = await service.signup(dto);

    expect(result).toBeDefined();
    expect(result.user.email).toBe('admin@acme.com');
    expect(mailServiceMock.sendTemplate).toHaveBeenCalled();
  });
});
