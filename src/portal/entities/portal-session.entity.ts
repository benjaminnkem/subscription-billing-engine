import { Column, Entity, Index } from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

@Entity('portal_sessions')
export class PortalSession extends BaseEntity {
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  token: string;

  @Column({ type: 'uuid' })
  customerId: string;

  @Column({ type: 'timestamptz' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  /** Which portal config mode was used when the magic link was issued */
  @Column({ type: 'varchar', length: 10, default: 'live' })
  mode: 'test' | 'live';
}
