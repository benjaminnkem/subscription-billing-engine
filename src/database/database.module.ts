import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKey } from 'src/api-keys/entities/api-key.entity';
import { AuditLog } from 'src/audit/entities/audit-log.entity';
import { User } from 'src/auth/entities/user.entity';
import { Merchant } from 'src/merchants/entities/merchant.entity';

const entities = [User, Merchant, AuditLog, ApiKey];

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isDevelopment = config.get<string>('nodeEnv') === 'development';

        return {
          type: 'postgres',
          host: config.get<string>('database.host'),
          port: config.get<number>('database.port'),
          username: config.get<string>('database.username'),
          password: config.get<string>('database.password'),
          database: config.get<string>('database.name'),
          entities,
          migrations: [`${__dirname}/migrations/*{.ts,.js}`],
          migrationsRun: isDevelopment,
          synchronize: isDevelopment,
          logging: config.get<string>('data.logging') === 'true',
        };
      },
    }),
  ],
})
export class DatabaseModule {}
