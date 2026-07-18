import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecoveryLink } from './entities/recovery-link.entity';
import { RecoveryLinkService } from './recovery-link.service';

@Module({
  imports: [TypeOrmModule.forFeature([RecoveryLink])],
  providers: [RecoveryLinkService],
  exports: [RecoveryLinkService],
})
export class RecoveryLinkModule {}
