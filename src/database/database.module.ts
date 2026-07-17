import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

const entities = [];

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
