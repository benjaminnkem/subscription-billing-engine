import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';
import { RecoveryAction } from '../recovery-action.enum';

@Entity('recovery_links')
export class RecoveryLink extends BaseEntity {
  @Column({ type: 'uuid' })
  subscriptionId: string;

  @Column({ type: 'enum', enum: RecoveryAction })
  action: RecoveryAction;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt?: Date | null;
}
